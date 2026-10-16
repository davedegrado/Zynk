import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic } from '../../lib/haptics';
import { radius, space } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

export function Button({ title, variant = 'primary', size = 'md', icon, loading, disabled, style, fullWidth, onPress, ...rest }: ButtonProps) {
  const t = useAppTheme();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;
  const bg = { primary: t.colors.accent, secondary: t.colors.surfaceAlt, ghost: 'transparent', danger: t.colors.danger }[variant];
  const fg = { primary: t.colors.onAccent, secondary: t.colors.text, ghost: t.colors.text, danger: t.colors.onDanger }[variant];
  // Light themes: a crisp ink outline keeps light accents (e.g. lime) visible on pale backgrounds.
  const border = t.scheme === 'light' && variant !== 'ghost' ? t.colors.text : variant === 'ghost' ? t.colors.border : 'transparent';
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPressIn={() => (scale.set(withSpring(0.96, { damping: 15, stiffness: 400 })))}
      onPressOut={() => (scale.set(withSpring(1, { damping: 12, stiffness: 300 })))}
      onPress={(e) => {
        void haptic.tap();
        onPress?.(e);
      }}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: bg, borderColor: border, opacity: isDisabled && !loading ? 0.45 : 1 },
        fullWidth && { alignSelf: 'stretch' },
        anim,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} color={fg} />}
          <Text variant="button" style={{ color: fg, fontSize: size === 'sm' ? 14 : 16 }}>
            {title}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

export function IconButton({ name, onPress, label, color, size = 24 }: { name: IconName; onPress: () => void; label: string; color?: string; size?: number }) {
  const t = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? t.colors.surfaceAlt : 'transparent' }]}
    >
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  md: { minHeight: 54, paddingHorizontal: space.xl },
  sm: { minHeight: 40, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
