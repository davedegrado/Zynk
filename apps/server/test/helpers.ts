import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { migrate } from '../src/db/migrate';
import { createPool, type Db } from '../src/db/pool';
import type { BillingProvider, CustomerSnapshot } from '../src/modules/billing/provider';
import { LogPushProvider, type PushMessage, type PushResult } from '../src/modules/push/provider';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54329/zynk_test';

export class FakePush extends LogPushProvider {
  next: ((m: PushMessage) => PushResult) | null = null;
  override async send(messages: PushMessage[]): Promise<PushResult[]> {
    const results = await super.send(messages);
    return this.next ? messages.map(this.next) : results;
  }
}

export class FakeBilling implements BillingProvider {
  readonly name = 'revenuecat' as const;
  customers = new Map<string, CustomerSnapshot>();
  deleted: string[] = [];
  fail = false;
  async getCustomer(userId: string): Promise<CustomerSnapshot> {
    if (this.fail) throw new Error('provider down');
    return this.customers.get(userId) ?? { subscriptions: [], entitlement: null, managementUrl: null };
  }
  async deleteCustomer(userId: string) {
    this.deleted.push(userId);
  }
}

export class Clock {
  t = new Date('2026-10-16T12:00:00.000Z').getTime();
  now = () => new Date(this.t);
  advance(ms: number) {
    this.t += ms;
  }
}

let sharedDb: Db | null = null;
let migrated = false;

export async function getDb(): Promise<Db> {
  sharedDb ??= createPool(TEST_DATABASE_URL);
  if (!migrated) {
    await migrate(sharedDb);
    migrated = true;
  }
  return sharedDb;
}

export async function resetDb(db: Db) {
  const { rows } = await db.query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public' and tablename <> 'schema_migrations'`,
  );
  await db.query(`truncate ${rows.map((r) => `"${r.tablename}"`).join(', ')} cascade`);
}

export interface TestCtx {
  app: FastifyInstance;
  db: Db;
  push: FakePush;
  billing: FakeBilling;
  clock: Clock;
}

export async function setup(env: Record<string, string> = {}, opts: { billing?: boolean } = {}): Promise<TestCtx> {
  const db = await getDb();
  await resetDb(db);
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    LOG_LEVEL: 'silent',
    AUTH_MAX_PER_MINUTE: '1000',
    REVENUECAT_WEBHOOK_AUTH: 'whsec_test_value',
    ADMIN_API_TOKEN: 'admin-token-for-tests-0123456789',
    ...env,
  });
  const push = new FakePush();
  const billing = new FakeBilling();
  const clock = new Clock();
  const app = await buildApp({
    config,
    db,
    pushProvider: push,
    billing: opts.billing === false ? null : billing,
    now: clock.now,
    logger: false,
  });
  await app.ready();
  return { app, db, push, billing, clock };
}

export interface TestUser {
  id: string;
  username: string;
  token: string;
}

let counter = 0;
export async function register(t: TestCtx, username?: string, password = 'correct horse battery'): Promise<TestUser> {
  const name = username ?? `user${++counter}${Math.floor(Math.random() * 1000)}`;
  const res = await t.app.inject({ method: 'POST', url: '/auth/register', payload: { username: name, displayName: name.toUpperCase(), password } });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.body}`);
  const body = res.json();
  return { id: body.user.id, username: body.user.username, token: body.token };
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export function api(t: TestCtx, user: TestUser | null) {
  const call = (method: Method, url: string, payload?: unknown) =>
    t.app.inject({
      method,
      url,
      payload: payload as never,
      headers: user ? { authorization: `Bearer ${user.token}` } : {},
    });
  return {
    get: (url: string) => call('GET', url),
    post: (url: string, payload?: unknown) => call('POST', url, payload ?? {}),
    put: (url: string, payload?: unknown) => call('PUT', url, payload ?? {}),
    patch: (url: string, payload?: unknown) => call('PATCH', url, payload ?? {}),
    del: (url: string, payload?: unknown) => call('DELETE', url, payload),
  };
}

export async function befriend(t: TestCtx, a: TestUser, b: TestUser) {
  const r1 = await api(t, a).post('/friend-requests', { userId: b.id });
  if (r1.statusCode >= 300) throw new Error(r1.body);
  const r2 = await api(t, b).post('/friend-requests', { userId: a.id });
  if (r2.json().relationship !== 'friend') throw new Error(`not friends: ${r2.body}`);
}

export async function zynk(t: TestCtx, from: TestUser, to: TestUser, extra: Record<string, unknown> = {}) {
  return api(t, from).post('/zynks', { recipientId: to.id, clientNonce: randomUUID(), ...extra });
}

export async function addDevice(t: TestCtx, user: TestUser, token = `ExponentPushToken[${randomUUID()}]`, platform = 'ios') {
  const res = await api(t, user).post('/devices', { token, platform });
  if (res.statusCode !== 204) throw new Error(res.body);
  return token;
}

export async function grantPlus(t: TestCtx, user: TestUser, days: number | null = 30) {
  const res = await t.app.inject({
    method: 'POST',
    url: `/admin/users/${user.id}/grants`,
    headers: { 'x-admin-token': 'admin-token-for-tests-0123456789' },
    payload: { entitlement: 'plus', days, ref: 'qa' },
  });
  if (res.statusCode !== 200) throw new Error(res.body);
}
