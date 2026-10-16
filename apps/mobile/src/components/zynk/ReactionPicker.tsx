import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { hasFeature, REACTION_PACKS, reactionRef } from '@zynk/shared';
import { useFeatures } from '../../lib/hooks';
import { radius, space } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Chip, Icon, PlusBadge, Text } from '../ui';
import { ReactionGlyph } from './ReactionGlyph';

interface Props {
  value: string | null;
  onChange: (ref: string | null) => void;
  /** Called when a locked (Plus) item is tapped. */
  onLocked: () => void;
}

/** Structured reactions only: one predefined item per Zynk, never free text. */
export function ReactionPicker({ value, onChange, onLocked }: Props) {
  const t = useAppTheme();
  const features = useFeatures();
  const [packId, setPackId] = useState(REACTION_PACKS[0]!.id);
  const pack = REACTION_PACKS.find((p) => p.id === packId)!;
  const locked = !hasFeature(features, pack.requiredFeature);
  return (
    <View style={{ gap: space.md }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {REACTION_PACKS.filter((p) => !p.retired).map((p) => (
          <Chip key={p.id} label={p.name} selected={p.id === packId} onPress={() => setPackId(p.id)} />
        ))}
      </ScrollView>
      {locked ? (
        <Pressable onPress={onLocked} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <PlusBadge locked />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            Preview — {pack.description} Unlock with ZYNK Plus.
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.grid}>
        {pack.items.map((item) => {
          const ref = reactionRef(pack.id, item.id);
          const selected = value === ref;
          return (
            <Pressable
              key={ref}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}${locked ? ', ZYNK Plus' : ''}`}
              accessibilityState={{ selected }}
              onPress={() => (locked ? onLocked() : onChange(selected ? null : ref))}
              style={[
                styles.cell,
                { backgroundColor: selected ? t.colors.accent : t.colors.surfaceAlt, borderColor: selected ? t.colors.text : 'transparent' },
              ]}
            >
              <View style={{ opacity: locked ? 0.55 : 1 }}>
                <ReactionGlyph reactionId={ref} size={34} animate={!locked} />
              </View>
              {locked ? (
                <View style={[styles.lock, { backgroundColor: t.colors.text }]}>
                  <Icon name="lock" size={10} color={t.colors.background} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: 62, height: 62, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  lock: { position: 'absolute', right: 5, top: 5, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
