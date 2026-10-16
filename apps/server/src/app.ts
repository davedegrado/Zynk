import Fastify, { type FastifyError, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { ApiErrorBody } from '@zynk/shared';
import type { Config } from './config';
import type { AppContext } from './context';
import type { Db } from './db/pool';
import { ApiError } from './lib/errors';
import { findSession, touchSession } from './modules/auth/sessions';
import { authRoutes } from './modules/auth/routes';
import { userRoutes } from './modules/users/routes';
import { friendRoutes } from './modules/friends/routes';
import { safetyRoutes } from './modules/safety/routes';
import { zynkRoutes } from './modules/zynks/routes';
import { preferenceRoutes } from './modules/preferences/routes';
import { deviceRoutes } from './modules/devices/routes';
import { billingRoutes } from './modules/billing/routes';
import { adminRoutes } from './modules/admin/routes';
import { PushDispatcher } from './modules/push/dispatcher';
import { LogPushProvider, NoopPushProvider, type PushProvider } from './modules/push/provider';
import { ExpoPushProvider } from './modules/push/expo';
import { RevenueCatProvider } from './modules/billing/revenuecat';
import type { BillingProvider } from './modules/billing/provider';

export interface BuildOptions {
  config: Config;
  db: Db;
  pushProvider?: PushProvider;
  /** Pass `null` to force-disable purchases; omit to derive from config. */
  billing?: BillingProvider | null;
  now?: () => Date;
  logger?: boolean;
}

export async function buildApp(opts: BuildOptions) {
  const { config, db } = opts;
  const now = opts.now ?? (() => new Date());
  const app = Fastify({
    logger:
      opts.logger === false
        ? false
        : {
            level: config.logLevel,
            redact: { paths: ['req.headers.authorization', 'req.headers["x-admin-token"]', '*.password', '*.token'], remove: true },
            serializers: {
              // Keep logs minimal: no IPs, no query strings (search terms), no bodies.
              req: (req: FastifyRequest) => ({ method: req.method, url: req.url.split('?')[0], reqId: req.id }),
            },
          },
    trustProxy: config.trustProxy,
    bodyLimit: 64 * 1024,
  });

  // Avatars are uploaded as raw image bodies.
  app.addContentTypeParser(['image/jpeg', 'image/png', 'image/webp'], { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

  await app.register(cors, {
    origin: config.corsOrigins.length ? config.corsOrigins : false,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type', 'accept'],
    maxAge: 600,
  });
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // Authenticated traffic is limited per token, anonymous traffic per IP.
    keyGenerator: (req) => (req.headers.authorization ? `t:${req.headers.authorization.slice(-24)}` : `ip:${req.ip}`),
    errorResponseBuilder: (_req, ctx) => {
      const err = new ApiError('rate_limited', 'Too many requests. Slow down a little.', { retryAfterMs: ctx.ttl });
      return err;
    },
  });

  let pushProvider = opts.pushProvider;
  if (!pushProvider) {
    if (config.push.provider === 'expo') pushProvider = new ExpoPushProvider(config.push.expoAccessToken);
    else if (config.push.provider === 'log') pushProvider = new LogPushProvider((m) => app.log.info(m));
    else pushProvider = new NoopPushProvider();
  }
  const billing =
    opts.billing !== undefined
      ? opts.billing
      : config.billing.revenuecatSecretKey
        ? new RevenueCatProvider(config.billing.revenuecatSecretKey, config.billing.entitlementId, now)
        : null;

  const requireAuth = async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token || token.length > 200) throw new ApiError('unauthorized', 'Sign in required');
    const t = now();
    const session = await findSession(db, token, t);
    if (!session) throw new ApiError('unauthorized', 'Your session has expired. Sign in again.');
    if (session.status !== 'active') throw new ApiError('account_suspended', 'This account is suspended');
    await touchSession(db, session, config.sessionTtlMs, t);
    req.auth = { userId: session.userId, sessionId: session.sessionId };
  };

  const ctx: AppContext = {
    config,
    db,
    push: new PushDispatcher(db, pushProvider, config, app.log, now),
    billing,
    now,
    requireAuth,
  };
  app.decorate('zynk', ctx);

  app.setErrorHandler((err: FastifyError | ApiError, req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof ApiError) {
      const body: ApiErrorBody = { error: { code: err.code, message: err.message, ...err.extra } };
      if (err.extra.retryAfterMs) reply.header('retry-after', Math.ceil(err.extra.retryAfterMs / 1000));
      return reply.code(err.status).send(body);
    }
    const status = (err as FastifyError).statusCode ?? 500;
    if (status === 413) return reply.code(413).send({ error: { code: 'payload_too_large', message: 'That file is too large' } });
    if (status >= 400 && status < 500) {
      return reply.code(status).send({ error: { code: 'bad_request', message: err.message } });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: { code: 'internal', message: 'Something went wrong' } });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: { code: 'not_found', message: 'Not found' } }));

  app.get('/health', async () => {
    await db.query('select 1');
    return { ok: true, push: ctx.push.providerName, purchases: !!billing };
  });

  authRoutes(app, ctx);
  userRoutes(app, ctx);
  friendRoutes(app, ctx);
  safetyRoutes(app, ctx);
  zynkRoutes(app, ctx);
  preferenceRoutes(app, ctx);
  deviceRoutes(app, ctx);
  billingRoutes(app, ctx);
  adminRoutes(app, ctx);

  app.addHook('onClose', async () => {
    await ctx.push.drain();
  });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    zynk: AppContext;
  }
}
