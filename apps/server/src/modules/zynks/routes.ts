import type { FastifyInstance } from 'fastify';
import { activityQuerySchema, markSeenSchema, sendZynkSchema, userIdParam, zynkReactionSchema, type ActivityResponse } from '@zynk/shared';
import { authOf, type AppContext } from '../../context';
import { ApiError, notFound } from '../../lib/errors';
import { parse } from '../../lib/validate';
import { getFeatures } from '../entitlements/service';
import { publicCols } from '../users/model';
import { notBlockedSql } from '../users/relations';
import { loadZynk, sendZynk, toZynkEvent, validateReaction, ZYNK_COLS } from './service';

export function zynkRoutes(app: FastifyInstance, ctx: AppContext) {
  const auth = { preHandler: ctx.requireAuth };

  app.post('/zynks', { ...auth, config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    const input = parse(sendZynkSchema, req.body);
    const result = await sendZynk(ctx, authOf(req).userId, input);
    reply.code(result.duplicate ? 200 : 201);
    return result;
  });

  app.get('/activity', auth, async (req) => {
    const me = authOf(req).userId;
    const q = parse(activityQuerySchema, req.query);
    const dirSql = q.direction === 'sent' ? 'z.sender_id = $1' : q.direction === 'received' ? 'z.recipient_id = $1' : '(z.sender_id = $1 or z.recipient_id = $1)';
    const { rows } = await ctx.db.query(
      `select ${ZYNK_COLS}, ${publicCols('c', 'c_')}
         from zynks z join users c on c.id = case when z.sender_id = $1 then z.recipient_id else z.sender_id end
        where ${dirSql} and ($2::timestamptz is null or z.created_at < $2) and ${notBlockedSql('$1', 'c.id')}
        order by z.created_at desc limit $3`,
      [me, q.before ?? null, q.limit + 1],
    );
    const items = rows.slice(0, q.limit).map((r) => toZynkEvent(r, me));
    const { rows: unseen } = await ctx.db.query<{ n: number }>(
      'select count(*) as n from zynks where recipient_id = $1 and seen_at is null',
      [me],
    );
    return {
      items,
      nextBefore: rows.length > q.limit ? (items[items.length - 1]?.createdAt ?? null) : null,
      unseenCount: unseen[0]?.n ?? 0,
    } satisfies ActivityResponse;
  });

  app.get('/zynks/:id', auth, async (req) => {
    const { id } = parse(userIdParam, req.params);
    const zynk = await loadZynk(ctx.db, id, authOf(req).userId);
    if (!zynk) throw notFound('Zynk not found');
    return zynk;
  });

  app.post('/activity/seen', auth, async (req) => {
    const { ids } = parse(markSeenSchema, req.body);
    const { rowCount } = await ctx.db.query(
      'update zynks set seen_at = $3 where recipient_id = $1 and id = any($2) and seen_at is null',
      [authOf(req).userId, ids, ctx.now()],
    );
    return { updated: rowCount ?? 0 };
  });

  app.post('/activity/seen-all', auth, async (req) => {
    const { rowCount } = await ctx.db.query('update zynks set seen_at = $2 where recipient_id = $1 and seen_at is null', [
      authOf(req).userId,
      ctx.now(),
    ]);
    return { updated: rowCount ?? 0 };
  });

  // The recipient may answer a Zynk with one predefined reaction (no text).
  app.put('/zynks/:id/reaction', auth, async (req) => {
    const me = authOf(req).userId;
    const { id } = parse(userIdParam, req.params);
    const { reactionId } = parse(zynkReactionSchema, req.body);
    let fallback: string | null = null;
    if (reactionId) fallback = validateReaction(reactionId, await getFeatures(ctx.db, me, ctx.now())).item.glyph;
    const { rows } = await ctx.db.query<{ sender_id: string }>(
      `update zynks set response_reaction_id = $3, response_reaction_fallback = $4, seen_at = coalesce(seen_at, now())
        where id = $1 and recipient_id = $2 returning sender_id`,
      [id, me, reactionId, fallback],
    );
    if (!rows[0]) throw new ApiError('not_found', 'Zynk not found');
    return (await loadZynk(ctx.db, id, me))!;
  });
}
