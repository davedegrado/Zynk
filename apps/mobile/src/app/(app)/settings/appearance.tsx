import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { ACCENTS, BUBBLE_COLORS, EFFECTS, getBubbleColor, getSound, hasFeature, THEMES, type ColorSwatch } from '@zynk/shared';
import { Divider, Icon, PlusBadge, Screen, Section, Text, ToggleRow } from '../../../components/ui';
import { burstColorsFor } from '../../../components/zynk/burstColors';
import { ZynkBurst } from '../../../components/zynk/ZynkBurst';
import { useFeatures, usePreferences } from '../../../lib/hooks';
import { useUpdatePrefs } from '../../../lib/prefs';
import { playSound } from '../../../lib/sounds';
import { radius, space } from '../../../theme/tokens';
import { useAppTheme } from '../../../theme/ThemeProvider';

function Swatches({ items, value, onSelect, label }: { items: readonly ColorSwatch[]; value: string; onSelect: (id: string) => void; label: string }) {
  const t = useAppTheme();
  const features = useFeatures();
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label" tone="muted">{label}</Text>
      <View style={styles.swatches}>
        {items.map((s) => {
          const locked = !hasFeature(features, s.requiredFeature);
          const selected = value === s.id;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="radio"
              accessibilityLabel={`${s.name}${locked ? ', ZYNK Plus' : ''}`}
              accessibilityState={{ checked: selected }}
              onPress={() => (locked ? router.push('/plus') : onSelect(s.id))}
              style={[styles.swatch, { backgroundColor: s.color, borderColor: selected ? t.colors.text : t.colors.border }]}
            >
              {selected ? <Icon name="check" color={s.ink} /> : locked ? <Icon name="lock" size={16} color={s.ink} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AppearanceSettings() {
  const t = useAppTheme();
  const prefs = usePreferences().data?.selected;
  const features = useFeatures();
  const update = useUpdatePrefs();
  const systemReduce = useReducedMotion();
  const [preview, setPreview] = useState<{ id: string; key: number } | null>(null);
  if (!prefs) return <Screen back title="Look & effects"><Text tone="muted">Loading…</Text></Screen>;
  const bubble = getBubbleColor(prefs.bubbleColorId) ?? getBubbleColor('lime')!;

  return (
    <Screen back title="Look & effects" subtitle="How ZYNK looks for you — and how your Zynks look when they land.">
      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">Theme</Text>
        <View style={styles.themes}>
          {THEMES.map((th) => {
            const locked = !hasFeature(features, th.requiredFeature);
            const selected = prefs.appearance === 'theme' && prefs.themeId === th.id;
            return (
              <Pressable
                key={th.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${th.name} theme${locked ? ', ZYNK Plus' : ''}`}
                onPress={() => (locked ? router.push('/plus') : update.mutate({ themeId: th.id, appearance: 'theme' }))}
                style={[styles.theme, { backgroundColor: th.colors.background, borderColor: selected ? t.colors.accent : th.colors.border }]}
              >
                <View style={[styles.themeBar, { backgroundColor: th.colors.surfaceAlt }]} />
                <View style={[styles.themeDot, { backgroundColor: ACCENTS.find((a) => a.id === th.defaultAccentId)?.color }]} />
                <Text variant="caption" style={{ color: th.colors.text, fontFamily: 'SpaceGrotesk_700Bold' }}>{th.name}</Text>
                {locked ? <View style={styles.themeBadge}><PlusBadge locked /></View> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
      <Section>
        <ToggleRow
          title="Match system (Night / Daylight)"
          value={prefs.appearance === 'system'}
          onChange={(v) => update.mutate({ appearance: v ? 'system' : 'theme' })}
        />
      </Section>

      <Swatches label="Accent color" items={ACCENTS} value={prefs.accentId} onSelect={(id) => update.mutate({ accentId: id })} />
      <Swatches label="Zynk bubble" items={BUBBLE_COLORS} value={prefs.bubbleColorId} onSelect={(id) => update.mutate({ bubbleColorId: id })} />

      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">Zynk effect</Text>
        <View style={{ alignItems: 'center', height: 200, justifyContent: 'center' }}>
          <ZynkBurst
            playKey={preview?.key ?? 0}
            effectId={preview?.id ?? prefs.effectId}
            reduceMotion={prefs.reduceMotion || systemReduce}
            bubbleFill={bubble.color}
            outline={burstColorsFor(t, bubble.color).outline}
            burstColor={burstColorsFor(t, bubble.color).burst}
            size={200}
          >
            <Text variant="hero" style={{ color: bubble.ink, fontSize: 56, lineHeight: 64 }}>!</Text>
          </ZynkBurst>
        </View>
        <Section>
          {EFFECTS.map((e, i) => {
            const locked = !hasFeature(features, e.requiredFeature);
            const selected = prefs.effectId === e.id;
            return (
              <View key={e.id}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${e.name}${locked ? ', ZYNK Plus, tap to preview' : ''}`}
                  onPress={() => {
                    setPreview({ id: e.id, key: Date.now() });
                    if (e.pairedSoundId && prefs.soundsEnabled) void playSound(e.pairedSoundId, 0.7);
                    if (!locked) update.mutate({ effectId: e.id });
                  }}
                  style={styles.effectRow}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">{e.name}</Text>
                    <Text variant="caption" tone="muted">
                      {e.description}
                      {e.pairedSoundId ? ` (${getSound(e.pairedSoundId)?.name})` : ''}
                    </Text>
                  </View>
                  {locked ? <PlusBadge locked /> : selected ? <Icon name="check" color={t.colors.accentText} /> : null}
                </Pressable>
                {i < EFFECTS.length - 1 ? <Divider /> : null}
              </View>
            );
          })}
        </Section>
        {EFFECTS.some((e) => !hasFeature(features, e.requiredFeature)) ? (
          <Text variant="caption" tone="muted">Tap a locked effect to preview it. Unlock all effects with ZYNK Plus.</Text>
        ) : null}
      </View>

      <Section title="Received Zynks" footer="Your settings always decide how Zynks look on your phone.">
        <ToggleRow title="Show friends' colors & effects" value={prefs.showSenderStyle} onChange={(v) => update.mutate({ showSenderStyle: v })} />
        <Divider />
        <ToggleRow title="Reduce motion" subtitle="Calm fade instead of bursts and shakes" value={prefs.reduceMotion} onChange={(v) => update.mutate({ reduceMotion: v })} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  theme: { width: '31%', aspectRatio: 0.8, borderRadius: radius.md, borderWidth: 2.5, padding: space.sm, justifyContent: 'flex-end', gap: space.xs },
  themeBar: { position: 'absolute', top: space.sm, left: space.sm, right: space.sm, height: 14, borderRadius: 7 },
  themeDot: { width: 22, height: 22, borderRadius: 11 },
  themeBadge: { position: 'absolute', top: space.xl + 6, right: space.sm },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  effectRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 60 },
});
