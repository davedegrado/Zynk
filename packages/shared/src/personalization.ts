/**
 * Personalization resolution. Two rules drive everything here:
 *
 * 1. A *selection* is only *effective* while the user owns the feature it needs.
 *    Selections are kept when a subscription lapses, so re-subscribing restores
 *    them, but they silently fall back to Free defaults in the meantime.
 * 2. On the receiving side, the recipient's settings always win. A sender's
 *    sound/effect/color travels with the Speow as a *suggestion*.
 */
import {
  DEFAULTS,
  getAccent,
  getBubbleColor,
  getEffect,
  getReaction,
  getSound,
  getTheme,
  UNKNOWN_REACTION_GLYPH,
} from './catalog';
import { hasFeature, type FeatureSet } from './entitlements';
import type { FeatureId } from './features';

export interface PersonalizationSelection {
  incomingSoundId: string;
  outgoingSoundId: string;
  themeId: string;
  accentId: string;
  bubbleColorId: string;
  effectId: string;
}

type Lookup = (id: string) => { requiredFeature: FeatureId | null; retired?: boolean } | undefined;

/** True if `id` exists, isn't retired and is available with `features`. */
export function isSelectable(lookup: Lookup, id: string, features: FeatureSet): boolean {
  const item = lookup(id);
  return !!item && !item.retired && hasFeature(features, item.requiredFeature);
}

/** True if `id` exists and is available with `features` (retired items still render). */
function isUsable(lookup: Lookup, id: string, features: FeatureSet): boolean {
  const item = lookup(id);
  return !!item && hasFeature(features, item.requiredFeature);
}

export function effectiveSelection(sel: PersonalizationSelection, features: FeatureSet): PersonalizationSelection {
  return {
    incomingSoundId: isUsable(getSound, sel.incomingSoundId, features) ? sel.incomingSoundId : DEFAULTS.soundId,
    outgoingSoundId: isUsable(getSound, sel.outgoingSoundId, features) ? sel.outgoingSoundId : DEFAULTS.soundId,
    themeId: isUsable(getTheme, sel.themeId, features) ? sel.themeId : DEFAULTS.themeId,
    accentId: isUsable(getAccent, sel.accentId, features) ? sel.accentId : DEFAULTS.accentId,
    bubbleColorId: isUsable(getBubbleColor, sel.bubbleColorId, features) ? sel.bubbleColorId : DEFAULTS.bubbleColorId,
    effectId: isUsable(getEffect, sel.effectId, features) ? sel.effectId : DEFAULTS.effectId,
  };
}

// ------------------------------------------------------------ incoming sound

export interface RecipientSoundSettings {
  /** Master switch for Speow sounds on this device/account. */
  soundsEnabled: boolean;
  /** Whether friends' chosen sounds may play. */
  allowSenderSounds: boolean;
  /** The recipient's own (effective) incoming sound. */
  incomingSoundId: string;
}

export interface IncomingSoundInput {
  senderSoundId: string | null | undefined;
  recipient: RecipientSoundSettings;
  recipientFeatures: FeatureSet;
  /** Sound the recipient assigned to this particular friend, if any. */
  friendOverrideSoundId?: string | null;
}

/**
 * Which sound (if any) a received Speow should use. Returns `null` for silence.
 * Note: this is a *request* to the device. The OS (silent switch, Focus/DND,
 * notification permission) always has the final word.
 */
export function resolveIncomingSound(input: IncomingSoundInput): string | null {
  const { recipient, recipientFeatures, friendOverrideSoundId, senderSoundId } = input;
  if (!recipient.soundsEnabled) return null;

  // Per-friend sounds are a recipient-side Plus feature.
  if (
    friendOverrideSoundId &&
    hasFeature(recipientFeatures, 'custom_sounds') &&
    isUsable(getSound, friendOverrideSoundId, recipientFeatures)
  ) {
    return friendOverrideSoundId;
  }

  // The sender's sound was validated against the *sender's* entitlement at send
  // time; the recipient doesn't need to own it to hear it.
  if (recipient.allowSenderSounds && senderSoundId && getSound(senderSoundId)) {
    return senderSoundId;
  }

  return isUsable(getSound, recipient.incomingSoundId, recipientFeatures)
    ? recipient.incomingSoundId
    : DEFAULTS.soundId;
}

// ------------------------------------------------------------ incoming visuals

export interface RecipientDisplaySettings {
  showSenderStyle: boolean;
  reduceMotion: boolean;
  /** The recipient's own effective bubble color and effect. */
  bubbleColorId: string;
  effectId: string;
}

export interface IncomingPresentation {
  effectId: string;
  bubbleColorId: string;
  reduceMotion: boolean;
}

export function resolveIncomingPresentation(
  event: { effectId: string | null | undefined; bubbleColorId: string | null | undefined },
  recipient: RecipientDisplaySettings,
  systemReduceMotion = false,
): IncomingPresentation {
  const reduceMotion = recipient.reduceMotion || systemReduceMotion;
  const useSender = recipient.showSenderStyle;
  const effectId = useSender && event.effectId && getEffect(event.effectId) ? event.effectId : recipient.effectId;
  const bubbleColorId =
    useSender && event.bubbleColorId && getBubbleColor(event.bubbleColorId) ? event.bubbleColorId : recipient.bubbleColorId;
  return {
    // Reduced motion always renders the calm default animation.
    effectId: reduceMotion ? DEFAULTS.effectId : effectId,
    bubbleColorId,
    reduceMotion,
  };
}

/** What to display for a reaction ref, with graceful fallback for unknown packs. */
export function describeReaction(
  ref: string | null | undefined,
  fallbackGlyph?: string | null,
): { known: boolean; glyph: string; label: string; ref: string } | null {
  if (!ref) return null;
  const found = getReaction(ref);
  if (found) return { known: true, glyph: found.item.glyph, label: found.item.label, ref };
  return { known: false, glyph: fallbackGlyph || UNKNOWN_REACTION_GLYPH, label: 'Reaction', ref };
}
