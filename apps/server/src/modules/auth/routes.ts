import type { FastifyInstance } from 'fastify';
import {
  changePasswordSchema,
  deleteAccountSchema,
  loginSchema,
  registerSchema,
  type AuthResponse,
} from '@zynk/shared';
import { authOf, type AppContext } from '../../context';
import { withTransaction } from '../../db/pool';
import { getDummyHash, hashPassword, newInviteCode, verifyPassword } from '../../lib/crypto';
import { ApiError } from '../../lib/errors';
import { parse } from '../../lib/validate';
import { assertAvatar, ME_COLS, randomAvatar, toMe, type UserRow } from '../users/model';
import { createSession } from './sessions';
import { deleteAccount } from './delete-account';

/** Per-username failed-login throttle (in-process; complements per-IP rate limits). */
class LoginThrottle {
  private failures = new Map<string, { count: number; until: number }>();
  check(username: string, now: number) {
    const f = this.failures.get(username);
    if (f && f.count >= 5 && f.until > now) {
      throw new ApiError('rate_limited', 'Too many attempts. Try again in a few minutes.', { retryAfterMs: f.until - now });
    }
  }
  fail(username: string, now: number) {
    const f = this.failures.get(username);
    const count = f && f.until > now ? f.count + 1 : 1;
    this.failures.set(username, { count, until: now + 5 * 60_000 });
    if (this.failures.size > 50_000) this.failures.clear();
  }
  succeed(username: string) {
    this.failures.delete(username);
  }
}

export function authRoutes(app: FastifyInstance, ctx: AppContext) {
  const throttle = new LoginThrottle();
  const authRateLimit = { rateLimit: { max: ctx.config.limits.authPerMinute, timeWindow: '1 minute' } };

  app.post('/auth/register', { config: authRateLimit }, async (req, reply) => {
    const body = parse(registerSchema, req.body);
    if (body.avatar) assertAvatar(body.avatar);
    const avatar = body.avatar ?? randomAvatar();
    const passwordHash = await hashPassword(body.password);
    const now = ctx.now();
    try {
      const result = await withTransaction(ctx.db, async (tx) => {
        const { rows } = await tx.query<UserRow>(
          `insert into users (username, display_name, password_hash, invite_code, avatar_id, avatar_color, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $7)
           returning ${ME_COLS}`,
          [body.username, body.displayName, passwordHash, newInviteCode(), avatar.id, avatar.color, now],
        );
        const user = rows[0]!;
        await tx.query('insert into preferences (user_id, language) values ($1, $2)', [user.id, body.language ?? 'en']);
        const session = await createSession(tx, user.id, ctx.config.sessionTtlMs, now);
        return { user, token: session.token };
      });
      reply.code(201);
      return { token: result.token, user: toMe(result.user) } satisfies AuthResponse;
    } catch (err) {
      if ((err as { code?: string; constraint?: string }).code === '23505' && String((err as { constraint?: string }).constraint).includes('username')) {
        throw new ApiError('username_taken', 'That username is taken', { fields: { username: 'That username is taken' } });
      }
      throw err;
    }
  });

  app.post('/auth/login', { config: authRateLimit }, async (req) => {
    const body = parse(loginSchema, req.body);
    const now = ctx.now();
    throttle.check(body.username, now.getTime());
    const { rows } = await ctx.db.query<UserRow & { password_hash: string }>(
      `select ${ME_COLS}, status, password_hash from users where username = $1`,
      [body.username],
    );
    const user = rows[0];
    const ok = await verifyPassword(body.password, user?.password_hash ?? (await getDummyHash()));
    if (!user || !ok) {
      throttle.fail(body.username, now.getTime());
      throw new ApiError('invalid_credentials', 'Wrong username or password');
    }
    if (user.status !== 'active') throw new ApiError('account_suspended', 'This account is suspended');
    throttle.succeed(body.username);
    const session = await createSession(ctx.db, user.id, ctx.config.sessionTtlMs, now);
    return { token: session.token, user: toMe(user) } satisfies AuthResponse;
  });

  app.post('/auth/logout', { preHandler: ctx.requireAuth }, async (req, reply) => {
    // Deleting the session cascades to device tokens registered with it.
    await ctx.db.query('delete from sessions where id = $1', [authOf(req).sessionId]);
    reply.code(204);
  });

  app.post('/me/password', { preHandler: ctx.requireAuth, config: authRateLimit }, async (req, reply) => {
    const { userId, sessionId } = authOf(req);
    const body = parse(changePasswordSchema, req.body);
    const { rows } = await ctx.db.query<{ password_hash: string }>('select password_hash from users where id = $1', [userId]);
    if (!rows[0] || !(await verifyPassword(body.currentPassword, rows[0].password_hash))) {
      throw new ApiError('invalid_credentials', 'Current password is incorrect', { fields: { currentPassword: 'Incorrect password' } });
    }
    const hash = await hashPassword(body.newPassword);
    await withTransaction(ctx.db, async (tx) => {
      await tx.query('update users set password_hash = $2, updated_at = now() where id = $1', [userId, hash]);
      // Sign out every other device.
      await tx.query('delete from sessions where user_id = $1 and id <> $2', [userId, sessionId]);
    });
    reply.code(204);
  });

  app.delete('/me', { preHandler: ctx.requireAuth, config: authRateLimit }, async (req, reply) => {
    const { userId } = authOf(req);
    const body = parse(deleteAccountSchema, req.body);
    const { rows } = await ctx.db.query<{ password_hash: string }>('select password_hash from users where id = $1', [userId]);
    if (!rows[0] || !(await verifyPassword(body.password, rows[0].password_hash))) {
      throw new ApiError('invalid_credentials', 'Password is incorrect', { fields: { password: 'Incorrect password' } });
    }
    await deleteAccount(ctx, userId);
    req.log.info({ event: 'account_deleted' }, 'account deleted');
    reply.code(204);
  });
}
