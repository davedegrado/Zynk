import type { Db } from '../db/pool';

export interface RetentionResult {
  zynks: number;
  sessions: number;
  devices: number;
  billingEvents: number;
  friendRequests: number;
}

/** Deletes data we no longer need. Safe to run repeatedly and concurrently. */
export async function runRetention(db: Db, opts: { zynkDays: number }, now = new Date()): Promise<RetentionResult> {
  const count = async (sql: string, params: unknown[]) => (await db.query(sql, params)).rowCount ?? 0;
  const zynks = opts.zynkDays > 0
    ? await count(`delete from zynks where created_at < $1::timestamptz - make_interval(days => $2)`, [now, opts.zynkDays])
    : 0;
  const sessions = await count('delete from sessions where expires_at < $1', [now]);
  const devices = await count(`delete from device_tokens where invalidated_at < $1::timestamptz - interval '30 days'`, [now]);
  const billingEvents = await count(`delete from billing_events where processed_at < $1::timestamptz - interval '90 days'`, [now]);
  const friendRequests = await count(
    `delete from friend_requests where status <> 'pending' and responded_at < $1::timestamptz - interval '90 days'`,
    [now],
  );
  await db.query(`delete from push_tickets where created_at < $1::timestamptz - interval '1 day'`, [now]);
  return { zynks, sessions, devices, billingEvents, friendRequests };
}
