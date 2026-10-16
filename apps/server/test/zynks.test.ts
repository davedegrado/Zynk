import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addDevice, api, befriend, grantPlus, register, setup, zynk, type TestCtx } from './helpers';

let t: TestCtx;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.app.close();
});

describe('sending Speows', () => {
  it('friends can send each other Speows and it shows up in both activities', async () => {
    const a = await register(t, 'zed');
    const b = await register(t, 'yara');
    await befriend(t, a, b);
    const res = await zynk(t, a, b);
    expect(res.statusCode).toBe(201);
    expect(res.json().zynk).toMatchObject({ direction: 'sent', soundId: 'zynk_classic', effectId: 'classic', bubbleColorId: 'lime', reactionId: null });

    const inbox = (await api(t, b).get('/activity?direction=received')).json();
    expect(inbox.unseenCount).toBe(1);
    expect(inbox.items[0]).toMatchObject({ direction: 'received', seenAt: null });
    expect(inbox.items[0].counterpart.username).toBe('zed');
    expect((await api(t, a).get('/activity?direction=sent')).json().items).toHaveLength(1);

    // Speow back.
    t.clock.advance(1000);
    expect((await zynk(t, b, a)).statusCode).toBe(201);
    expect((await api(t, b).get('/activity')).json().items.map((i: { direction: string }) => i.direction)).toEqual(['sent', 'received']);
  });

  it('non-friends and self cannot be sent a Speow, even via direct API calls', async () => {
    const a = await register(t);
    const b = await register(t);
    expect((await zynk(t, a, b)).json().error.code).toBe('not_friends');
    expect((await zynk(t, a, a)).statusCode).toBe(400);
    expect((await api(t, a).post('/zynks', { recipientId: randomUUID(), clientNonce: randomUUID() })).json().error.code).toBe('not_friends');
    // Pending request is not enough.
    await api(t, a).post('/friend-requests', { userId: b.id });
    expect((await zynk(t, a, b)).statusCode).toBe(403);
  });

  it('retries with the same nonce are deduplicated', async () => {
    const a = await register(t);
    const b = await register(t);
    await befriend(t, a, b);
    const nonce = randomUUID();
    const first = await api(t, a).post('/zynks', { recipientId: b.id, clientNonce: nonce });
    const again = await api(t, a).post('/zynks', { recipientId: b.id, clientNonce: nonce });
    const concurrent = await Promise.all([1, 2, 3].map(() => api(t, a).post('/zynks', { recipientId: b.id, clientNonce: nonce })));
    expect(first.statusCode).toBe(201);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ duplicate: true, zynk: { id: first.json().zynk.id } });
    for (const c of concurrent) expect(c.json().zynk.id).toBe(first.json().zynk.id);
    expect((await t.db.query('select 1 from zynks')).rowCount).toBe(1);
  });

  it('enforces a per-friend cooldown and anti-spam limits', async () => {
    const a = await register(t);
    const b = await register(t);
    await befriend(t, a, b);
    expect((await zynk(t, a, b)).statusCode).toBe(201);
    const fast = await zynk(t, a, b);
    expect(fast.statusCode).toBe(429);
    expect(fast.json().error.code).toBe('cooldown');
    expect(fast.json().error.retryAfterMs).toBeGreaterThan(0);
    // Concurrent bursts can't slip past the cooldown.
    t.clock.advance(2500);
    const burst = await Promise.all([1, 2, 3, 4].map(() => zynk(t, a, b)));
    expect(burst.filter((r) => r.statusCode === 201)).toHaveLength(1);

    for (let i = 0; i < 20; i++) {
      t.clock.advance(2100);
      await zynk(t, a, b);
    }
    const { rowCount } = await t.db.query('select 1 from zynks');
    expect(rowCount).toBeLessThanOrEqual(1 + 1 + 12);
  });

  it('free users have no artificial daily quota', async () => {
    t = (await t.app.close(), await setup({ ZYNK_SENDER_MAX_PER_HOUR: '600' }));
    const a = await register(t);
    const b = await register(t);
    await befriend(t, a, b);
    let ok = 0;
    // 100 well-paced Speows over ~17 hours all go through (the per-route HTTP limiter is real-time,
    // so the test stays below it).
    for (let i = 0; i < 100; i++) {
      t.clock.advance(10 * 60_000);
      if ((await zynk(t, a, b)).statusCode === 201) ok++;
    }
    expect(ok).toBe(100);
  });

  it('attaches basic reactions for free; premium reactions need Plus, validated on the server', async () => {
    const a = await register(t);
    const b = await register(t);
    await befriend(t, a, b);
    const basic = await zynk(t, a, b, { reactionId: 'basic:fire' });
    expect(basic.json().zynk).toMatchObject({ reactionId: 'basic:fire', reactionFallback: '🔥' });
    t.clock.advance(3000);
    const locked = await zynk(t, a, b, { reactionId: 'y2k:bolt' });
    expect(locked.statusCode).toBe(403);
    expect(locked.json().error).toMatchObject({ code: 'feature_locked', feature: 'premium_emoji_packs' });
    expect((await zynk(t, a, b, { reactionId: 'made:up' })).json().error.code).toBe('unknown_item');
    expect((await zynk(t, a, b, { reactionId: 'not a ref' })).statusCode).toBe(400);
    await grantPlus(t, a);
    const premium = await zynk(t, a, b, { reactionId: 'y2k:bolt' });
    expect(premium.statusCode).toBe(201);
    // A free recipient receives premium content with a fallback glyph.
    const received = (await api(t, b).get('/activity?direction=received')).json().items[0];
    expect(received).toMatchObject({ reactionId: 'y2k:bolt', reactionFallback: '⚡' });
  });

  it('marks Speows as seen (recipient only) and lets the recipient react', async () => {
    const a = await register(t);
    const b = await register(t);
    await befriend(t, a, b);
    const id = (await zynk(t, a, b)).json().zynk.id;
    expect((await api(t, a).post('/activity/seen', { ids: [id] })).json().updated).toBe(0);
    expect((await api(t, b).post('/activity/seen', { ids: [id] })).json().updated).toBe(1);
    expect((await api(t, b).get('/activity')).json().unseenCount).toBe(0);
    const reacted = await api(t, b).put(`/zynks/${id}/reaction`, { reactionId: 'basic:heart' });
    expect(reacted.json().responseReactionId).toBe('basic:heart');
    expect((await api(t, a).put(`/zynks/${id}/reaction`, { reactionId: 'basic:heart' })).statusCode).toBe(404);
    expect((await api(t, b).put(`/zynks/${id}/reaction`, { reactionId: 'moves:spin_star' })).json().error.code).toBe('feature_locked');
    const sent = (await api(t, a).get('/activity?direction=sent')).json().items[0];
    expect(sent.responseReactionFallback).toBe('❤️');
  });

  it('paginates activity', async () => {
    const a = await register(t);
    const b = await register(t);
    await befriend(t, a, b);
    for (let i = 0; i < 5; i++) {
      t.clock.advance(3000);
      await zynk(t, a, b);
    }
    const p1 = (await api(t, b).get('/activity?limit=3')).json();
    expect(p1.items).toHaveLength(3);
    const p2 = (await api(t, b).get(`/activity?limit=3&before=${encodeURIComponent(p1.nextBefore)}`)).json();
    expect(p2.items).toHaveLength(2);
    expect(p2.nextBefore).toBeNull();
  });
});

describe('push notifications', () => {
  it('delivers a push with the resolved sound, and the Speow exists regardless', async () => {
    const a = await register(t, 'pusher');
    const b = await register(t, 'pushee');
    await befriend(t, a, b);
    await addDevice(t, b, 'ExponentPushToken[ios-device-1]', 'ios');
    await addDevice(t, b, 'ExponentPushToken[android-device]', 'android');
    const id = (await zynk(t, a, b, { reactionId: 'basic:wave' })).json().zynk.id;
    await t.app.zynk.push.drain();
    expect(t.push.sent).toHaveLength(2);
    const ios = t.push.sent.find((m) => m.platform === 'ios')!;
    const android = t.push.sent.find((m) => m.platform === 'android')!;
    expect(ios).toMatchObject({ title: 'Speow!', body: 'PUSHER sent you a lime Speow 👋', iosSound: 'zynk_classic.wav', badge: 1 });
    expect(ios.data).toMatchObject({ type: 'zynk', zynkId: id, url: `zynk://activity?zynk=${id}` });
    expect(android.androidChannelId).toBe('zynk_classic');
    expect(JSON.stringify(ios.data)).not.toContain('ExponentPushToken');
    const { rows } = await t.db.query('select push_status from zynks where id = $1', [id]);
    expect(rows[0].push_status).toBe('sent');
  });

  it('respects disabled notifications, mutes and collapsing; the Speow is still in Activity', async () => {
    const a = await register(t);
    const b = await register(t);
    await befriend(t, a, b);
    await addDevice(t, b);

    await api(t, b).patch('/me/preferences', { zynkPush: false });
    await zynk(t, a, b);
    await t.app.zynk.push.drain();
    expect(t.push.sent).toHaveLength(0);

    await api(t, b).patch('/me/preferences', { zynkPush: true });
    await api(t, b).put(`/mutes/${a.id}`);
    t.clock.advance(3000);
    await zynk(t, a, b);
    await t.app.zynk.push.drain();
    expect(t.push.sent).toHaveLength(0);
    expect((await api(t, b).get(`/users/${a.id}`)).json().muted).toBe(true);

    await api(t, b).del(`/mutes/${a.id}`);
    t.clock.advance(3000);
    await zynk(t, a, b);
    t.clock.advance(3000);
    await zynk(t, a, b); // within collapse window
    await t.app.zynk.push.drain();
    expect(t.push.sent).toHaveLength(1);

    const { rows } = await t.db.query('select push_skip_reason from zynks order by created_at');
    expect(rows.map((r) => r.push_skip_reason)).toEqual(['disabled', 'muted', null, 'collapsed']);
    expect((await api(t, b).get('/activity')).json().items).toHaveLength(4);
  });

  it('invalidates device tokens the provider reports as unregistered', async () => {
    const a = await register(t);
    const b = await register(t);
    await befriend(t, a, b);
    await addDevice(t, b);
    t.push.next = () => ({ ok: false, error: 'DeviceNotRegistered', deviceGone: true });
    const id = (await zynk(t, a, b)).json().zynk.id;
    await t.app.zynk.push.drain();
    const { rows } = await t.db.query('select invalidated_at from device_tokens');
    expect(rows[0].invalidated_at).not.toBeNull();
    expect((await t.db.query('select push_status from zynks where id = $1', [id])).rows[0].push_status).toBe('failed');
    // Still visible in-app.
    expect((await api(t, b).get('/activity')).json().items[0].id).toBe(id);
  });

  it('a device token re-registered by another account moves to that account', async () => {
    const a = await register(t);
    const b = await register(t);
    const c = await register(t);
    await befriend(t, a, b);
    const token = await addDevice(t, b);
    await addDevice(t, c, token);
    await zynk(t, a, b);
    await t.app.zynk.push.drain();
    expect(t.push.sent).toHaveLength(0);
  });

  it('works when push is not configured at all', async () => {
    t = (await t.app.close(), await setup({ PUSH_PROVIDER: 'none' }));
    const a = await register(t);
    const b = await register(t);
    await befriend(t, a, b);
    expect((await zynk(t, a, b)).statusCode).toBe(201);
    expect((await api(t, b).get('/activity')).json().unseenCount).toBe(1);
  });

  it('friend request notifications respect preferences', async () => {
    const a = await register(t, 'requester');
    const b = await register(t);
    await addDevice(t, b);
    await api(t, b).patch('/me/preferences', { friendRequestPush: false });
    await api(t, a).post('/friend-requests', { userId: b.id });
    await t.app.zynk.push.drain();
    expect(t.push.sent).toHaveLength(0);
    await api(t, b).patch('/me/preferences', { friendRequestPush: true });
    await api(t, a).post('/friend-requests', { userId: (await register(t)).id });
    const c = await register(t);
    await addDevice(t, c);
    await api(t, a).post('/friend-requests', { userId: c.id });
    await t.app.zynk.push.drain();
    expect(t.push.sent).toHaveLength(1);
    expect(t.push.sent[0]).toMatchObject({ title: 'New friend request', data: { type: 'friend_request' } });
  });
});

describe('push copy', () => {
  it('uses the Speow! brand in notifications', async () => {
    const a = await register(t, 'brandy');
    const b = await register(t, 'brandee');
    await befriend(t, a, b);
    await addDevice(t, b);
    await zynk(t, a, b);
    await t.app.zynk.push.drain();
    expect(t.push.sent[0]).toMatchObject({ title: 'Speow!', body: 'BRANDY sent you a lime Speow!' });
  });
});

describe('Speow colors (free)', () => {
  it('a free user can pick any color per Speow; unknown colors are rejected', async () => {
    const a = await register(t, 'colorful');
    const b = await register(t, 'viewer2');
    await befriend(t, a, b);
    await addDevice(t, b);
    const z = await zynk(t, a, b, { bubbleColorId: 'pink' });
    expect(z.statusCode).toBe(201);
    expect(z.json().zynk.bubbleColorId).toBe('pink');
    await t.app.zynk.push.drain();
    expect(t.push.sent[0]!.body).toBe('COLORFUL sent you a pink Speow!');
    t.clock.advance(3000);
    expect((await zynk(t, a, b, { bubbleColorId: 'gold' })).json().error.code).toBe('unknown_item');
    // The default color is a free preference too.
    expect((await api(t, a).patch('/me/preferences', { bubbleColorId: 'tangerine' })).statusCode).toBe(200);
    expect((await zynk(t, a, b)).json().zynk.bubbleColorId).toBe('tangerine');
  });

  it('writes notifications in the recipient language', async () => {
    const a = await register(t, 'mario');
    const b = await register(t, 'luigi');
    await befriend(t, a, b);
    await addDevice(t, b);
    await api(t, b).patch('/me/preferences', { language: 'it' });
    await zynk(t, a, b, { bubbleColorId: 'purple', reactionId: 'basic:fire' });
    await t.app.zynk.push.drain();
    expect(t.push.sent[0]!.body).toBe('MARIO ti ha mandato uno Speow viola 🔥');
    expect((await api(t, b).get('/me/preferences')).json().selected.language).toBe('it');
    expect((await api(t, b).patch('/me/preferences', { language: 'fr' })).statusCode).toBe(400);
  });
});
