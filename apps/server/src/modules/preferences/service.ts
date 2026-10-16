import {
  effectiveSelection,
  getAccent,
  getBubbleColor,
  getEffect,
  getSound,
  getTheme,
  isSelectable,
  type FeatureId,
  type Preferences,
  type PreferencesPatch,
} from '@zynk/shared';
import type { Queryable } from '../../db/pool';
import { ApiError } from '../../lib/errors';

interface PrefRow {
  push_enabled: boolean; zynk_push: boolean; friend_request_push: boolean; haptics: boolean;
  sounds_enabled: boolean; allow_sender_sounds: boolean; show_sender_style: boolean; reduce_motion: boolean;
  appearance: 'theme' | 'system';
  language: 'en' | 'it';
  incoming_sound_id: string; outgoing_sound_id: string; theme_id: string; accent_id: string; bubble_color_id: string; effect_id: string;
}

const COLUMN: Record<keyof Preferences, keyof PrefRow> = {
  pushEnabled: 'push_enabled', zynkPush: 'zynk_push', friendRequestPush: 'friend_request_push', haptics: 'haptics',
  soundsEnabled: 'sounds_enabled', allowSenderSounds: 'allow_sender_sounds', showSenderStyle: 'show_sender_style',
  reduceMotion: 'reduce_motion', appearance: 'appearance', language: 'language', incomingSoundId: 'incoming_sound_id',
  outgoingSoundId: 'outgoing_sound_id', themeId: 'theme_id', accentId: 'accent_id', bubbleColorId: 'bubble_color_id', effectId: 'effect_id',
};

function fromRow(r: PrefRow): Preferences {
  const out = {} as Record<keyof Preferences, unknown>;
  for (const [k, col] of Object.entries(COLUMN)) out[k as keyof Preferences] = r[col];
  return out as unknown as Preferences;
}

export async function getPreferences(db: Queryable, userId: string): Promise<Preferences> {
  const { rows } = await db.query<PrefRow>(
    `insert into preferences (user_id) values ($1) on conflict (user_id) do update set user_id = excluded.user_id returning *`,
    [userId],
  );
  return fromRow(rows[0]!);
}

export function effectivePreferences(p: Preferences, features: readonly FeatureId[]): Preferences {
  return { ...p, ...effectiveSelection(p, features) };
}

const CATALOG_FIELDS = {
  incomingSoundId: getSound,
  outgoingSoundId: getSound,
  themeId: getTheme,
  accentId: getAccent,
  bubbleColorId: getBubbleColor,
  effectId: getEffect,
} as const;

/** Validates catalog ids against the catalog AND the user's verified entitlements. */
export function assertSelectable(patch: PreferencesPatch, features: readonly FeatureId[]) {
  for (const [field, lookup] of Object.entries(CATALOG_FIELDS) as [keyof typeof CATALOG_FIELDS, (id: string) => { requiredFeature: FeatureId | null; retired?: boolean } | undefined][]) {
    const id = patch[field];
    if (id === undefined) continue;
    const item = lookup(id);
    if (!item || item.retired) throw new ApiError('unknown_item', `Unknown ${field}: ${id}`, { fields: { [field]: 'Unknown item' } });
    if (!isSelectable(lookup, id, features)) {
      throw new ApiError('feature_locked', 'This is a Speow Plus feature', { feature: item.requiredFeature ?? undefined });
    }
  }
}

export async function updatePreferences(db: Queryable, userId: string, patch: PreferencesPatch): Promise<Preferences> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [keyof Preferences, unknown][];
  await getPreferences(db, userId);
  if (entries.length === 0) return getPreferences(db, userId);
  const sets = entries.map(([k], i) => `${COLUMN[k]} = $${i + 2}`);
  const { rows } = await db.query<PrefRow>(
    `update preferences set ${sets.join(', ')}, updated_at = now() where user_id = $1 returning *`,
    [userId, ...entries.map(([, v]) => v)],
  );
  return fromRow(rows[0]!);
}
