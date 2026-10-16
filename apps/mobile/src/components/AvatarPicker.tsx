import { Pressable, StyleSheet, View } from 'react-native';
import { AVATAR_COLORS, AVATARS, type Avatar } from '@zynk/shared';
import { useI18n } from '../i18n';
import { space } from '../theme/tokens';
import { useAppTheme } from '../theme/ThemeProvider';
import { AvatarArt, Icon, Text } from './ui';

/** Free avatar chooser: a drawn character + a background color. */
export function AvatarPicker({ value, onChange }: { value: Avatar; onChange: (a: Avatar) => void }) {
  const t = useAppTheme();
  const { t: tr, td } = useI18n();
  return (
    <View style={{ gap: space.lg }}>
      <View style={styles.grid}>
        {AVATARS.map((id) => {
          const selected = value.id === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={td(`avatar.${id}`, id)}
              onPress={() => onChange({ ...value, id })}
              style={[styles.cell, { borderColor: selected ? t.colors.text : 'transparent' }]}
            >
              <AvatarArt avatarId={id} colorId={value.color} size={58} />
            </Pressable>
          );
        })}
      </View>
      <View style={{ gap: space.sm }}>
        <Text variant="label" tone="muted">{tr('avatar.background')}</Text>
        <View style={styles.colors}>
          {AVATAR_COLORS.map((c) => {
            const selected = value.color === c.id;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={td(`color.${c.id}`, c.name)}
                onPress={() => onChange({ ...value, color: c.id })}
                style={[styles.swatch, { backgroundColor: c.color, borderColor: selected ? t.colors.text : t.colors.border }]}
              >
                {selected ? <Icon name="check" size={18} color={c.ink} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  cell: { borderWidth: 3, borderRadius: 40, padding: 2 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
