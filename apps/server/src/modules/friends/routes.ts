import type { FastifyInstance } from 'fastify';
import {
  friendRequestCreateSchema,
  userIdParam,
  type FriendRequestsResponse,
  type FriendSummary,
} from '@zynk/shared';
import { authOf, type AppContext } from '../../context';
import { withTransaction, type Queryable } from '../../db/pool';
import { ApiError, notFound } from '../../lib/errors';
import { parse } from '../../lib/validate';
import { loadProfile } from '../users/routes';
import { pickPublic, publicCols, PUBLIC_USER_COLS, toPublicUser, type UserRow } from '../users/model';
import { areFriends, isBlockedEitherWay, notBlockedSql, orderPair } from '../users/relations';

export async function makeFriends(tx: Queryable, a: string, b: string) {
  const [x, y] = orderPair(a, b);
  await tx.query('insert into friendships (user_a, user_b) values ($1, $2) on conflict do nothing', [x, y]);
}

export async function removeFriendship(tx: Queryable, a: string, b: string) {
  const [x, y] = orderPair(a, b);
  await tx.query('delete from friendships where user_a = $1 and user_b = $2', [x, y]);
  await tx.query('delete from friend_sounds where (user_id = $1 and friend_id = $2) or (user_id = $2 and friend_id = $1)', [a, b]);
  await tx.query(
    `update friend_requests set status = 'cancelled', responded_at = now()
      where status = 'pending' and ((from_user_id = $1 and to_user_id = $2) or (from_user_id = $2 and to_user_id = $1))`,
    [a, b],
  );
}

export function friendRoutes(app: FastifyInstance, ctx: AppContext) {
  const auth = { preHandler: ctx.requireAuth };

  app.get('/friends', auth, async (req) => {
    const me = authOf(req).userId;
    const { rows } = await ctx.db.query<
      UserRow & { friend_since: Date; muted: boolean; friend_sound_id: string | null; last_zynk_at: Date | null; unseen: number }
    >(
      `select ${PUBLIC_USER_COLS}, f.created_at as friend_since,
              exists (select 1 from mutes m where m.user_id = $1 and m.muted_id = u.id) as muted,
              (select sound_id from friend_sounds fs where fs.user_id = $1 and fs.friend_id = u.id) as friend_sound_id,
              (select max(z.created_at) from zynks z
                 where (z.sender_id = $1 and z.recipient_id = u.id) or (z.sender_id = u.id and z.recipient_id = $1)) as last_zynk_at,
              (select count(*) from zynks z where z.sender_id = u.id and z.recipient_id = $1 and z.seen_at is null) as unseen
         from friendships f
         join users u on u.id = case when f.user_a = $1 then f.user_b else f.user_a end
        where (f.user_a = $1 or f.user_b = $1) and u.status = 'active'
        order by last_zynk_at desc nulls last, u.display_name`,
      [me],
    );
    const friends: FriendSummary[] = rows.map((r) => ({
      ...toPublicUser(r),
      friendSince: r.friend_since.toISOString(),
      muted: r.muted,
      friendSoundId: r.friend_sound_id,
      lastZynkAt: r.last_zynk_at?.toISOString() ?? null,
      unseenFromThem: r.unseen,
    }));
    return { friends };
  });

  app.delete('/friends/:id', auth, async (req, reply) => {
    const me = authOf(req).userId;
    const { id } = parse(userIdParam, req.params);
    if (!(await areFriends(ctx.db, me, id))) throw notFound('Not friends');
    await withTransaction(ctx.db, (tx) => removeFriendship(tx, me, id));
    reply.code(204);
  });

  app.get('/friend-requests', auth, async (req) => {
    const me = authOf(req).userId;
    const q = (dir: 'in' | 'out') =>
      ctx.db.query(
        `select r.id, r.created_at, ${publicCols('u', 'u_')}
           from friend_requests r join users u on u.id = ${dir === 'in' ? 'r.from_user_id' : 'r.to_user_id'}
          where ${dir === 'in' ? 'r.to_user_id' : 'r.from_user_id'} = $1 and r.status = 'pending'
            and u.status = 'active' and ${notBlockedSql('$1', 'u.id')}
          order by r.created_at desc limit 200`,
        [me],
      );
    const [incoming, outgoing] = await Promise.all([q('in'), q('out')]);
    const map = (rows: Record<string, unknown>[]) =>
      rows.map((r) => ({ id: r.id as string, createdAt: (r.created_at as Date).toISOString(), user: pickPublic(r, 'u_') }));
    return { incoming: map(incoming.rows), outgoing: map(outgoing.rows) } satisfies FriendRequestsResponse;
  });

  app.post('/friend-requests', auth, async (req, reply) => {
    const me = authOf(req).userId;
    const body = parse(friendRequestCreateSchema, req.body);

    let targetId: string;
    if ('userId' in body) {
      targetId = body.userId;
    } else {
      const { rows } = await ctx.db.query<{ id: string }>('select id from users where invite_code = $1', [body.inviteCode]);
      if (!rows[0]) throw notFound('This invite link is no longer valid');
      targetId = rows[0].id;
    }
    if (targetId === me) throw new ApiError('bad_request', "You can't add yourself");

    const { rows: target } = await ctx.db.query<{ status: string }>('select status from users where id = $1', [targetId]);
    // Blocked users get the same answer as non-existent ones.
    if (!target[0] || target[0].status !== 'active' || (await isBlockedEitherWay(ctx.db, me, targetId))) {
      throw notFound('User not found');
    }
    if (await areFriends(ctx.db, me, targetId)) return loadProfile(ctx, me, targetId);

    const { rows: recent } = await ctx.db.query<{ n: number }>(
      `select count(*) as n from friend_requests where from_user_id = $1 and created_at > now() - interval '1 hour'`,
      [me],
    );
    if ((recent[0]?.n ?? 0) >= ctx.config.limits.friendRequestsPerHour) {
      throw new ApiError('rate_limited', 'Slow down — too many friend requests. Try again later.', { retryAfterMs: 3600_000 });
    }

    const outcome = await withTransaction(ctx.db, async (tx) => {
      // If they already asked us, adding them back accepts.
      const { rows: reverse } = await tx.query<{ id: string }>(
        `update friend_requests set status = 'accepted', responded_at = now()
          where from_user_id = $2 and to_user_id = $1 and status = 'pending' returning id`,
        [me, targetId],
      );
      if (reverse[0]) {
        await makeFriends(tx, me, targetId);
        return { kind: 'accepted' as const, requestId: reverse[0].id };
      }
      const { rows } = await tx.query<{ id: string }>(
        `insert into friend_requests (from_user_id, to_user_id) values ($1, $2)
         on conflict (from_user_id, to_user_id) where status = 'pending' do nothing returning id`,
        [me, targetId],
      );
      return rows[0] ? { kind: 'created' as const, requestId: rows[0].id } : { kind: 'existing' as const, requestId: null };
    });

    if (outcome.kind === 'created') {
      ctx.push.notifyFriendRequest({ requestId: outcome.requestId, fromUserId: me, toUserId: targetId });
      reply.code(201);
    } else if (outcome.kind === 'accepted') {
      ctx.push.notifyFriendAccepted({ accepterId: me, requesterId: targetId });
    }
    return loadProfile(ctx, me, targetId);
  });

  app.post('/friend-requests/:id/accept', auth, async (req) => {
    const me = authOf(req).userId;
    const { id } = parse(userIdParam, req.params);
    const fromUserId = await withTransaction(ctx.db, async (tx) => {
      const { rows } = await tx.query<{ from_user_id: string }>(
        `update friend_requests set status = 'accepted', responded_at = now()
          where id = $1 and to_user_id = $2 and status = 'pending' returning from_user_id`,
        [id, me],
      );
      const from = rows[0]?.from_user_id;
      if (!from) throw notFound('Request not found');
      if (await isBlockedEitherWay(tx, me, from)) throw notFound('Request not found');
      await makeFriends(tx, me, from);
      return from;
    });
    ctx.push.notifyFriendAccepted({ accepterId: me, requesterId: fromUserId });
    return loadProfile(ctx, me, fromUserId);
  });

  app.post('/friend-requests/:id/reject', auth, async (req, reply) => {
    const me = authOf(req).userId;
    const { id } = parse(userIdParam, req.params);
    const { rowCount } = await ctx.db.query(
      `update friend_requests set status = 'rejected', responded_at = now() where id = $1 and to_user_id = $2 and status = 'pending'`,
      [id, me],
    );
    if (!rowCount) throw notFound('Request not found');
    reply.code(204);
  });

  app.delete('/friend-requests/:id', auth, async (req, reply) => {
    const me = authOf(req).userId;
    const { id } = parse(userIdParam, req.params);
    const { rowCount } = await ctx.db.query(
      `update friend_requests set status = 'cancelled', responded_at = now() where id = $1 and from_user_id = $2 and status = 'pending'`,
      [id, me],
    );
    if (!rowCount) throw notFound('Request not found');
    reply.code(204);
  });
}
