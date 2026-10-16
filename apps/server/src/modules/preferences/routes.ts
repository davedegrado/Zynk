import type { FastifyInstance } from 'fastify';
import { friendSoundSchema, getSound, isSelectable, preferencesPatchSchema, userIdParam, type PreferencesResponse } from '@zynk/shared';
import { authOf, type AppContext } from '../../context';
import { ApiError } from '../../lib/errors';
import { parse } from '../../lib/validate';
import { getEntitlements, getFeatures } from '../entitlements/service';
import { areFriends } from '../users/relations';
import { assertSelectable, effectivePreferences, getPreferences, updatePreferences } from './service';

export function preferenceRoutes(app: FastifyInstance, ctx: AppContext) {
  const auth = { preHandler: ctx.requireAuth };

  app.get('/me/entitlements', auth, async (req) => getEntitlements(ctx.db, authOf(req).userId, ctx.now()));

  app.get('/me/preferences', auth, async (req) => {
    const userId = authOf(req).userId;
    const [selected, features] = await Promise.all([getPreferences(ctx.db, userId), getFeatures(ctx.db, userId, ctx.now())]);
    return { selected, effective: effectivePreferences(selected, features) } satisfies PreferencesResponse;
  });

  app.patch('/me/preferences', auth, async (req) => {
    const userId = authOf(req).userId;
    const patch = parse(preferencesPatchSchema, req.body);
    const features = await getFeatures(ctx.db, userId, ctx.now());
    assertSelectable(patch, features);
    const selected = await updatePreferences(ctx.db, userId, patch);
    return { selected, effective: effectivePreferences(selected, features) } satisfies PreferencesResponse;
  });

  // Recipient-side per-friend sound (ZYNK Plus: custom_sounds).
  app.put('/friends/:id/sound', auth, async (req, reply) => {
    const me = authOf(req).userId;
    const { id } = parse(userIdParam, req.params);
    const { soundId } = parse(friendSoundSchema, req.body);
    if (!(await areFriends(ctx.db, me, id))) throw new ApiError('not_friends', 'You can only set sounds for friends');
    if (soundId === null) {
      await ctx.db.query('delete from friend_sounds where user_id = $1 and friend_id = $2', [me, id]);
      return reply.code(204).send();
    }
    const features = await getFeatures(ctx.db, me, ctx.now());
    if (!features.includes('custom_sounds')) throw new ApiError('feature_locked', 'Per-friend sounds are a ZYNK Plus feature', { feature: 'custom_sounds' });
    if (!getSound(soundId) || !isSelectable(getSound, soundId, features)) throw new ApiError('unknown_item', 'Unknown sound');
    await ctx.db.query(
      `insert into friend_sounds (user_id, friend_id, sound_id) values ($1, $2, $3)
       on conflict (user_id, friend_id) do update set sound_id = excluded.sound_id, updated_at = now()`,
      [me, id, soundId],
    );
    reply.code(204);
  });
}
