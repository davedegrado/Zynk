/**
 * Feature & entitlement model.
 *
 *   identity  →  subscription records (store state, server-side only)
 *             →  entitlement grants   (what the user is owed: "plus" until X)
 *             →  features             (what the entitlement unlocks)
 *             →  personalization      (what the user *selected*; only effective
 *                                      while the feature is available)
 *
 * Adding a new tier or a one-time purchase means adding an entitlement id and
 * mapping it to features here — nothing else in the app needs to change.
 */

export const FEATURE_IDS = [
  'custom_sounds',
  'premium_emoji_packs',
  'custom_themes',
  'exclusive_effects',
] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

export const ENTITLEMENT_IDS = ['plus'] as const;
export type EntitlementId = (typeof ENTITLEMENT_IDS)[number];

export const ENTITLEMENT_FEATURES: Record<EntitlementId, readonly FeatureId[]> = {
  plus: ['custom_sounds', 'premium_emoji_packs', 'custom_themes', 'exclusive_effects'],
};

export const FEATURE_INFO: Record<FeatureId, { title: string; description: string }> = {
  custom_sounds: {
    title: 'Custom sounds',
    description: 'Exclusive original Zynk sounds, per-friend sounds and your own outgoing sound.',
  },
  premium_emoji_packs: {
    title: 'Premium reactions',
    description: 'Exclusive Y2K reaction packs and animated reactions to attach to your Zynks.',
  },
  custom_themes: {
    title: 'Colors & themes',
    description: 'Your own accent color, Zynk bubble color and extra app themes.',
  },
  exclusive_effects: {
    title: 'Exclusive effects',
    description: 'Alternative impact animations, burst styles and sound combos.',
  },
};

export function isFeatureId(value: unknown): value is FeatureId {
  return typeof value === 'string' && (FEATURE_IDS as readonly string[]).includes(value);
}

export function isEntitlementId(value: unknown): value is EntitlementId {
  return typeof value === 'string' && (ENTITLEMENT_IDS as readonly string[]).includes(value);
}
