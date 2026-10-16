import { describeReaction, getSound, resolveIncomingSound, type PushData } from '@zynk/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../../config';
import type { Db } from '../../db/pool';
import { getFeatures } from '../entitlements/service';
import { effectivePreferences, getPreferences } from '../preferences/service';
import type { PushMessage, PushProvider } from './provider';

export const SILENT_CHANNEL_ID = 'zynk_silent';
export const androidChannelFor = (soundId: string | null) => (soundId ? `zynk_${soundId.replace(/^zynk_/, '')}` : SILENT_CHANNEL_ID);

interface DeviceRow { id: string; token: string; platform: 'ios' | 'android' }

/**
 * Delivers push notifications after the triggering request has been answered.
 * Persisting the Zynk never depends on push: failures here only change
 * `zynks.push_status`, and the Zynk is always visible in Activity.
 */
export class PushDispatcher {
  private pending = new Set<Promise<unknown>>();

  constructor(
    private readonly db: Db,
    private readonly provider: PushProvider,
    private readonly config: Config,
    private readonly log: FastifyBaseLogger,
    private readonly now: () => Date,
  ) {}

  get providerName() {
    return this.provider.name;
  }

  private run(label: string, fn: () => Promise<unknown>) {
    const p = fn()
      .catch((err) => this.log.error({ err, event: 'push_failed', label }, 'push dispatch failed'))
      .finally(() => this.pending.delete(p));
    this.pending.add(p);
  }

  /** Waits for in-flight deliveries (tests and graceful shutdown). */
  async drain() {
    while (this.pending.size) await Promise.all([...this.pending]);
  }

  notifyZynk(zynkId: string) {
    this.run('zynk', () => this.deliverZynk(zynkId));
  }

  notifyFriendRequest(a: { requestId: string; fromUserId: string; toUserId: string }) {
    this.run('friend_request', () => this.deliverSocial(a.toUserId, a.fromUserId, 'friend_request', a.requestId));
  }

  notifyFriendAccepted(a: { accepterId: string; requesterId: string }) {
    this.run('friend_accepted', () => this.deliverSocial(a.requesterId, a.accepterId, 'friend_accepted'));
  }

  private async devices(userId: string): Promise<DeviceRow[]> {
    const { rows } = await this.db.query<DeviceRow>(
      'select id, token, platform from device_tokens where user_id = $1 and invalidated_at is null',
      [userId],
    );
    return rows;
  }

  private async unseenCount(userId: string) {
    const { rows } = await this.db.query<{ n: number }>(
      'select count(*) as n from zynks where recipient_id = $1 and seen_at is null',
      [userId],
    );
    return rows[0]?.n ?? 0;
  }

  private async setStatus(zynkId: string, status: 'sent' | 'skipped' | 'failed', reason: string | null) {
    await this.db.query('update zynks set push_status = $2, push_skip_reason = $3 where id = $1', [zynkId, status, reason]);
  }

  private async deliverZynk(zynkId: string) {
    const { rows } = await this.db.query<{
      sender_id: string; recipient_id: string; sound_id: string | null; reaction_id: string | null;
      reaction_fallback: string | null; created_at: Date; sender_name: string; muted: boolean; friend_sound_id: string | null;
    }>(
      `select z.sender_id, z.recipient_id, z.sound_id, z.reaction_id, z.reaction_fallback, z.created_at,
              s.display_name as sender_name,
              exists (select 1 from mutes m where m.user_id = z.recipient_id and m.muted_id = z.sender_id) as muted,
              (select sound_id from friend_sounds fs where fs.user_id = z.recipient_id and fs.friend_id = z.sender_id) as friend_sound_id
         from zynks z join users s on s.id = z.sender_id where z.id = $1`,
      [zynkId],
    );
    const z = rows[0];
    if (!z) return;

    const prefs = await getPreferences(this.db, z.recipient_id);
    if (!prefs.pushEnabled || !prefs.zynkPush) return this.setStatus(zynkId, 'skipped', 'disabled');
    if (z.muted) return this.setStatus(zynkId, 'skipped', 'muted');

    if (this.config.limits.pushCollapseMs > 0) {
      const { rowCount } = await this.db.query(
        `select 1 from zynks where sender_id = $1 and recipient_id = $2 and id <> $3 and push_status = 'sent'
            and created_at > $4::timestamptz - make_interval(secs => $5::double precision / 1000)`,
        [z.sender_id, z.recipient_id, zynkId, z.created_at, this.config.limits.pushCollapseMs],
      );
      if (rowCount) return this.setStatus(zynkId, 'skipped', 'collapsed');
    }

    const devices = await this.devices(z.recipient_id);
    if (devices.length === 0) return this.setStatus(zynkId, 'skipped', 'no_devices');

    // Recipient settings decide the sound; the OS still decides whether it plays.
    const features = await getFeatures(this.db, z.recipient_id, this.now());
    const eff = effectivePreferences(prefs, features);
    const soundId = resolveIncomingSound({
      senderSoundId: z.sound_id,
      recipient: { soundsEnabled: eff.soundsEnabled, allowSenderSounds: eff.allowSenderSounds, incomingSoundId: eff.incomingSoundId },
      recipientFeatures: features,
      friendOverrideSoundId: z.friend_sound_id,
    });
    const sound = getSound(soundId);
    const reaction = describeReaction(z.reaction_id, z.reaction_fallback);
    const data: PushData = { type: 'zynk', zynkId, senderId: z.sender_id, url: `zynk://activity?zynk=${zynkId}` };
    const badge = await this.unseenCount(z.recipient_id);

    const ok = await this.sendTo(devices, (d) => ({
      to: d.token,
      platform: d.platform,
      title: 'ZYNK!',
      body: `${z.sender_name} zynked you${reaction ? ` ${reaction.glyph}` : ''}`,
      data: { ...data, soundId: sound?.id ?? null },
      iosSound: sound ? `${sound.file}.wav` : null,
      androidChannelId: androidChannelFor(sound?.id ?? null),
      badge,
    }));
    await this.setStatus(zynkId, ok ? 'sent' : 'failed', ok ? null : 'provider_error');
  }

  private async deliverSocial(toUserId: string, otherUserId: string, kind: 'friend_request' | 'friend_accepted', requestId?: string) {
    const prefs = await getPreferences(this.db, toUserId);
    if (!prefs.pushEnabled || !prefs.friendRequestPush) return;
    const devices = await this.devices(toUserId);
    if (!devices.length) return;
    const { rows } = await this.db.query<{ display_name: string }>('select display_name from users where id = $1', [otherUserId]);
    const name = rows[0]?.display_name ?? 'Someone';
    const data: PushData =
      kind === 'friend_request'
        ? { type: 'friend_request', requestId: requestId!, fromUserId: otherUserId, url: 'zynk://add' }
        : { type: 'friend_accepted', userId: otherUserId, url: `zynk://user/${otherUserId}` };
    await this.sendTo(devices, (d) => ({
      to: d.token,
      platform: d.platform,
      title: kind === 'friend_request' ? 'New friend request' : 'You have a new friend',
      body: kind === 'friend_request' ? `${name} wants to be friends on ZYNK` : `${name} accepted your request. Send a Zynk!`,
      data,
      iosSound: 'default',
      androidChannelId: 'social',
    }));
  }

  private async sendTo(devices: DeviceRow[], build: (d: DeviceRow) => PushMessage): Promise<boolean> {
    const results = await this.provider.send(devices.map(build));
    let anyOk = false;
    for (const [i, r] of results.entries()) {
      const device = devices[i]!;
      if (r.ok) {
        anyOk = true;
        if (r.ticketId) {
          await this.db.query('insert into push_tickets (ticket_id, device_token_id) values ($1, $2) on conflict do nothing', [r.ticketId, device.id]);
        }
      } else if (r.deviceGone) {
        await this.db.query('update device_tokens set invalidated_at = $2 where id = $1', [device.id, this.now()]);
      } else {
        this.log.warn({ event: 'push_error', error: r.error, platform: device.platform }, 'push delivery error');
      }
    }
    return anyOk;
  }

  /** Checks Expo receipts for tickets older than 15 minutes and invalidates dead tokens. */
  async processReceipts(): Promise<number> {
    if (!this.provider.checkReceipts) return 0;
    const { rows } = await this.db.query<{ ticket_id: string }>(
      `select ticket_id from push_tickets where created_at < now() - interval '15 minutes' order by created_at limit 1000`,
    );
    if (!rows.length) return 0;
    const ids = rows.map((r) => r.ticket_id);
    const { deadTicketIds } = await this.provider.checkReceipts(ids);
    if (deadTicketIds.length) {
      await this.db.query(
        `update device_tokens set invalidated_at = now()
          where id in (select device_token_id from push_tickets where ticket_id = any($1))`,
        [deadTicketIds],
      );
    }
    await this.db.query('delete from push_tickets where ticket_id = any($1)', [ids]);
    return deadTicketIds.length;
  }
}
