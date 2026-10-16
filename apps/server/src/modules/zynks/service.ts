import {
  DEFAULTS,
  getEffect,
  getReaction,
  hasFeature,
  isSelectable,
  type FeatureId,
  type ZynkEvent,
} from '@zynk/shared';
import type { z } from 'zod';
import type { sendZynkSchema } from '@zynk/shared';
import type { AppContext } from '../../context';
import { withTransaction, type Queryable } from '../../db/pool';
import { ApiError } from '../../lib/errors';
import { getFeatures } from '../entitlements/service';
import { effectivePreferences, getPreferences } from '../preferences/service';
import { pickPublic, publicCols } from '../users/model';
import { areFriends, isBlockedEitherWay } from '../users/relations';

export const ZYNK_COLS = `z.id, z.sender_id, z.recipient_id, z.created_at, z.seen_at, z.sound_id, z.effect_id, z.bubble_color_id,
  z.reaction_id, z.reaction_fallback, z.response_reaction_id, z.response_reaction_fallback`;

export function toZynkEvent(row: Record<string, unknown>, viewerId: string): ZynkEvent {
  const sent = row.sender_id === viewerId;
  return {
    id: row.id as string,
    direction: sent ? 'sent' : 'received',
    counterpart: pickPublic(row, 'c_'),
    createdAt: (row.created_at as Date).toISOString(),
    seenAt: (row.seen_at as Date | null)?.toISOString() ?? null,
    soundId: row.sound_id as string | null,
    effectId: row.effect_id as string,
    bubbleColorId: row.bubble_color_id as string,
    reactionId: row.reaction_id as string | null,
    reactionFallback: row.reaction_fallback as string | null,
    responseReactionId: row.response_reaction_id as string | null,
    responseReactionFallback: row.response_reaction_fallback as string | null,
  };
}

export async function loadZynk(db: Queryable, id: string, viewerId: string): Promise<ZynkEvent | null> {
  const { rows } = await db.query(
    `select ${ZYNK_COLS}, ${publicCols('c', 'c_')}
       from zynks z join users c on c.id = case when z.sender_id = $2 then z.recipient_id else z.sender_id end
      where z.id = $1 and (z.sender_id = $2 or z.recipient_id = $2)`,
    [id, viewerId],
  );
  return rows[0] ? toZynkEvent(rows[0], viewerId) : null;
}

/** Validates a reaction ref against the catalog and the actor's entitlements. */
export function validateReaction(ref: string, features: readonly FeatureId[]) {
  const found = getReaction(ref);
  if (!found || found.pack.retired) throw new ApiError('unknown_item', 'Unknown reaction', { fields: { reactionId: 'Unknown reaction' } });
  if (!hasFeature(features, found.pack.requiredFeature)) {
    throw new ApiError('feature_locked', `${found.pack.name} is a ZYNK Plus pack`, { feature: found.pack.requiredFeature ?? undefined });
  }
  return found;
}

type SendInput = z.output<typeof sendZynkSchema>;

export async function sendZynk(ctx: AppContext, senderId: string, input: SendInput): Promise<{ zynk: ZynkEvent; duplicate: boolean }> {
  const { db, config, now: clock } = ctx;
  if (input.recipientId === senderId) throw new ApiError('bad_request', "You can't Zynk yourself");

  // 1. Idempotency: a retried request returns the original Zynk, untouched.
  const existing = await db.query<{ id: string }>('select id from zynks where sender_id = $1 and client_nonce = $2', [senderId, input.clientNonce]);
  if (existing.rows[0]) {
    const zynk = await loadZynk(db, existing.rows[0].id, senderId);
    if (zynk) return { zynk, duplicate: true };
  }

  // 2. Relationship checks. Blocks are reported as "not friends" so they can't be probed.
  const { rows: rec } = await db.query<{ status: string }>('select status from users where id = $1', [input.recipientId]);
  if (!rec[0] || rec[0].status !== 'active') throw new ApiError('not_friends', 'You can only Zynk friends');
  if ((await isBlockedEitherWay(db, senderId, input.recipientId)) || !(await areFriends(db, senderId, input.recipientId))) {
    throw new ApiError('not_friends', 'You can only Zynk friends');
  }

  // 3. Personalization, validated against the sender's verified entitlements.
  const features = await getFeatures(db, senderId, clock());
  const prefs = effectivePreferences(await getPreferences(db, senderId), features);
  let reactionFallback: string | null = null;
  if (input.reactionId) reactionFallback = validateReaction(input.reactionId, features).item.glyph;
  let effectId = prefs.effectId;
  if (input.effectId) {
    const effect = getEffect(input.effectId);
    if (!effect || effect.retired) throw new ApiError('unknown_item', 'Unknown effect');
    if (!isSelectable(getEffect, input.effectId, features)) {
      throw new ApiError('feature_locked', 'This effect is a ZYNK Plus feature', { feature: effect.requiredFeature ?? undefined });
    }
    effectId = input.effectId;
  }
  let soundId = prefs.outgoingSoundId;
  const paired = getEffect(effectId)?.pairedSoundId;
  if (paired && soundId === DEFAULTS.soundId && hasFeature(features, 'custom_sounds')) soundId = paired;

  // 4. Persist under a per-sender lock so concurrent requests can't slip past the limits.
  const result = await withTransaction(db, async (tx) => {
    await tx.query('select pg_advisory_xact_lock(hashtextextended($1::text, 7))', [senderId]);
    const t = clock();
    const { rows: stats } = await tx.query<{ last_pair: Date | null; pair_min: number; sender_min: number; sender_hour: number }>(
      `select
         (select max(created_at) from zynks where sender_id = $1 and recipient_id = $2) as last_pair,
         (select count(*) from zynks where sender_id = $1 and recipient_id = $2 and created_at > $3::timestamptz - interval '1 minute') as pair_min,
         (select count(*) from zynks where sender_id = $1 and created_at > $3::timestamptz - interval '1 minute') as sender_min,
         (select count(*) from zynks where sender_id = $1 and created_at > $3::timestamptz - interval '1 hour') as sender_hour`,
      [senderId, input.recipientId, t],
    );
    const s = stats[0]!;
    // Re-check idempotency inside the lock.
    const dup = await tx.query<{ id: string }>('select id from zynks where sender_id = $1 and client_nonce = $2', [senderId, input.clientNonce]);
    if (dup.rows[0]) return { id: dup.rows[0].id, duplicate: true };

    const sinceLast = s.last_pair ? t.getTime() - s.last_pair.getTime() : Infinity;
    if (sinceLast < config.limits.pairCooldownMs) {
      throw new ApiError('cooldown', 'Easy there! Give it a second.', { retryAfterMs: config.limits.pairCooldownMs - sinceLast });
    }
    if (s.pair_min >= config.limits.pairMaxPerMinute || s.sender_min >= config.limits.senderMaxPerMinute) {
      throw new ApiError('rate_limited', 'Whoa, that is a lot of Zynks. Take a breather.', { retryAfterMs: 60_000 });
    }
    if (s.sender_hour >= config.limits.senderMaxPerHour) {
      throw new ApiError('rate_limited', 'You have hit the anti-spam limit. Try again later.', { retryAfterMs: 3600_000 });
    }
    const { rows } = await tx.query<{ id: string }>(
      `insert into zynks (sender_id, recipient_id, client_nonce, sound_id, effect_id, bubble_color_id, reaction_id, reaction_fallback, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [senderId, input.recipientId, input.clientNonce, soundId, effectId, prefs.bubbleColorId, input.reactionId ?? null, reactionFallback, t],
    );
    return { id: rows[0]!.id, duplicate: false };
  });

  if (!result.duplicate) ctx.push.notifyZynk(result.id);
  const zynk = await loadZynk(db, result.id, senderId);
  return { zynk: zynk!, duplicate: result.duplicate };
}
