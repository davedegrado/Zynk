import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runRetention } from '../src/jobs/retention';
import { addDevice, api, befriend, grantPlus, register, setup, zynk, type TestCtx } from './helpers';

let t: TestCtx;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.app.close();
});

describe('account deletion', () => {
  it('requires the password and removes all personal data', async () => {
    const a = await register(t, 'deleteme');
    const b = await register(t, 'friend');
    await befriend(t, a, b);
    await addDevice(t, a);
    await zynk(t, a, b);
    await zynk(t, b, a);
    await grantPlus(t, a);
    await api(t, b).post('/reports', { userId: a.id, reason: 'spam' });

    expect((await api(t, a).del('/me', { password: 'wrong password' })).statusCode).toBe(401);
    expect((await api(t, a).del('/me', { password: 'correct horse battery' })).statusCode).toBe(204);

    for (const table of ['users where id = $1', 'sessions where user_id = $1', 'device_tokens where user_id = $1', 'zynks where sender_id = $1 or recipient_id = $1', 'entitlement_grants where user_id = $1', 'preferences where user_id = $1']) {
      expect((await t.db.query(`select 1 from ${table}`, [a.id])).rowCount, table).toBe(0);
    }
    expect((await t.db.query('select 1 from friendships')).rowCount).toBe(0);
    // Moderation history survives without the account.
    const { rows } = await t.db.query('select reported_user_id, reported_username from reports');
    expect(rows).toEqual([{ reported_user_id: null, reported_username: 'deleteme' }]);
    expect(t.billing.deleted).toEqual([a.id]);
    expect((await api(t, a).get('/me')).statusCode).toBe(401);
    expect((await api(t, b).get('/friends')).json().friends).toHaveLength(0);
    // Username becomes available again.
    expect((await api(t, null).post('/auth/register', { username: 'deleteme', displayName: 'New', password: 'password123' })).statusCode).toBe(201);
  });
});

describe('retention', () => {
  it('deletes old Zynks and expired sessions', async () => {
    const a = await register(t);
    const b = await register(t);
    await befriend(t, a, b);
    await zynk(t, a, b);
    const later = new Date(t.clock.now().getTime() + 200 * 86400_000);
    const r = await runRetention(t.db, { zynkDays: 180 }, later);
    expect(r.zynks).toBe(1);
    expect(r.sessions).toBeGreaterThanOrEqual(2);
  });
});
