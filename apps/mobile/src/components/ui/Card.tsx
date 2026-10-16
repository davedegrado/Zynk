import { Pressable, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { radius, space } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';

export function Card({ style, onPress, children, ...rest }: ViewProps & { onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useAppTheme();
  const base = [styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }, style];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed && { backgroundColor: t.colors.surfaceAlt }]} {...rest}>
        {children}
      </Pressable>
    );
  }
  return (
    <View style={base} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg },
});
