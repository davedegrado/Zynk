/**
 * Personalization catalogs. Every item has a stable id that is persisted in the
 * database and sent across the wire — never rename an id, only add new ones or
 * mark old ones `retired`.
 *
 * `requiredFeature: null` means the item is part of Speow! Free.
 */
import type { FeatureId } from './features';
import { BRAND } from './brand';

interface CatalogItem {
  id: string;
  name: string;
  requiredFeature: FeatureId | null;
  /** Retired items can still be rendered (old events) but not newly selected. */
  retired?: boolean;
}

// ---------------------------------------------------------------- sounds

export interface SoundItem extends CatalogItem {
  /** Base file name (no extension). Must be lowercase/underscore for Android res/raw. */
  file: string;
  description: string;
  durationMs: number;
}

export const DEFAULT_SOUND_ID = 'zynk_classic';

/** All sounds are original, synthesized for Speow! (see tools/assets/generate-sounds.mjs). File names keep
 * the legacy `zynk_` prefix: they are Android channel/res ids and APNs sound names on installed apps. */
export const SOUNDS: readonly SoundItem[] = [
  { id: 'zynk_classic', file: 'zynk_classic', name: 'Classic Speow', description: 'The signature double pop.', durationMs: 420, requiredFeature: null },
  { id: 'zynk_boing', file: 'zynk_boing', name: 'Boing', description: 'A springy cartoon bounce.', durationMs: 600, requiredFeature: 'custom_sounds' },
  { id: 'zynk_laser', file: 'zynk_laser', name: 'Laser', description: 'Pew. Retro sci-fi zap.', durationMs: 380, requiredFeature: 'custom_sounds' },
  { id: 'zynk_coin', file: 'zynk_coin', name: 'Coin', description: 'Bright 8-bit pickup.', durationMs: 360, requiredFeature: 'custom_sounds' },
  { id: 'zynk_knock', file: 'zynk_knock', name: 'Knock knock', description: 'Two quick knocks.', durationMs: 450, requiredFeature: 'custom_sounds' },
  { id: 'zynk_chime', file: 'zynk_chime', name: 'Chime', description: 'A soft sparkly arpeggio.', durationMs: 800, requiredFeature: 'custom_sounds' },
  { id: 'zynk_whoosh', file: 'zynk_whoosh', name: 'Whoosh', description: 'Something just flew past.', durationMs: 500, requiredFeature: 'custom_sounds' },
  { id: 'zynk_thunder', file: 'zynk_thunder', name: 'Thunderclap', description: 'A tiny storm in your pocket.', durationMs: 900, requiredFeature: 'custom_sounds' },
  { id: 'zynk_bubble', file: 'zynk_bubble', name: 'Bubble', description: 'Blub-blub-pop.', durationMs: 450, requiredFeature: 'custom_sounds' },
];

// ---------------------------------------------------------------- reactions

export interface ReactionItem {
  id: string;
  label: string;
  /** Unicode fallback shown when the app does not know the pack/item. */
  glyph: string;
  /** `vector` items are custom-drawn icons bundled in the app. */
  kind: 'unicode' | 'vector';
  animated?: boolean;
}

export interface ReactionPack extends CatalogItem {
  description: string;
  items: readonly ReactionItem[];
}

export const REACTION_PACKS: readonly ReactionPack[] = [
  {
    id: 'basic',
    name: 'Basics',
    description: 'Everyday reactions.',
    requiredFeature: null,
    items: [
      { id: 'wave', label: 'Hey', glyph: '👋', kind: 'unicode' },
      { id: 'heart', label: 'Love', glyph: '❤️', kind: 'unicode' },
      { id: 'lol', label: 'LOL', glyph: '😂', kind: 'unicode' },
      { id: 'fire', label: 'Fire', glyph: '🔥', kind: 'unicode' },
      { id: 'eyes', label: 'Looking', glyph: '👀', kind: 'unicode' },
      { id: 'please', label: 'Please', glyph: '🙏', kind: 'unicode' },
      { id: 'sleepy', label: 'Sleepy', glyph: '😴', kind: 'unicode' },
      { id: 'party', label: 'Party', glyph: '🎉', kind: 'unicode' },
    ],
  },
  {
    id: 'y2k',
    name: 'Y2K Stickers',
    description: 'Custom-drawn reactions straight out of a gel-pen notebook.',
    requiredFeature: 'premium_emoji_packs',
    items: [
      { id: 'sparkle', label: 'Sparkle', glyph: '✨', kind: 'vector' },
      { id: 'bolt', label: 'Bolt', glyph: '⚡', kind: 'vector' },
      { id: 'disc', label: 'Mixtape', glyph: '💿', kind: 'vector' },
      { id: 'flip', label: 'Call me', glyph: '📱', kind: 'vector' },
      { id: 'butterfly', label: 'Butterfly', glyph: '🦋', kind: 'vector' },
      { id: 'alien', label: 'Alien', glyph: '👽', kind: 'vector' },
      { id: 'smiley', label: 'Smiley', glyph: '🙂', kind: 'vector' },
      { id: 'pixel_heart', label: 'Pixel heart', glyph: '💖', kind: 'vector' },
    ],
  },
  {
    id: 'moves',
    name: 'Moves',
    description: 'Animated reactions that wiggle, bounce and spin.',
    requiredFeature: 'premium_emoji_packs',
    items: [
      { id: 'bounce_heart', label: 'Heartbeat', glyph: '💓', kind: 'unicode', animated: true },
      { id: 'spin_star', label: 'Spin star', glyph: '🌟', kind: 'unicode', animated: true },
      { id: 'wobble_face', label: 'Wobble', glyph: '🥴', kind: 'unicode', animated: true },
      { id: 'shake_fist', label: 'Wake up!', glyph: '✊', kind: 'unicode', animated: true },
      { id: 'pulse_ghost', label: 'Boo', glyph: '👻', kind: 'unicode', animated: true },
      { id: 'hop_frog', label: 'Ribbit', glyph: '🐸', kind: 'unicode', animated: true },
    ],
  },
];

// ---------------------------------------------------------------- themes & colors

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  danger: string;
  onDanger: string;
}

export interface ThemeItem extends CatalogItem {
  scheme: 'dark' | 'light';
  colors: ThemeColors;
  defaultAccentId: string;
}

const { ink, white } = BRAND.colors;

export const THEMES: readonly ThemeItem[] = [
  {
    // Ids are persisted in user preferences; only display names follow the brand.
    id: 'night',
    name: 'Dark',
    scheme: 'dark',
    requiredFeature: null,
    defaultAccentId: 'lime',
    colors: { background: ink, surface: '#1C1C1C', surfaceAlt: '#262626', border: '#333333', text: white, textMuted: '#A3A3A3', danger: '#FF5C6C', onDanger: ink },
  },
  {
    id: 'daylight',
    name: 'Light',
    scheme: 'light',
    requiredFeature: null,
    defaultAccentId: 'lime',
    colors: { background: white, surface: '#F6F6F6', surfaceAlt: '#EBEBEB', border: '#DEDEDE', text: ink, textMuted: '#5C5C5C', danger: '#C4122F', onDanger: '#FFFFFF' },
  },
  {
    id: 'ultraviolet',
    name: 'Ultraviolet',
    scheme: 'dark',
    requiredFeature: 'custom_themes',
    defaultAccentId: 'purple',
    colors: { background: '#120A22', surface: '#1D1233', surfaceAlt: '#291A47', border: '#3A2860', text: white, textMuted: '#B9AED6', danger: '#FF5C6C', onDanger: ink },
  },
  {
    id: 'deep_sea',
    name: 'Deep Sea',
    scheme: 'dark',
    requiredFeature: 'custom_themes',
    defaultAccentId: 'blue',
    colors: { background: '#04121C', surface: '#0A1F2E', surfaceAlt: '#112B3F', border: '#1B3B54', text: white, textMuted: '#9DB8CC', danger: '#FF5C6C', onDanger: ink },
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    scheme: 'light',
    requiredFeature: 'custom_themes',
    defaultAccentId: 'pink',
    colors: { background: '#FFF1FA', surface: '#FFFFFF', surfaceAlt: '#FBE0F1', border: '#F0C6E2', text: ink, textMuted: '#5E4A5A', danger: '#C4122F', onDanger: '#FFFFFF' },
  },
];

/**
 * Curated, contrast-checked color swatches. `ink` is the text/icon color used on
 * top of the swatch. Red/green "status" hues are deliberately excluded so that
 * custom colors can never imitate system security or error indicators.
 */
export interface ColorSwatch extends CatalogItem {
  color: string;
  ink: string;
}

export const ACCENTS: readonly ColorSwatch[] = [
  { id: 'lime', name: 'Acid Lime', color: BRAND.colors.lime, ink: ink, requiredFeature: null },
  { id: 'purple', name: 'Purple', color: BRAND.colors.purple, ink: ink, requiredFeature: 'custom_themes' },
  { id: 'blue', name: 'Electric Blue', color: BRAND.colors.electricBlue, ink: ink, requiredFeature: 'custom_themes' },
  { id: 'pink', name: 'Pink', color: BRAND.colors.pink, ink: ink, requiredFeature: 'custom_themes' },
  { id: 'tangerine', name: 'Tangerine', color: '#FFA01C', ink: ink, requiredFeature: 'custom_themes' },
  { id: 'cloud', name: 'White', color: white, ink: ink, requiredFeature: 'custom_themes' },
];

export const BUBBLE_COLORS: readonly ColorSwatch[] = [
  { id: 'lime', name: 'Acid Lime', color: BRAND.colors.lime, ink: ink, requiredFeature: null },
  { id: 'purple', name: 'Purple', color: BRAND.colors.purple, ink: ink, requiredFeature: 'custom_themes' },
  { id: 'blue', name: 'Electric Blue', color: BRAND.colors.electricBlue, ink: ink, requiredFeature: 'custom_themes' },
  { id: 'pink', name: 'Pink', color: BRAND.colors.pink, ink: ink, requiredFeature: 'custom_themes' },
  { id: 'tangerine', name: 'Tangerine', color: '#FFA01C', ink: ink, requiredFeature: 'custom_themes' },
  { id: 'cloud', name: 'White', color: white, ink: ink, requiredFeature: 'custom_themes' },
  { id: 'ink', name: 'Ink', color: '#2A2A2A', ink: white, requiredFeature: 'custom_themes' },
];

// ---------------------------------------------------------------- effects

export type BurstStyle = 'classic' | 'shockwave' | 'zigzag' | 'confetti' | 'starburst';

export interface EffectItem extends CatalogItem {
  description: string;
  burst: BurstStyle;
  /** Effects are deliberately short: nothing longer than ~1s. */
  durationMs: number;
  /** Optional matching sound for a "combo"; only applied if the user owns it. */
  pairedSoundId?: string;
}

export const DEFAULT_EFFECT_ID = 'classic';

export const EFFECTS: readonly EffectItem[] = [
  { id: 'classic', name: 'Classic', description: 'Bubble, burst and a quick shake.', burst: 'classic', durationMs: 700, requiredFeature: null },
  { id: 'shockwave', name: 'Shockwave', description: 'Rings ripple out from the bubble.', burst: 'shockwave', durationMs: 800, requiredFeature: 'exclusive_effects' },
  { id: 'zigzag', name: 'Thunderbolt', description: 'Lightning bolts + Thunderclap combo.', burst: 'zigzag', durationMs: 750, requiredFeature: 'exclusive_effects', pairedSoundId: 'zynk_thunder' },
  { id: 'confetti', name: 'Confetti pop', description: 'A tiny confetti cannon + Chime combo.', burst: 'confetti', durationMs: 900, requiredFeature: 'exclusive_effects', pairedSoundId: 'zynk_chime' },
  { id: 'starburst', name: 'Starburst', description: 'A spinning comic star.', burst: 'starburst', durationMs: 700, requiredFeature: 'exclusive_effects' },
];

export const DEFAULTS = {
  soundId: DEFAULT_SOUND_ID,
  effectId: DEFAULT_EFFECT_ID,
  themeId: 'night',
  accentId: 'lime',
  bubbleColorId: 'lime',
} as const;

// ---------------------------------------------------------------- lookups

const byId = <T extends { id: string }>(items: readonly T[]) => new Map(items.map((i) => [i.id, i]));
const soundsById = byId(SOUNDS);
const packsById = byId(REACTION_PACKS);
const themesById = byId(THEMES);
const accentsById = byId(ACCENTS);
const bubblesById = byId(BUBBLE_COLORS);
const effectsById = byId(EFFECTS);

export const getSound = (id: string | null | undefined) => (id ? soundsById.get(id) : undefined);
export const getTheme = (id: string | null | undefined) => (id ? themesById.get(id) : undefined);
export const getAccent = (id: string | null | undefined) => (id ? accentsById.get(id) : undefined);
export const getBubbleColor = (id: string | null | undefined) => (id ? bubblesById.get(id) : undefined);
export const getEffect = (id: string | null | undefined) => (id ? effectsById.get(id) : undefined);
export const getReactionPack = (id: string | null | undefined) => (id ? packsById.get(id) : undefined);

/** Reactions are referenced as `<packId>:<itemId>`, e.g. `basic:fire`. */
export function parseReactionRef(ref: string): { packId: string; itemId: string } | null {
  const m = /^([a-z0-9_]{1,32}):([a-z0-9_]{1,32})$/.exec(ref);
  return m && m[1] && m[2] ? { packId: m[1], itemId: m[2] } : null;
}

export function getReaction(ref: string | null | undefined): { pack: ReactionPack; item: ReactionItem } | undefined {
  if (!ref) return undefined;
  const parsed = parseReactionRef(ref);
  if (!parsed) return undefined;
  const pack = packsById.get(parsed.packId);
  const item = pack?.items.find((i) => i.id === parsed.itemId);
  return pack && item ? { pack, item } : undefined;
}

export const reactionRef = (packId: string, itemId: string) => `${packId}:${itemId}`;

/** Generic fallback when a reaction is entirely unknown to this app version. */
export const UNKNOWN_REACTION_GLYPH = '✨';
