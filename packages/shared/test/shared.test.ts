import { describe, expect, it } from 'vitest';
import {
  ACCENTS,
  BUBBLE_COLORS,
  contrastRatio,
  describeReaction,
  effectiveSelection,
  EFFECTS,
  getReaction,
  REACTION_PACKS,
  resolveFeatures,
  resolveIncomingPresentation,
  resolveIncomingSound,
  SOUNDS,
  THEMES,
  usernameSchema,
  type PersonalizationSelection,
} from '../src';

const day = 24 * 3600 * 1000;
const now = new Date('2026-10-16T12:00:00Z');
const grant = (o: Partial<{ entitlement: string; startsAt: Date; expiresAt: Date | null; revokedAt: Date | null }> = {}) => ({
  entitlement: 'plus',
  startsAt: new Date(now.getTime() - day),
  expiresAt: new Date(now.getTime() + day),
  revokedAt: null,
  ...o,
});

describe('entitlement resolution', () => {
  it('free users have no premium features', () => {
    expect(resolveFeatures([], now)).toEqual([]);
  });
  it('an active plus grant unlocks all plus features', () => {
    expect(resolveFeatures([grant()], now)).toEqual(['custom_sounds', 'custom_themes', 'exclusive_effects', 'premium_emoji_packs']);
  });
  it('expired, revoked, future and unknown grants unlock nothing', () => {
    expect(resolveFeatures([grant({ expiresAt: new Date(now.getTime() - 1) })], now)).toEqual([]);
    expect(resolveFeatures([grant({ revokedAt: now })], now)).toEqual([]);
    expect(resolveFeatures([grant({ startsAt: new Date(now.getTime() + 1000) })], now)).toEqual([]);
    expect(resolveFeatures([grant({ entitlement: 'gold' })], now)).toEqual([]);
  });
  it('a grant with no expiry (lifetime/promo) stays active', () => {
    expect(resolveFeatures([grant({ expiresAt: null })], now)).toHaveLength(4);
  });
});

describe('catalogs', () => {
  const all = [SOUNDS, REACTION_PACKS, THEMES, ACCENTS, BUBBLE_COLORS, EFFECTS];
  it('ids are unique and stable-looking', () => {
    for (const items of all) {
      const ids = items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9_]+$/);
    }
    for (const p of REACTION_PACKS) {
      const ids = p.items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it('every category has at least one free item', () => {
    for (const items of all) expect(items.some((i) => i.requiredFeature === null)).toBe(true);
  });
  it('sound files are android res/raw safe', () => {
    for (const s of SOUNDS) expect(s.file).toMatch(/^[a-z][a-z0-9_]*$/);
  });
  it('effects are short and combos reference real sounds', () => {
    for (const e of EFFECTS) {
      expect(e.durationMs).toBeLessThanOrEqual(1000);
      if (e.pairedSoundId) expect(SOUNDS.some((s) => s.id === e.pairedSoundId)).toBe(true);
    }
  });
  it('all swatches have accessible ink (WCAG AA 4.5:1)', () => {
    for (const s of [...ACCENTS, ...BUBBLE_COLORS]) expect(contrastRatio(s.color, s.ink)).toBeGreaterThanOrEqual(4.5);
  });
  it('theme text is readable on every surface', () => {
    for (const t of THEMES) {
      for (const bg of [t.colors.background, t.colors.surface, t.colors.surfaceAlt]) {
        expect(contrastRatio(bg, t.colors.text)).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(bg, t.colors.textMuted)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(t.colors.danger, t.colors.onDanger)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('reaction lookups and fallbacks', () => {
    expect(getReaction('basic:fire')?.item.glyph).toBe('🔥');
    expect(getReaction('nope:fire')).toBeUndefined();
    expect(describeReaction('future_pack:thing', '🦄')).toMatchObject({ known: false, glyph: '🦄' });
    expect(describeReaction('future_pack:thing', null)?.glyph).toBeTruthy();
    expect(describeReaction(null)).toBeNull();
  });
});

describe('personalization', () => {
  const premium: PersonalizationSelection = {
    incomingSoundId: 'zynk_boing',
    outgoingSoundId: 'zynk_laser',
    themeId: 'ultraviolet',
    accentId: 'pink',
    bubbleColorId: 'blue',
    effectId: 'shockwave',
  };
  it('premium selections fall back to free defaults without the feature', () => {
    expect(effectiveSelection(premium, [])).toEqual({
      incomingSoundId: 'zynk_classic',
      outgoingSoundId: 'zynk_classic',
      themeId: 'night',
      accentId: 'lime',
      bubbleColorId: 'lime',
      effectId: 'classic',
    });
  });
  it('premium selections stay with the feature', () => {
    expect(effectiveSelection(premium, ['custom_sounds', 'custom_themes', 'exclusive_effects'])).toEqual(premium);
  });

  const recipient = { soundsEnabled: true, allowSenderSounds: true, incomingSoundId: 'zynk_classic' };
  it('a free recipient hears the sender premium sound if they allow it', () => {
    expect(resolveIncomingSound({ senderSoundId: 'zynk_laser', recipient, recipientFeatures: [] })).toBe('zynk_laser');
  });
  it('recipient settings take precedence over the sender', () => {
    expect(resolveIncomingSound({ senderSoundId: 'zynk_laser', recipient: { ...recipient, soundsEnabled: false }, recipientFeatures: [] })).toBeNull();
    expect(resolveIncomingSound({ senderSoundId: 'zynk_laser', recipient: { ...recipient, allowSenderSounds: false }, recipientFeatures: [] })).toBe('zynk_classic');
    expect(
      resolveIncomingSound({ senderSoundId: 'zynk_laser', recipient, recipientFeatures: ['custom_sounds'], friendOverrideSoundId: 'zynk_coin' }),
    ).toBe('zynk_coin');
  });
  it('per-friend sounds stop working when the recipient loses Plus', () => {
    expect(resolveIncomingSound({ senderSoundId: null, recipient, recipientFeatures: [], friendOverrideSoundId: 'zynk_coin' })).toBe('zynk_classic');
  });
  it('unknown sender sounds are ignored', () => {
    expect(resolveIncomingSound({ senderSoundId: 'zynk_future', recipient, recipientFeatures: [] })).toBe('zynk_classic');
  });

  const display = { showSenderStyle: true, reduceMotion: false, bubbleColorId: 'lime', effectId: 'classic' };
  it('shows sender style unless the recipient opted out or prefers reduced motion', () => {
    const ev = { effectId: 'shockwave', bubbleColorId: 'pink' };
    expect(resolveIncomingPresentation(ev, display)).toEqual({ effectId: 'shockwave', bubbleColorId: 'pink', reduceMotion: false });
    expect(resolveIncomingPresentation(ev, { ...display, showSenderStyle: false })).toEqual({ effectId: 'classic', bubbleColorId: 'lime', reduceMotion: false });
    expect(resolveIncomingPresentation(ev, display, true)).toMatchObject({ effectId: 'classic', reduceMotion: true });
  });
});

describe('usernames', () => {
  it('normalizes and validates', () => {
    expect(usernameSchema.parse('  Sam_99 ')).toBe('sam_99');
    for (const bad of ['ab', '_sam', 'sam.', 'sa__m', 'sam!', 'a'.repeat(21), 'säm']) {
      expect(usernameSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe('brand', () => {
  it('uses the Speow! identity and palette', async () => {
    const { BRAND, THEMES } = await import('../src');
    expect(BRAND.name).toBe('Speow!');
    expect(BRAND.colors).toMatchObject({ lime: '#D7FF36', ink: '#111111', white: '#FFFFFF' });
    const dark = THEMES.find((t) => t.id === 'night')!;
    expect(dark.colors.background).toBe('#111111');
    // Acid lime on near-black must be comfortably readable (it's the primary accent).
    expect(contrastRatio(BRAND.colors.lime, BRAND.colors.ink)).toBeGreaterThanOrEqual(7);
  });
});
