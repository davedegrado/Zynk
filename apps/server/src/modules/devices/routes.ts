import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registerDeviceSchema } from '@zynk/shared';
import { authOf, type AppContext } from '../../context';
import { parse } from '../../lib/validate';

export function deviceRoutes(app: FastifyInstance, ctx: AppContext) {
  const auth = { preHandler: ctx.requireAuth };

  // Upsert: a token always belongs to the most recent account/session that registered it,
  // so a shared device never receives the previous user's Speows.
  app.post('/devices', auth, async (req, reply) => {
    const { userId, sessionId } = authOf(req);
    const body = parse(registerDeviceSchema, req.body);
    await ctx.db.query(
      `insert into device_tokens (user_id, session_id, token, platform, provider)
       values ($1, $2, $3, $4, $5)
       on conflict (token) do update set user_id = excluded.user_id, session_id = excluded.session_id,
         platform = excluded.platform, last_seen_at = now(), invalidated_at = null`,
      [userId, sessionId, body.token, body.platform, body.provider],
    );
    reply.code(204);
  });

  app.delete('/devices', auth, async (req, reply) => {
    const { token } = parse(z.object({ token: z.string().min(10).max(512) }), req.body);
    await ctx.db.query('delete from device_tokens where token = $1 and user_id = $2', [token, authOf(req).userId]);
    reply.code(204);
  });
}
