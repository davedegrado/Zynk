import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mapRevenueCatSubscriber } from '../src/modules/billing/revenuecat';
import { addDevice, api, befriend, grantPlus, register, setup, zynk, type TestCtx } from './helpers';

let t: TestCtx;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.app.close();
});

const DAY = 86400_000;
const iso = (ms: number) => new Date(ms).toISOString();

function rcSnapshot(t: TestCtx, opts: { expiresInMs: number; refunded?: boolean; unsubscribed?: boolean; billingIssue?: boolean; graceMs?: number }) {
  const now = t.clock.now().getTime();
  const sub = {
    expires_date: iso(now + opts.expiresInMs),
    purchase_date: iso(now - DAY),
    store: 'app_store',
    is_sandbox: true,
    refunded_at: opts.refunded ? iso(now) : null,
    unsubscribe_detected_at: opts.unsubscribed ? iso(now) : null,
    billing_issues_detected_at: opts.billingIssue ? iso(now) : null,
    grace_period_expires_date: opts.graceMs ? iso(now + opts.graceMs) : null,
  };
  return mapRevenueCatSubscriber(
    {
      subscriber: {
        entitlements: {
          plus: { expires_date: sub.expires_date, grace_period_expires_date: sub.grace_period_expires_date, product_identifier: 'zynk_plus_monthly', purchase_date: sub.purchase_date },
        },
        subscriptions: { zynk_plus_monthly: sub },
        management_url: 'https://apps.apple.com/account/subscriptions',
      },
    },
    'plus',
    t.clock.now(),
  );
}

describe('entitlements & feature access', () => {
  it('free users get free items and are refused premium ones server-side', async () => {
    const u = await register(t);
    const prefs = (await api(t, u).get('/me/preferences')).json();
    expect(prefs.effective).toMatchObject({ themeId: 'night', accentId: 'lime', incomingSoundId: 'zynk_classic', effectId: 'classic' });
    expect((await api(t, u).patch('/me/preferences', { themeId: 'daylight', haptics: false })).statusCode).toBe(200);
    for (const [field, id, feature] of [
      ['themeId', 'ultraviolet', 'custom_themes'],
      ['accentId', 'pink', 'custom_themes'],
      ['bubbleColorId', 'purple', 'custom_themes'],
      ['outgoingSoundId', 'zynk_laser', 'custom_sounds'],
      ['incomingSoundId', 'zynk_coin', 'custom_sounds'],
      ['effectId', 'shockwave', 'exclusive_effects'],
    ] as const) {
      const res = await api(t, u).patch('/me/preferences', { [field]: id });
      expect(res.statusCode, field).toBe(403);
      expect(res.json().error).toMatchObject({ code: 'feature_locked', feature });
    }
    expect((await api(t, u).patch('/me/preferences', { themeId: 'nope' })).json().error.code).toBe('unknown_item');
    expect((await api(t, u).patch('/me/preferences', { isPremium: true })).statusCode).toBe(400);
    expect((await api(t, u).get('/me/entitlements')).json()).toEqual({ features: [], entitlements: [], subscription: null });
  });

  it('a verified grant unlocks premium; expiry re-locks it and falls back to defaults', async () => {
    const a = await register(t);
    const b = await register(t);
    await befriend(t, a, b);
    await grantPlus(t, a, 30);
    expect((await api(t, a).get('/me/entitlements')).json().features).toEqual(['custom_sounds', 'custom_themes', 'exclusive_effects', 'premium_emoji_packs']);
    const patch = await api(t, a).patch('/me/preferences', { outgoingSoundId: 'zynk_laser', bubbleColorId: 'pink', effectId: 'shockwave', themeId: 'ultraviolet' });
    expect(patch.statusCode).toBe(200);
    expect((await zynk(t, a, b)).json().zynk).toMatchObject({ soundId: 'zynk_laser', bubbleColorId: 'pink', effectId: 'shockwave' });

    t.clock.advance(31 * DAY);
    const prefs = (await api(t, a).get('/me/preferences')).json();
    expect(prefs.selected).toMatchObject({ outgoingSoundId: 'zynk_laser', themeId: 'ultraviolet' }); // kept for re-subscribe
    expect(prefs.effective).toMatchObject({ outgoingSoundId: 'zynk_classic', themeId: 'night', bubbleColorId: 'lime', effectId: 'classic' });
    // Outgoing Speows no longer carry premium styling, but sending still works.
    const after = await zynk(t, a, b);
    expect(after.json().zynk).toMatchObject({ soundId: 'zynk_classic', bubbleColorId: 'lime', effectId: 'classic' });
    t.clock.advance(3000);
    expect((await zynk(t, a, b, { reactionId: 'y2k:sparkle' })).json().error.code).toBe('feature_locked');
  });

  it('effect combos apply their paired sound only for owners', async () => {
    const a = await register(t);
    const b = await register(t);
    await befriend(t, a, b);
    await grantPlus(t, a);
    const z = await zynk(t, a, b, { effectId: 'zigzag' });
    expect(z.json().zynk).toMatchObject({ effectId: 'zigzag', soundId: 'zynk_thunder' });
  });

  it('a free recipient receives premium content, but their own settings win', async () => {
    const a = await register(t, 'plusser');
    const b = await register(t, 'freebie');
    await befriend(t, a, b);
    await grantPlus(t, a);
    await api(t, a).patch('/me/preferences', { outgoingSoundId: 'zynk_boing', effectId: 'confetti' });
    await addDevice(t, b, 'ExponentPushToken[b-ios]', 'ios');

    await zynk(t, a, b, { reactionId: 'moves:hop_frog' });
    await t.app.zynk.push.drain();
    expect(t.push.sent[0]).toMatchObject({ iosSound: 'zynk_boing.wav', body: 'PLUSSER sent you a Speow 🐸' });
    const received = (await api(t, b).get('/activity')).json().items[0];
    expect(received).toMatchObject({ soundId: 'zynk_boing', effectId: 'confetti', reactionId: 'moves:hop_frog' });

    // Recipient opts out of sender sounds → their own (default) sound.
    await api(t, b).patch('/me/preferences', { allowSenderSounds: false });
    t.clock.advance(15_000);
    await zynk(t, a, b);
    await t.app.zynk.push.drain();
    expect(t.push.sent[1]).toMatchObject({ iosSound: 'zynk_classic.wav' });

    // Recipient disables sounds entirely → silent notification (no sound, silent channel).
    await api(t, b).patch('/me/preferences', { soundsEnabled: false });
    t.clock.advance(15_000);
    await addDevice(t, b, 'ExponentPushToken[b-android]', 'android');
    await zynk(t, a, b);
    await t.app.zynk.push.drain();
    const last = t.push.sent.slice(-2);
    expect(last.find((m) => m.platform === 'ios')!.iosSound).toBeNull();
    expect(last.find((m) => m.platform === 'android')!.androidChannelId).toBe('zynk_silent');
  });

  it('per-friend sounds are a recipient-side Plus feature and stop when it lapses', async () => {
    const a = await register(t);
    const b = await register(t);
    await befriend(t, a, b);
    await addDevice(t, b);
    expect((await api(t, b).put(`/friends/${a.id}/sound`, { soundId: 'zynk_coin' })).json().error.code).toBe('feature_locked');
    await grantPlus(t, b, 1);
    expect((await api(t, b).put(`/friends/${a.id}/sound`, { soundId: 'zynk_coin' })).statusCode).toBe(204);
    expect((await api(t, b).put(`/friends/${a.id}/sound`, { soundId: 'zynk_nope' })).json().error.code).toBe('unknown_item');
    expect((await api(t, b).get(`/users/${a.id}`)).json().friendSoundId).toBe('zynk_coin');
    await zynk(t, a, b);
    await t.app.zynk.push.drain();
    expect(t.push.sent[0]!.iosSound).toBe('zynk_coin.wav');
    t.clock.advance(2 * DAY);
    await zynk(t, a, b);
    await t.app.zynk.push.drain();
    expect(t.push.sent[1]!.iosSound).toBe('zynk_classic.wav');
    const stranger = await register(t);
    expect((await api(t, b).put(`/friends/${stranger.id}/sound`, { soundId: null })).json().error.code).toBe('not_friends');
  });
});

describe('purchase verification', () => {
  it('sync pulls verified state from the provider and unlocks Plus', async () => {
    const u = await register(t);
    t.billing.customers.set(u.id, rcSnapshot(t, { expiresInMs: 30 * DAY }));
    const res = await api(t, u).post('/billing/sync');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      features: ['custom_sounds', 'custom_themes', 'exclusive_effects', 'premium_emoji_packs'],
      subscription: { productId: 'zynk_plus_monthly', status: 'active', willRenew: true, isSandbox: true, store: 'app_store' },
    });
  });

  it('a client cannot unlock Plus without a verified purchase', async () => {
    const u = await register(t);
    const res = await api(t, u).post('/billing/sync', { entitlement: 'plus', receipt: 'trust me' });
    expect(res.json().features).toEqual([]);
    expect((await api(t, u).patch('/me/preferences', { themeId: 'bubblegum' })).statusCode).toBe(403);
  });

  it('handles cancelled, grace-period, expired and refunded subscriptions', async () => {
    const u = await register(t);
    const check = async (snap: ReturnType<typeof rcSnapshot>) => {
      t.billing.customers.set(u.id, snap);
      return (await api(t, u).post('/billing/sync')).json();
    };
    let r = await check(rcSnapshot(t, { expiresInMs: 5 * DAY, unsubscribed: true }));
    expect(r.subscription).toMatchObject({ status: 'cancelled', willRenew: false });
    expect(r.features).toHaveLength(4); // still paid up until expiry

    r = await check(rcSnapshot(t, { expiresInMs: -DAY, billingIssue: true, graceMs: 6 * DAY }));
    expect(r.subscription.status).toBe('in_grace');
    expect(r.features).toHaveLength(4);

    r = await check(rcSnapshot(t, { expiresInMs: -DAY }));
    expect(r.subscription.status).toBe('expired');
    expect(r.features).toEqual([]);

    r = await check(rcSnapshot(t, { expiresInMs: 20 * DAY, refunded: true }));
    expect(r.subscription.status).toBe('refunded');
    expect(r.features).toEqual([]);
  });

  it('expires on time even without a new sync', async () => {
    const u = await register(t);
    t.billing.customers.set(u.id, rcSnapshot(t, { expiresInMs: DAY }));
    await api(t, u).post('/billing/sync');
    t.clock.advance(DAY + 1000);
    expect((await api(t, u).get('/me/entitlements')).json().features).toEqual([]);
  });

  it('webhooks require the shared secret, are idempotent, and re-fetch state', async () => {
    const u = await register(t);
    const payload = { event: { id: 'evt_1', type: 'INITIAL_PURCHASE', app_user_id: u.id } };
    const bad = await t.app.inject({ method: 'POST', url: '/webhooks/revenuecat', payload, headers: { authorization: 'wrong' } });
    expect(bad.statusCode).toBe(401);

    t.billing.customers.set(u.id, rcSnapshot(t, { expiresInMs: 30 * DAY }));
    const ok = await t.app.inject({ method: 'POST', url: '/webhooks/revenuecat', payload, headers: { authorization: 'whsec_test_value' } });
    expect(ok.statusCode).toBe(200);
    expect((await api(t, u).get('/me/entitlements')).json().features).toHaveLength(4);

    // Replays are ignored; a refund event revokes.
    const replay = await t.app.inject({ method: 'POST', url: '/webhooks/revenuecat', payload, headers: { authorization: 'whsec_test_value' } });
    expect(replay.json().duplicate).toBe(true);
    t.billing.customers.set(u.id, rcSnapshot(t, { expiresInMs: 30 * DAY, refunded: true }));
    await t.app.inject({
      method: 'POST', url: '/webhooks/revenuecat', headers: { authorization: 'Bearer whsec_test_value' },
      payload: { event: { id: 'evt_2', type: 'CANCELLATION', app_user_id: u.id } },
    });
    expect((await api(t, u).get('/me/entitlements')).json().features).toEqual([]);
  });

  it('webhook failures are retried by the provider (non-2xx) and unknown users are ignored', async () => {
    const u = await register(t);
    t.billing.fail = true;
    const res = await t.app.inject({ method: 'POST', url: '/webhooks/revenuecat', headers: { authorization: 'whsec_test_value' }, payload: { event: { id: 'evt_f', type: 'RENEWAL', app_user_id: u.id } } });
    expect(res.statusCode).toBe(500);
    t.billing.fail = false;
    const retry = await t.app.inject({ method: 'POST', url: '/webhooks/revenuecat', headers: { authorization: 'whsec_test_value' }, payload: { event: { id: 'evt_f', type: 'RENEWAL', app_user_id: u.id } } });
    expect(retry.statusCode).toBe(200);
    const anon = await t.app.inject({ method: 'POST', url: '/webhooks/revenuecat', headers: { authorization: 'whsec_test_value' }, payload: { event: { id: 'evt_a', type: 'TEST', app_user_id: '$RCAnonymousID:abc' } } });
    expect(anon.statusCode).toBe(200);
  });

  it('a provider outage does not break the app for anyone', async () => {
    const u = await register(t);
    const v = await register(t);
    await befriend(t, u, v);
    t.billing.fail = true;
    expect((await api(t, u).post('/billing/sync')).json().error.code).toBe('purchases_unavailable');
    expect((await zynk(t, u, v)).statusCode).toBe(201);
  });

  it('with purchases unconfigured, plans report disabled and free use continues', async () => {
    t = (await t.app.close(), await setup({}, { billing: false }));
    const u = await register(t);
    const plans = (await api(t, u).get('/billing/plans')).json();
    expect(plans.purchasesEnabled).toBe(false);
    expect(plans.plans.map((p: { fallbackPrice: { display: string } }) => p.fallbackPrice.display)).toEqual(['€1.99', '€14.99']);
    expect((await api(t, u).post('/billing/sync')).statusCode).toBe(503);
    const wh = await t.app.inject({ method: 'POST', url: '/webhooks/revenuecat', headers: { authorization: 'whsec_test_value' }, payload: { event: { id: 'x', type: 'TEST' } } });
    expect(wh.statusCode).toBe(503);
  });

  it('plans and prices are configurable', async () => {
    t = (await t.app.close(), await setup({
      PLANS_JSON: JSON.stringify([{ id: 'plus_m', productIds: { ios: 'a', android: 'b' }, period: 'P1M', entitlement: 'plus', fallbackPrice: { amount: 2.49, currency: 'EUR', display: '€2.49' } }]),
      PROMO_MESSAGE: 'Launch week: first month on us',
    }));
    const u = await register(t);
    const plans = (await api(t, u).get('/billing/plans')).json();
    expect(plans.plans).toHaveLength(1);
    expect(plans.promoMessage).toBe('Launch week: first month on us');
  });

  it('revoked promo grants stop unlocking features', async () => {
    const u = await register(t);
    await grantPlus(t, u, null);
    expect((await api(t, u).get('/me/entitlements')).json().entitlements).toEqual([{ id: 'plus', source: 'promo', expiresAt: null }]);
    await t.app.inject({ method: 'DELETE', url: `/admin/users/${u.id}/grants/qa`, headers: { 'x-admin-token': 'admin-token-for-tests-0123456789' } });
    expect((await api(t, u).get('/me/entitlements')).json().features).toEqual([]);
  });
});
