import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { searchQuerySchema, updateProfileSchema, userIdParam, type UserProfile, type Relationship } from '@zynk/shared';
import { authOf, type AppContext } from '../../context';
import { newInviteCode } from '../../lib/crypto';
import { ApiError, notFound } from '../../lib/errors';
import { parse } from '../../lib/validate';
import { PUBLIC_USER_COLS, toMe, toPublicUser, type UserRow } from './model';
import { notBlockedSql, orderPair } from './relations';

const MAX_AVATAR_BYTES = 512 * 1024;

function sniffImage(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

export async function loadProfile(ctx: AppContext, viewerId: string, targetId: string): Promise<UserProfile> {
  const { rows } = await ctx.db.query<
    UserRow & { friend_since: Date | null; muted: boolean; friend_sound_id: string | null; req_out: string | null; req_in: string | null; blocked_by_me: boolean }
  >(
    `select ${PUBLIC_USER_COLS},
            f.created_at as friend_since,
            exists (select 1 from mutes m where m.user_id = $1 and m.muted_id = u.id) as muted,
            (select sound_id from friend_sounds fs where fs.user_id = $1 and fs.friend_id = u.id) as friend_sound_id,
            (select id from friend_requests r where r.from_user_id = $1 and r.to_user_id = u.id and r.status = 'pending') as req_out,
            (select id from friend_requests r where r.from_user_id = u.id and r.to_user_id = $1 and r.status = 'pending') as req_in,
            exists (select 1 from blocks b where b.blocker_id = $1 and b.blocked_id = u.id) as blocked_by_me
       from users u
       left join friendships f on f.user_a = $3 and f.user_b = $4
      where u.id = $2 and u.status = 'active'
        and not exists (select 1 from blocks b where b.blocker_id = u.id and b.blocked_id = $1)`,
    [viewerId, targetId, ...orderPair(viewerId, targetId)],
  );
  const r = rows[0];
  if (!r) throw notFound('User not found');
  let relationship: Relationship = 'none';
  if (r.id === viewerId) relationship = 'self';
  else if (r.blocked_by_me) relationship = 'blocked';
  else if (r.friend_since) relationship = 'friend';
  else if (r.req_out) relationship = 'request_sent';
  else if (r.req_in) relationship = 'request_received';
  return {
    ...toPublicUser(r),
    relationship,
    friendSince: r.friend_since?.toISOString() ?? null,
    muted: r.muted,
    friendSoundId: relationship === 'friend' ? r.friend_sound_id : null,
    pendingRequestId: r.req_out ?? r.req_in ?? null,
  };
}

export function userRoutes(app: FastifyInstance, ctx: AppContext) {
  const auth = { preHandler: ctx.requireAuth };

  app.get('/me', auth, async (req) => {
    const { rows } = await ctx.db.query<UserRow>(
      `select id, username, display_name, avatar_version, avatar_mime, invite_code, created_at from users where id = $1`,
      [authOf(req).userId],
    );
    if (!rows[0]) throw notFound();
    return toMe(rows[0]);
  });

  app.patch('/me', auth, async (req) => {
    const body = parse(updateProfileSchema, req.body);
    try {
      const { rows } = await ctx.db.query<UserRow>(
        `update users set display_name = coalesce($2, display_name), username = coalesce($3, username), updated_at = now()
          where id = $1
          returning id, username, display_name, avatar_version, avatar_mime, invite_code, created_at`,
        [authOf(req).userId, body.displayName ?? null, body.username ?? null],
      );
      return toMe(rows[0]!);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ApiError('username_taken', 'That username is taken', { fields: { username: 'That username is taken' } });
      }
      throw err;
    }
  });

  app.put('/me/avatar', { ...auth, bodyLimit: MAX_AVATAR_BYTES }, async (req) => {
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) throw new ApiError('bad_request', 'Send the image as the raw request body');
    const mime = sniffImage(body);
    if (!mime) throw new ApiError('bad_request', 'Only JPEG, PNG or WebP images are supported');
    const { rows } = await ctx.db.query<UserRow>(
      `update users set avatar = $2, avatar_mime = $3, avatar_version = avatar_version + 1, updated_at = now()
        where id = $1 returning id, username, display_name, avatar_version, avatar_mime, invite_code, created_at`,
      [authOf(req).userId, body, mime],
    );
    return toMe(rows[0]!);
  });

  app.delete('/me/avatar', auth, async (req) => {
    const { rows } = await ctx.db.query<UserRow>(
      `update users set avatar = null, avatar_mime = null, avatar_version = avatar_version + 1, updated_at = now()
        where id = $1 returning id, username, display_name, avatar_version, avatar_mime, invite_code, created_at`,
      [authOf(req).userId],
    );
    return toMe(rows[0]!);
  });

  app.get('/avatars/:id', auth, async (req, reply) => {
    const { id } = parse(userIdParam, req.params);
    const viewer = authOf(req).userId;
    const { rows } = await ctx.db.query<{ avatar: Buffer; avatar_mime: string }>(
      `select avatar, avatar_mime from users u
        where u.id = $2 and u.avatar is not null and u.status = 'active' and ${notBlockedSql('$1', 'u.id')}`,
      [viewer, id],
    );
    const r = rows[0];
    if (!r) throw notFound();
    reply.header('content-type', r.avatar_mime).header('cache-control', 'private, max-age=86400');
    return reply.send(r.avatar);
  });

  app.get('/users/search', { ...auth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const { q } = parse(searchQuerySchema, req.query);
    const viewer = authOf(req).userId;
    // Prefix match on username only — no display-name or contact-based discovery.
    const pattern = q.replace(/[\\%_]/g, (c) => `\\${c}`) + '%';
    const { rows } = await ctx.db.query<UserRow>(
      `select ${PUBLIC_USER_COLS} from users u
        where u.username like $2 and u.id <> $1 and u.status = 'active' and ${notBlockedSql('$1', 'u.id')}
        order by (u.username = $3) desc, char_length(u.username), u.username
        limit 20`,
      [viewer, pattern, q],
    );
    const profiles = await Promise.all(rows.map((r) => loadProfile(ctx, viewer, r.id)));
    return { users: profiles };
  });

  app.get('/users/:id', auth, async (req) => {
    const { id } = parse(userIdParam, req.params);
    return loadProfile(ctx, authOf(req).userId, id);
  });

  app.get('/me/invite', auth, async (req) => {
    const { rows } = await ctx.db.query<{ invite_code: string }>('select invite_code from users where id = $1', [authOf(req).userId]);
    const code = rows[0]!.invite_code;
    return { code, url: `${ctx.config.publicUrl}/i/${code}` };
  });

  app.post('/me/invite/rotate', auth, async (req) => {
    const { rows } = await ctx.db.query<{ invite_code: string }>(
      'update users set invite_code = $2 where id = $1 returning invite_code',
      [authOf(req).userId, newInviteCode()],
    );
    const code = rows[0]!.invite_code;
    return { code, url: `${ctx.config.publicUrl}/i/${code}` };
  });

  const inviteParam = z.object({ code: z.string().regex(/^[A-Za-z0-9]{6,16}$/) });

  app.get('/invites/:code', { ...auth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const { code } = parse(inviteParam, req.params);
    const viewer = authOf(req).userId;
    const { rows } = await ctx.db.query<{ id: string }>(
      `select u.id from users u where u.invite_code = $2 and u.status = 'active' and ${notBlockedSql('$1', 'u.id')}`,
      [viewer, code],
    );
    if (!rows[0]) throw notFound('This invite link is no longer valid');
    return loadProfile(ctx, viewer, rows[0].id);
  });

  // Public landing page for shared invite links: hands off to the app via its URL scheme.
  app.get('/i/:code', async (req, reply) => {
    const parsed = inviteParam.safeParse(req.params);
    const code = parsed.success ? parsed.data.code : '';
    const deepLink = `zynk://invite/${code}`;
    reply.header('content-type', 'text/html; charset=utf-8').header('cache-control', 'no-store');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Join me on Speow!</title><meta name="theme-color" content="#111111"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111111;color:#FFFFFF;font:16px/1.4 system-ui,sans-serif;text-align:center}
a{display:inline-block;margin-top:24px;padding:16px 28px;border-radius:999px;background:#D7FF36;color:#111111;font-weight:800;text-decoration:none}h1{font-size:44px;margin:0;letter-spacing:-1px;font-weight:900}p{color:#A3A3A3}</style></head>
<body><main><h1>Speow!</h1><p>SEND A SPEOW.</p><p>You've been invited to be friends on Speow!</p>
<a href="${deepLink}">Open in Speow!</a></main><script>setTimeout(function(){location.href=${JSON.stringify(deepLink)}},50)</script></body></html>`;
  });
}
