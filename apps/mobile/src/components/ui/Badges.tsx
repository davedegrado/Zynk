import { Pressable, StyleSheet, View } from 'react-native';
import { radius, space } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

export function PlusBadge({ locked }: { locked?: boolean }) {
  const t = useAppTheme();
  return (
    <View style={[styles.badge, { backgroundColor: t.colors.text }]} accessibilityLabel={locked ? 'Speow Plus, locked' : 'Speow Plus'}>
      {locked ? <Icon name="lock" size={12} color={t.colors.background} /> : null}
      <Text variant="label" style={{ color: t.colors.background, fontSize: 10, lineHeight: 12 }}>Plus</Text>
    </View>
  );
}

export function CountBadge({ count }: { count: number }) {
  const t = useAppTheme();
  if (count <= 0) return null;
  return (
    <View style={[styles.count, { backgroundColor: t.colors.accent }, t.scheme === 'light' && { borderWidth: 1.5, borderColor: t.colors.text }]} accessibilityLabel={`${count} new`}>
      <Text variant="label" style={{ color: t.colors.onAccent, fontSize: 11, lineHeight: 14 }}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const t = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? t.colors.text : t.colors.surface, borderColor: selected ? t.colors.text : t.colors.border }]}
    >
      <Text variant="caption" style={{ color: selected ? t.colors.background : t.colors.text, fontFamily: 'SpaceGrotesk_700Bold' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill },
  count: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1.5 },
});
