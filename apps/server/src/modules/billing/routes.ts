import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PlansResponse } from '@zynk/shared';
import { authOf, type AppContext } from '../../context';
import { safeEqual } from '../../lib/crypto';
import { ApiError } from '../../lib/errors';
import { getEntitlements } from '../entitlements/service';
import { syncUser } from './service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const webhookSchema = z.object({
  event: z
    .object({
      id: z.string().min(1).max(200),
      type: z.string().max(100),
      app_user_id: z.string().max(200).optional(),
      original_app_user_id: z.string().max(200).optional(),
      aliases: z.array(z.string().max(200)).max(50).optional(),
      transferred_from: z.array(z.string().max(200)).max(50).optional(),
      transferred_to: z.array(z.string().max(200)).max(50).optional(),
    })
    .loose(),
});

export function billingRoutes(app: FastifyInstance, ctx: AppContext) {
  const auth = { preHandler: ctx.requireAuth };

  app.get('/billing/plans', auth, async () => {
    return {
      purchasesEnabled: !!ctx.billing,
      plans: ctx.config.billing.plans,
      promoMessage: ctx.config.billing.promoMessage,
    } satisfies PlansResponse;
  });

  // Called by the app after a purchase/restore. The server re-verifies with the provider
  // using its secret key; the client's own claim of "I bought it" is never trusted.
  app.post('/billing/sync', { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const userId = authOf(req).userId;
    try {
      await syncUser(ctx, userId);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      req.log.error({ err, event: 'billing_sync_failed' }, 'billing sync failed');
      throw new ApiError('purchases_unavailable', 'Could not verify purchases right now. Try again shortly.');
    }
    return getEntitlements(ctx.db, userId, ctx.now());
  });

  app.post('/webhooks/revenuecat', { config: { rateLimit: { max: 600, timeWindow: '1 minute' } } }, async (req, reply) => {
    const expected = ctx.config.billing.webhookAuth;
    const got = req.headers.authorization ?? '';
    if (!expected || !ctx.billing) return reply.code(503).send({ error: { code: 'purchases_unavailable', message: 'Not configured' } });
    if (!safeEqual(got, expected) && !safeEqual(got, `Bearer ${expected}`)) {
      req.log.warn({ event: 'webhook_unauthorized' }, 'rejected webhook');
      return reply.code(401).send({ error: { code: 'unauthorized', message: 'Unauthorized' } });
    }
    const parsed = webhookSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'bad_request', message: 'Invalid payload' } });
    const ev = parsed.data.event;

    const inserted = await ctx.db.query(
      `insert into billing_events (id, provider, type, app_user_id) values ($1, 'revenuecat', $2, $3)
       on conflict (id) do nothing returning id`,
      [ev.id, ev.type, ev.app_user_id ?? null],
    );
    if (!inserted.rowCount) {
      const { rows } = await ctx.db.query<{ processed_at: Date | null }>('select processed_at from billing_events where id = $1', [ev.id]);
      if (rows[0]?.processed_at) return { ok: true, duplicate: true };
    }

    // We don't trust the payload's state: every event triggers a fresh, authenticated fetch.
    const candidates = new Set(
      [ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? []), ...(ev.transferred_from ?? []), ...(ev.transferred_to ?? [])]
        .filter((id): id is string => !!id && UUID_RE.test(id)),
    );
    try {
      for (const userId of candidates) {
        const { rowCount } = await ctx.db.query('select 1 from users where id = $1', [userId]);
        if (rowCount) await syncUser(ctx, userId);
      }
      await ctx.db.query('update billing_events set processed_at = now(), error = null where id = $1', [ev.id]);
      return { ok: true };
    } catch (err) {
      await ctx.db.query('update billing_events set error = $2 where id = $1', [ev.id, String((err as Error).message).slice(0, 200)]);
      req.log.error({ err, event: 'webhook_failed', type: ev.type }, 'webhook processing failed');
      // Non-2xx makes RevenueCat retry later.
      return reply.code(500).send({ error: { code: 'internal', message: 'Retry later' } });
    }
  });
}
