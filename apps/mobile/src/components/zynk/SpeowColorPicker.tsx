import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import logo from '../../../assets/brand/logo-paths.json';
import { BUBBLE_COLORS } from '@zynk/shared';
import { useI18n } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { space } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';

const BUBBLE = logo.layers.find((l) => l.id === 'bubble')!.d;

/** Free per-Speow color choice, drawn as little speech bubbles. */
export function SpeowColorPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const theme = useAppTheme();
  const { td, t } = useI18n();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('send.color')}>
      {BUBBLE_COLORS.filter((c) => !c.retired).map((c) => {
        const selected = c.id === value;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={td(`color.${c.id}`, c.name)}
            onPress={() => {
              void haptic.tap();
              onChange(c.id);
            }}
            style={[styles.cell, selected && { transform: [{ scale: 1.18 }] }]}
            hitSlop={4}
          >
            <Svg width={40} height={40} viewBox="20 110 400 380">
              <Path
                d={BUBBLE}
                fill={c.color}
                stroke={selected ? theme.colors.text : theme.colors.border}
                strokeWidth={selected ? 34 : 18}
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm, paddingVertical: space.sm },
  cell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
