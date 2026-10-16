import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../../context';
import { withTransaction } from '../../db/pool';
import { safeEqual } from '../../lib/crypto';
import { ApiError, notFound } from '../../lib/errors';
import { parse } from '../../lib/validate';

/**
 * Minimal moderation API, enabled only when ADMIN_API_TOKEN is set.
 * Intended for an internal tool / curl; never exposed in the app.
 */
export function adminRoutes(app: FastifyInstance, ctx: AppContext) {
  const token = ctx.config.adminToken;
  if (!token) return;

  const requireAdmin = async (req: FastifyRequest) => {
    const got = req.headers['x-admin-token'];
    if (typeof got !== 'string' || !safeEqual(got, token)) throw new ApiError('unauthorized', 'Unauthorized');
  };
  const opts = { preHandler: requireAdmin, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };

  app.get('/admin/reports', opts, async (req) => {
    const { status } = parse(z.object({ status: z.enum(['open', 'reviewed', 'actioned', 'dismissed']).default('open') }), req.query);
    const { rows } = await ctx.db.query(
      `select r.id, r.reason, r.details, r.status, r.created_at, r.zynk_id, r.reported_user_id, r.reported_username,
              (select count(*) from reports r2 where r2.reported_user_id = r.reported_user_id) as total_reports_against
         from reports r where r.status = $1 order by r.created_at limit 200`,
      [status],
    );
    return { reports: rows };
  });

  app.post('/admin/reports/:id/action', opts, async (req) => {
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const body = parse(z.object({ action: z.enum(['dismiss', 'warn', 'suspend', 'unsuspend']), note: z.string().max(1000).optional(), actor: z.string().min(1).max(100) }), req.body);
    return withTransaction(ctx.db, async (tx) => {
      const { rows } = await tx.query<{ reported_user_id: string | null }>('select reported_user_id from reports where id = $1 for update', [id]);
      if (!rows[0]) throw notFound('Report not found');
      const target = rows[0].reported_user_id;
      if (body.action === 'suspend' && target) {
        await tx.query(`update users set status = 'suspended' where id = $1`, [target]);
        await tx.query('delete from sessions where user_id = $1', [target]);
      }
      if (body.action === 'unsuspend' && target) await tx.query(`update users set status = 'active' where id = $1`, [target]);
      await tx.query(`update reports set status = $2 where id = $1`, [id, body.action === 'dismiss' ? 'dismissed' : 'actioned']);
      await tx.query(
        'insert into moderation_actions (report_id, target_user_id, action, note, actor) values ($1, $2, $3, $4, $5)',
        [id, target, body.action, body.note ?? null, body.actor],
      );
      return { ok: true };
    });
  });

  // Promotional / support grants (e.g. QA, giveaways, store-outage compensation).
  app.post('/admin/users/:id/grants', opts, async (req) => {
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const body = parse(
      z.object({ entitlement: z.literal('plus'), days: z.number().int().min(1).max(3660).nullable(), ref: z.string().min(1).max(100), source: z.enum(['promo', 'admin']).default('promo') }),
      req.body,
    );
    const now = ctx.now();
    const expires = body.days === null ? null : new Date(now.getTime() + body.days * 86400_000);
    const { rowCount } = await ctx.db.query(
      `insert into entitlement_grants (user_id, entitlement, source, source_ref, starts_at, expires_at)
       select $1, $2, $3, $4, $5, $6 where exists (select 1 from users where id = $1)
       on conflict (user_id, source, source_ref) do update set expires_at = excluded.expires_at, revoked_at = null, updated_at = now()`,
      [id, body.entitlement, body.source, body.ref, now, expires],
    );
    if (!rowCount) throw notFound('User not found');
    return { ok: true, expiresAt: expires?.toISOString() ?? null };
  });

  app.delete('/admin/users/:id/grants/:ref', opts, async (req) => {
    const { id, ref } = parse(z.object({ id: z.uuid(), ref: z.string().min(1).max(100) }), req.params);
    await ctx.db.query(
      `update entitlement_grants set revoked_at = now(), updated_at = now() where user_id = $1 and source in ('promo', 'admin') and source_ref = $2`,
      [id, ref],
    );
    return { ok: true };
  });
}
