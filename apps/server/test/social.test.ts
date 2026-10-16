import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api, befriend, register, setup, zynk, type TestCtx } from './helpers';

let t: TestCtx;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.app.close();
});

describe('friends', () => {
  it('search by username prefix, request, accept, list, remove', async () => {
    const a = await register(t, 'anna');
    const b = await register(t, 'annabel');
    const search = await api(t, a).get('/users/search?q=ANNA');
    expect(search.json().users.map((u: { username: string }) => u.username)).toEqual(['annabel']);
    expect(search.json().users[0].relationship).toBe('none');

    const req = await api(t, a).post('/friend-requests', { userId: b.id });
    expect(req.statusCode).toBe(201);
    expect(req.json().relationship).toBe('request_sent');
    expect(t.push.sent).toHaveLength(0); // b has no devices

    const inbox = (await api(t, b).get('/friend-requests')).json();
    expect(inbox.incoming).toHaveLength(1);
    expect(inbox.incoming[0].user.username).toBe('anna');
    const accepted = await api(t, b).post(`/friend-requests/${inbox.incoming[0].id}/accept`);
    expect(accepted.json().relationship).toBe('friend');

    const friends = (await api(t, a).get('/friends')).json().friends;
    expect(friends.map((f: { username: string }) => f.username)).toEqual(['annabel']);

    expect((await api(t, a).del(`/friends/${b.id}`)).statusCode).toBe(204);
    expect((await api(t, b).get('/friends')).json().friends).toHaveLength(0);
  });

  it('only the recipient can accept; rejected requests do not create friendships', async () => {
    const a = await register(t);
    const b = await register(t);
    const c = await register(t);
    const id = (await api(t, a).post('/friend-requests', { userId: b.id })).json().pendingRequestId;
    expect((await api(t, c).post(`/friend-requests/${id}/accept`)).statusCode).toBe(404);
    expect((await api(t, a).post(`/friend-requests/${id}/accept`)).statusCode).toBe(404);
    expect((await api(t, b).post(`/friend-requests/${id}/reject`)).statusCode).toBe(204);
    expect((await api(t, a).get(`/users/${b.id}`)).json().relationship).toBe('none');
  });

  it('duplicate requests are idempotent and mutual requests auto-accept', async () => {
    const a = await register(t);
    const b = await register(t);
    await api(t, a).post('/friend-requests', { userId: b.id });
    const again = await api(t, a).post('/friend-requests', { userId: b.id });
    expect(again.statusCode).toBe(200);
    expect((await t.db.query(`select 1 from friend_requests where status = 'pending'`)).rowCount).toBe(1);
    const back = await api(t, b).post('/friend-requests', { userId: a.id });
    expect(back.json().relationship).toBe('friend');
  });

  it('invite links resolve to a profile and can be used to send a request', async () => {
    const a = await register(t, 'inviter');
    const b = await register(t, 'invitee');
    const invite = (await api(t, a).get('/me/invite')).json();
    expect(invite.url).toMatch(/\/i\/[A-Za-z0-9]{10}$/);
    expect((await api(t, b).get(`/invites/${invite.code}`)).json().username).toBe('inviter');
    expect((await api(t, b).post('/friend-requests', { inviteCode: invite.code })).json().relationship).toBe('request_sent');
    const rotated = (await api(t, a).post('/me/invite/rotate')).json();
    expect(rotated.code).not.toBe(invite.code);
    expect((await api(t, b).get(`/invites/${invite.code}`)).statusCode).toBe(404);
    const page = await t.app.inject({ method: 'GET', url: `/i/${rotated.code}` });
    expect(page.body).toContain(`zynk://invite/${rotated.code}`);
  });

  it('rate-limits friend request spam', async () => {
    t = (await t.app.close(), await setup({ FRIEND_REQUESTS_MAX_PER_HOUR: '2' }));
    const a = await register(t);
    for (let i = 0; i < 2; i++) expect((await api(t, a).post('/friend-requests', { userId: (await register(t)).id })).statusCode).toBe(201);
    const third = await api(t, a).post('/friend-requests', { userId: (await register(t)).id });
    expect(third.statusCode).toBe(429);
  });
});

describe('blocking, muting and reporting', () => {
  it('blocking removes the friendship, hides the user, and blocks all interaction via the API', async () => {
    const a = await register(t, 'blocker');
    const b = await register(t, 'blockee');
    await befriend(t, a, b);
    await zynk(t, b, a);
    expect((await api(t, a).post('/blocks', { userId: b.id })).statusCode).toBe(204);

    expect((await api(t, a).get('/friends')).json().friends).toHaveLength(0);
    // The blocked user can't find, view, request or Zynk the blocker.
    expect((await api(t, b).get('/users/search?q=block')).json().users).toHaveLength(0);
    expect((await api(t, b).get(`/users/${a.id}`)).statusCode).toBe(404);
    expect((await api(t, b).post('/friend-requests', { userId: a.id })).statusCode).toBe(404);
    const z = await zynk(t, b, a);
    expect(z.statusCode).toBe(403);
    expect(z.json().error.code).toBe('not_friends');
    // Past Zynks from the blocked user disappear from Activity.
    expect((await api(t, a).get('/activity')).json().items).toHaveLength(0);
    // The blocker sees "blocked" and can unblock.
    expect((await api(t, a).get(`/users/${b.id}`)).json().relationship).toBe('blocked');
    expect((await api(t, a).get('/blocks')).json().users[0].id).toBe(b.id);
    await api(t, a).del(`/blocks/${b.id}`);
    expect((await api(t, b).get(`/users/${a.id}`)).json().relationship).toBe('none');
  });

  it('reports are stored with a snapshot, deduplicated, and can also block', async () => {
    const a = await register(t, 'reporter');
    const b = await register(t, 'spammer');
    await befriend(t, a, b);
    const zid = (await zynk(t, b, a)).json().zynk.id;
    const r = await api(t, a).post('/reports', { userId: b.id, zynkId: zid, reason: 'spam', alsoBlock: true });
    expect(r.statusCode).toBe(201);
    await api(t, a).post('/reports', { userId: b.id, reason: 'harassment' });
    const { rows } = await t.db.query('select reason, reported_username, zynk_id from reports');
    expect(rows).toEqual([{ reason: 'harassment', reported_username: 'spammer', zynk_id: zid }]);
    expect((await api(t, a).get(`/users/${b.id}`)).json().relationship).toBe('blocked');
    // Users can't see moderation data.
    expect((await api(t, a).get('/admin/reports')).statusCode).toBe(401);
  });

  it('cannot attach someone else\'s Zynk to a report', async () => {
    const [a, b, c] = [await register(t), await register(t), await register(t)];
    await befriend(t, b, c);
    const zid = (await zynk(t, b, c)).json().zynk.id;
    expect((await api(t, a).post('/reports', { userId: b.id, zynkId: zid, reason: 'spam' })).statusCode).toBe(404);
  });

  it('moderators can suspend a reported user, which revokes their sessions', async () => {
    const a = await register(t);
    const b = await register(t);
    await api(t, a).post('/reports', { userId: b.id, reason: 'harassment' });
    const headers = { 'x-admin-token': 'admin-token-for-tests-0123456789' };
    const list = await t.app.inject({ method: 'GET', url: '/admin/reports', headers });
    const id = list.json().reports[0].id;
    const act = await t.app.inject({ method: 'POST', url: `/admin/reports/${id}/action`, headers, payload: { action: 'suspend', actor: 'mod@zynk' } });
    expect(act.statusCode).toBe(200);
    expect((await api(t, b).get('/me')).statusCode).toBe(401);
    const login = await api(t, null).post('/auth/login', { username: b.username, password: 'correct horse battery' });
    expect(login.json().error.code).toBe('account_suspended');
  });
});

describe('request spam after rejection', () => {
  it('does not push-notify again after the recipient declined', async () => {
    const a = await register(t);
    const b = await register(t);
    const { addDevice } = await import('./helpers');
    await addDevice(t, b);
    const id = (await api(t, a).post('/friend-requests', { userId: b.id })).json().pendingRequestId;
    await api(t, b).post(`/friend-requests/${id}/reject`);
    await api(t, a).post('/friend-requests', { userId: b.id });
    await t.app.zynk.push.drain();
    expect(t.push.sent).toHaveLength(1);
  });
});
