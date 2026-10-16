import type { Queryable } from '../../db/pool';
import { newSessionToken, sha256 } from '../../lib/crypto';

export async function createSession(db: Queryable, userId: string, ttlMs: number, now: Date) {
  const token = newSessionToken();
  const { rows } = await db.query<{ id: string }>(
    `insert into sessions (user_id, token_hash, created_at, last_used_at, expires_at)
     values ($1, $2, $3, $3, $4) returning id`,
    [userId, sha256(token), now, new Date(now.getTime() + ttlMs)],
  );
  return { token, sessionId: rows[0]!.id };
}

export interface SessionLookup {
  sessionId: string;
  userId: string;
  status: string;
  lastUsedAt: Date;
}

export async function findSession(db: Queryable, token: string, now: Date): Promise<SessionLookup | null> {
  const { rows } = await db.query<{ session_id: string; user_id: string; status: string; last_used_at: Date }>(
    `select s.id as session_id, s.user_id, u.status, s.last_used_at
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > $2`,
    [sha256(token), now],
  );
  const r = rows[0];
  return r ? { sessionId: r.session_id, userId: r.user_id, status: r.status, lastUsedAt: r.last_used_at } : null;
}

/** Sliding expiry, written at most once per hour per session. */
export async function touchSession(db: Queryable, s: SessionLookup, ttlMs: number, now: Date) {
  if (now.getTime() - s.lastUsedAt.getTime() < 3600_000) return;
  await db.query('update sessions set last_used_at = $2, expires_at = $3 where id = $1', [
    s.sessionId,
    now,
    new Date(now.getTime() + ttlMs),
  ]);
}
