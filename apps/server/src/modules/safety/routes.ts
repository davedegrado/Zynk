import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { reportCreateSchema, userIdParam } from '@zynk/shared';
import { authOf, type AppContext } from '../../context';
import { withTransaction, type Queryable } from '../../db/pool';
import { ApiError, notFound } from '../../lib/errors';
import { parse } from '../../lib/validate';
import { removeFriendship } from '../friends/routes';
import { PUBLIC_USER_COLS, toPublicUser, type UserRow } from '../users/model';

async function block(tx: Queryable, me: string, target: string) {
  await tx.query('insert into blocks (blocker_id, blocked_id) values ($1, $2) on conflict do nothing', [me, target]);
  await removeFriendship(tx, me, target);
  await tx.query('delete from mutes where (user_id = $1 and muted_id = $2) or (user_id = $2 and muted_id = $1)', [me, target]);
}

async function assertUserExists(db: Queryable, id: string) {
  const { rowCount } = await db.query('select 1 from users where id = $1', [id]);
  if (!rowCount) throw notFound('User not found');
}

export function safetyRoutes(app: FastifyInstance, ctx: AppContext) {
  const auth = { preHandler: ctx.requireAuth };

  app.get('/blocks', auth, async (req) => {
    const { rows } = await ctx.db.query<UserRow & { blocked_at: Date }>(
      `select ${PUBLIC_USER_COLS}, b.created_at as blocked_at from blocks b join users u on u.id = b.blocked_id
        where b.blocker_id = $1 order by b.created_at desc`,
      [authOf(req).userId],
    );
    return { users: rows.map((r) => ({ ...toPublicUser(r), blockedAt: r.blocked_at.toISOString() })) };
  });

  app.post('/blocks', auth, async (req, reply) => {
    const me = authOf(req).userId;
    const { userId } = parse(z.object({ userId: z.uuid() }), req.body);
    if (userId === me) throw new ApiError('bad_request', "You can't block yourself");
    await assertUserExists(ctx.db, userId);
    await withTransaction(ctx.db, (tx) => block(tx, me, userId));
    reply.code(204);
  });

  app.delete('/blocks/:id', auth, async (req, reply) => {
    const { id } = parse(userIdParam, req.params);
    await ctx.db.query('delete from blocks where blocker_id = $1 and blocked_id = $2', [authOf(req).userId, id]);
    reply.code(204);
  });

  app.put('/mutes/:id', auth, async (req, reply) => {
    const me = authOf(req).userId;
    const { id } = parse(userIdParam, req.params);
    if (id === me) throw new ApiError('bad_request', "You can't mute yourself");
    await assertUserExists(ctx.db, id);
    await ctx.db.query('insert into mutes (user_id, muted_id) values ($1, $2) on conflict do nothing', [me, id]);
    reply.code(204);
  });

  app.delete('/mutes/:id', auth, async (req, reply) => {
    const { id } = parse(userIdParam, req.params);
    await ctx.db.query('delete from mutes where user_id = $1 and muted_id = $2', [authOf(req).userId, id]);
    reply.code(204);
  });

  app.post('/reports', auth, async (req, reply) => {
    const me = authOf(req).userId;
    const body = parse(reportCreateSchema, req.body);
    if (body.userId === me) throw new ApiError('bad_request', "You can't report yourself");
    const { rows: target } = await ctx.db.query<{ username: string }>('select username from users where id = $1', [body.userId]);
    if (!target[0]) throw notFound('User not found');
    if (body.zynkId) {
      // Only Speows between the two users can be attached as evidence.
      const { rowCount } = await ctx.db.query(
        `select 1 from zynks where id = $1 and ((sender_id = $2 and recipient_id = $3) or (sender_id = $3 and recipient_id = $2))`,
        [body.zynkId, me, body.userId],
      );
      if (!rowCount) throw notFound('Speow not found');
    }
    const { rows: recent } = await ctx.db.query<{ n: number }>(
      `select count(*) as n from reports where reporter_id = $1 and created_at > now() - interval '1 day'`,
      [me],
    );
    if ((recent[0]?.n ?? 0) >= ctx.config.limits.reportsPerDay) {
      throw new ApiError('rate_limited', 'You have sent a lot of reports today. Try again tomorrow.');
    }
    await withTransaction(ctx.db, async (tx) => {
      // One open report per (reporter, reported) pair; repeat reports update the reason.
      await tx.query(
        `insert into reports (reporter_id, reported_user_id, zynk_id, reason, details, reported_username)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (reporter_id, reported_user_id) where status = 'open'
         do update set reason = excluded.reason, details = coalesce(excluded.details, reports.details),
                       zynk_id = coalesce(excluded.zynk_id, reports.zynk_id)`,
        [me, body.userId, body.zynkId ?? null, body.reason, body.details ?? null, target[0]!.username],
      );
      if (body.alsoBlock) await block(tx, me, body.userId);
    });
    req.log.info({ event: 'report_created', reason: body.reason }, 'report created');
    reply.code(201);
    return { ok: true };
  });
}
