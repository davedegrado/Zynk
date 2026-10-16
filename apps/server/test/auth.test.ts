import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { api, register, setup, type TestCtx } from './helpers';

let t: TestCtx;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.app.close();
});

describe('authentication', () => {
  it('registers, logs in and returns the profile', async () => {
    const u = await register(t, 'Sam.Rivers');
    expect(u.username).toBe('sam.rivers');
    expect(u.token).toMatch(/^zk_/);
    const login = await api(t, null).post('/auth/login', { username: 'SAM.RIVERS', password: 'correct horse battery' });
    expect(login.statusCode).toBe(200);
    const me = await api(t, { ...u, token: login.json().token }).get('/me');
    expect(me.json()).toMatchObject({ username: 'sam.rivers', displayName: 'SAM.RIVERS', avatar: { id: expect.any(String), color: expect.any(String) } });
  });

  it('never stores plaintext passwords or raw tokens', async () => {
    const u = await register(t, 'hashy');
    const { rows } = await t.db.query('select password_hash from users where id = $1', [u.id]);
    expect(rows[0].password_hash).toMatch(/^scrypt\$/);
    expect(rows[0].password_hash).not.toContain('correct horse');
    const s = await t.db.query('select token_hash from sessions where user_id = $1', [u.id]);
    expect(Buffer.isBuffer(s.rows[0].token_hash)).toBe(true);
    expect(s.rows[0].token_hash.toString()).not.toContain(u.token);
  });

  it('enforces unique usernames (case-insensitive) and validation', async () => {
    await register(t, 'taken');
    const dup = await api(t, null).post('/auth/register', { username: 'TAKEN', displayName: 'x', password: 'password123' });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('username_taken');
    const bad = await api(t, null).post('/auth/register', { username: 'a!', displayName: '', password: 'short' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('validation_failed');
  });

  it('rejects wrong passwords with a generic error and throttles repeated failures', async () => {
    await register(t, 'victim');
    const wrong = await api(t, null).post('/auth/login', { username: 'victim', password: 'nope-nope' });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json().error.code).toBe('invalid_credentials');
    const unknown = await api(t, null).post('/auth/login', { username: 'ghost', password: 'nope-nope' });
    expect(unknown.json().error.code).toBe('invalid_credentials');
    for (let i = 0; i < 5; i++) await api(t, null).post('/auth/login', { username: 'victim', password: 'nope-nope' });
    const locked = await api(t, null).post('/auth/login', { username: 'victim', password: 'correct horse battery' });
    expect(locked.statusCode).toBe(429);
  });

  it('logout revokes the session and its device tokens', async () => {
    const u = await register(t, 'leaver');
    await api(t, u).post('/devices', { token: 'ExponentPushToken[abcdefghijk]', platform: 'android' });
    expect((await api(t, u).post('/auth/logout')).statusCode).toBe(204);
    expect((await api(t, u).get('/me')).statusCode).toBe(401);
    const { rowCount } = await t.db.query('select 1 from device_tokens');
    expect(rowCount).toBe(0);
  });

  it('expired sessions are rejected', async () => {
    const u = await register(t, 'sleepy');
    t.clock.advance(61 * 24 * 3600 * 1000);
    expect((await api(t, u).get('/me')).statusCode).toBe(401);
  });

  it('changing password signs out other sessions', async () => {
    const u = await register(t, 'rotator');
    const other = (await api(t, null).post('/auth/login', { username: 'rotator', password: 'correct horse battery' })).json().token;
    const res = await api(t, u).post('/me/password', { currentPassword: 'correct horse battery', newPassword: 'new password 42' });
    expect(res.statusCode).toBe(204);
    expect((await api(t, { ...u, token: other }).get('/me')).statusCode).toBe(401);
    expect((await api(t, u).get('/me')).statusCode).toBe(200);
  });

  it('requires authentication on protected routes', async () => {
    for (const [method, url] of [['GET', '/me'], ['GET', '/friends'], ['POST', '/zynks'], ['GET', '/activity'], ['PATCH', '/me/preferences'], ['POST', '/billing/sync'], ['GET', '/me/entitlements']] as const) {
      const res = await t.app.inject({ method, url, payload: {} });
      expect(res.statusCode, url).toBe(401);
    }
    const forged = await t.app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer zk_forged' } });
    expect(forged.statusCode).toBe(401);
  });
});

describe('profiles', () => {
  it('edits display name and username', async () => {
    const u = await register(t, 'editor');
    await register(t, 'other');
    const ok = await api(t, u).patch('/me', { displayName: '  Ed  ', username: 'ed_itor' });
    expect(ok.json()).toMatchObject({ displayName: 'Ed', username: 'ed_itor' });
    const clash = await api(t, u).patch('/me', { username: 'other' });
    expect(clash.json().error.code).toBe('username_taken');
  });

  it('gives new users a valid random avatar, or the one they picked', async () => {
    const u = await register(t, 'randy');
    const me = (await api(t, u).get('/me')).json();
    const { AVATARS, AVATAR_COLORS } = await import('@zynk/shared');
    expect(AVATARS).toContain(me.avatar.id);
    expect(AVATAR_COLORS.map((c) => c.id)).toContain(me.avatar.color);
    const picked = await api(t, null).post('/auth/register', { username: 'picky', displayName: 'P', password: 'password123', avatar: { id: 'frog', color: 'pink' } });
    expect(picked.json().user.avatar).toEqual({ id: 'frog', color: 'pink' });
    const bad = await api(t, null).post('/auth/register', { username: 'baddy', displayName: 'B', password: 'password123', avatar: { id: 'selfie', color: 'pink' } });
    expect(bad.json().error.code).toBe('unknown_item');
  });

  it('lets users change avatar (free) and shows it to others; photo uploads are gone', async () => {
    const u = await register(t, 'changer');
    const v = await register(t, 'looker');
    const res = await api(t, u).patch('/me', { avatar: { id: 'robot', color: 'ink' } });
    expect(res.json().avatar).toEqual({ id: 'robot', color: 'ink' });
    expect((await api(t, v).get(`/users/${u.id}`)).json().avatar).toEqual({ id: 'robot', color: 'ink' });
    expect((await api(t, u).patch('/me', { avatar: { id: 'robot', color: 'gold' } })).json().error.code).toBe('unknown_item');
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    const up = await t.app.inject({ method: 'PUT', url: '/me/avatar', payload: jpeg, headers: { authorization: `Bearer ${u.token}`, 'content-type': 'image/jpeg' } });
    expect(up.statusCode).toBe(404);
  });

  it('does not leak private fields in public profiles', async () => {
    const a = await register(t, 'alice');
    const b = await register(t, 'bob');
    const res = await api(t, b).get(`/users/${a.id}`);
    const body = res.json();
    expect(body).not.toHaveProperty('inviteCode');
    expect(body).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(body)).not.toMatch(/password|token|status/i);
  });
});

describe('cors', () => {
  it('allows every API method from configured origins only', async () => {
    t = (await t.app.close(), await setup({ CORS_ORIGINS: 'https://app.example' }));
    const ok = await t.app.inject({ method: 'OPTIONS', url: '/me/preferences', headers: { origin: 'https://app.example', 'access-control-request-method': 'PATCH' } });
    expect(ok.headers['access-control-allow-origin']).toBe('https://app.example');
    expect(String(ok.headers['access-control-allow-methods'])).toContain('PATCH');
    const bad = await t.app.inject({ method: 'OPTIONS', url: '/me', headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' } });
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('rate limiting', () => {
  it('cannot be bypassed by sending random Authorization headers', async () => {
    t = (await t.app.close(), await setup({ AUTH_MAX_PER_MINUTE: '3' }));
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await t.app.inject({ method: 'POST', url: '/auth/login', payload: { username: 'x', password: 'y' }, headers: { authorization: `Bearer zk_fake_${i}_${'a'.repeat(30)}` } });
      codes.push(res.statusCode);
    }
    expect(codes.filter((c) => c === 429).length).toBeGreaterThanOrEqual(2);
  });
});

describe('hosting config', () => {
  it('derives PUBLIC_URL from Railway when not set explicitly', async () => {
    const { loadConfig } = await import('../src/config');
    expect(loadConfig({ DATABASE_URL: 'x', RAILWAY_PUBLIC_DOMAIN: 'speow.up.railway.app' }).publicUrl).toBe('https://speow.up.railway.app');
    expect(loadConfig({ DATABASE_URL: 'x', RAILWAY_PUBLIC_DOMAIN: 'a.b', PUBLIC_URL: 'https://speow.app' }).publicUrl).toBe('https://speow.app');
    expect(loadConfig({ DATABASE_URL: 'x', RENDER_EXTERNAL_URL: 'https://speow-api.onrender.com' }).publicUrl).toBe('https://speow-api.onrender.com');
  });
});
