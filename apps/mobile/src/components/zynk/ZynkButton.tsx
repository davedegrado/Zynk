import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import logo from '../../../assets/brand/logo-paths.json';
import { fonts } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Text } from '../ui';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const FG_LAYERS = logo.layers.filter((l) => l.role === 'fg');
// Bubble body inside the 512 viewBox (see tools/assets/logo.mjs): x 40..392, y 136..408.
const BODY = { left: 40 / 512, top: 136 / 512, width: 352 / 512, height: 272 / 512 };

interface Props {
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  label?: string;
  accessibilityLabel: string;
}

/** The prominent "Send a Speow" button, shaped like the logo's bubble + burst. */
export function ZynkButton({ onPress, disabled, size = 200, label = 'Speow!', accessibilityLabel }: Props) {
  const t = useAppTheme();
  const scale = useSharedValue(1);
  const rot = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { rotate: `${rot.value}deg` }] }));
  const light = t.scheme === 'light';
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={() => (scale.set(withSpring(0.9, { damping: 14, stiffness: 500 })))}
      onPressOut={() => (scale.set(withSpring(1, { damping: 8, stiffness: 260 })))}
      onPress={() => {
        rot.set(withSequence(withTiming(-6, { duration: 50 }), withTiming(6, { duration: 80 }), withTiming(0, { duration: 60 })));
        onPress();
      }}
      style={[{ width: size, height: size, opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Svg width={size} height={size} viewBox={logo.viewBox} style={StyleSheet.absoluteFill}>
        {FG_LAYERS.map((l) => (
          <Path key={l.id} d={l.d} fill={t.colors.accent} stroke={light ? t.colors.text : t.colors.accent} strokeWidth={light ? 10 : 0} strokeLinejoin="round" />
        ))}
      </Svg>
      <View style={[styles.body, { left: BODY.left * size, top: BODY.top * size, width: BODY.width * size, height: BODY.height * size }]}>
        <Text
          allowFontScaling={false}
          style={{ fontFamily: fonts.display, fontSize: size * 0.115, lineHeight: size * 0.15, color: t.colors.onAccent, letterSpacing: -0.5, transform: [{ rotate: '-6deg' }] }}
        >
          {label}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

/** Compact version for list rows. */
export function ZynkMini({ onPress, disabled, accessibilityLabel }: { onPress: () => void; disabled?: boolean; accessibilityLabel: string }) {
  const t = useAppTheme();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      disabled={disabled}
      onPress={() => {
        scale.set(withSequence(withTiming(0.8, { duration: 70 }), withSpring(1, { damping: 6, stiffness: 300 })));
        onPress();
      }}
      style={[{ width: 52, height: 52, opacity: disabled ? 0.45 : 1 }, style]}
    >
      <Svg width={52} height={52} viewBox={logo.viewBox}>
        {logo.layers.map((l) => (
          <Path
            key={l.id}
            d={l.d}
            fill={l.role === 'cutout' ? (t.scheme === 'light' ? t.colors.text : t.colors.surface) : t.colors.accent}
            stroke={t.scheme === 'light' && l.role === 'fg' ? t.colors.text : undefined}
            strokeWidth={t.scheme === 'light' && l.role === 'fg' ? 16 : 0}
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  body: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
