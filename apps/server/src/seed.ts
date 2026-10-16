import { randomUUID } from 'node:crypto';
import type { Db } from './db/pool';
import { hashPassword, newInviteCode } from './lib/crypto';
import { orderPair } from './modules/users/relations';

/** Development-only sample data. Refuses to run in production. */
export async function seed(db: Db, env: string) {
  if (env === 'production') throw new Error('Refusing to seed a production database');
  const password = await hashPassword('zynkzynk');
  const people = [
    ['demo', 'Dee Demo', 'cat', 'lime'],
    ['sam.rivers', 'Sam Rivers', 'robot', 'blue'],
    ['nova_k', 'Nova K', 'alien', 'purple'],
    ['juno', 'Juno', 'frog', 'pink'],
    ['max.power', 'Max', 'dino', 'tangerine'],
    ['lena', 'Lena B', 'owl', 'cloud'],
  ] as const;
  const ids: Record<string, string> = {};
  for (const [username, name, avatarId, avatarColor] of people) {
    const { rows } = await db.query<{ id: string }>(
      `insert into users (username, display_name, password_hash, invite_code, avatar_id, avatar_color) values ($1, $2, $3, $4, $5, $6)
       on conflict (username) do update set display_name = excluded.display_name, avatar_id = excluded.avatar_id,
         avatar_color = excluded.avatar_color returning id`,
      [username, name, password, newInviteCode(), avatarId, avatarColor],
    );
    ids[username] = rows[0]!.id;
    await db.query('insert into preferences (user_id) values ($1) on conflict do nothing', [rows[0]!.id]);
  }
  const me = ids.demo!;
  for (const u of ['sam.rivers', 'nova_k', 'juno']) {
    const [a, b] = orderPair(me, ids[u]!);
    await db.query('insert into friendships (user_a, user_b) values ($1, $2) on conflict do nothing', [a, b]);
  }
  await db.query(
    `insert into friend_requests (from_user_id, to_user_id) values ($1, $2) on conflict do nothing`,
    [ids['max.power'], me],
  );
  const now = Date.now();
  const zynks: [string, string, number, string | null, string, string, string][] = [
    ['sam.rivers', 'demo', 2, 'basic:wave', 'zynk_classic', 'classic', 'lime'],
    ['demo', 'nova_k', 25, null, 'zynk_classic', 'classic', 'lime'],
    ['nova_k', 'demo', 70, 'y2k:alien', 'zynk_laser', 'shockwave', 'purple'],
    ['juno', 'demo', 300, 'basic:fire', 'zynk_classic', 'classic', 'lime'],
    ['demo', 'sam.rivers', 1500, 'basic:heart', 'zynk_classic', 'classic', 'lime'],
  ];
  for (const [from, to, minsAgo, reaction, sound, effect, bubble] of zynks) {
    await db.query(
      `insert into zynks (sender_id, recipient_id, client_nonce, sound_id, effect_id, bubble_color_id, reaction_id, reaction_fallback, created_at, seen_at, push_status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'skipped')`,
      [ids[from], ids[to], randomUUID(), sound, effect, bubble, reaction, reaction ? '✨' : null, new Date(now - minsAgo * 60_000), minsAgo > 60 ? new Date(now - (minsAgo - 5) * 60_000) : null],
    );
  }
  return { users: Object.keys(ids), password: 'zynkzynk' };
}
