import { useEffect } from 'react';
import { Text as RNText, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Polygon, Rect } from 'react-native-svg';
import { BRAND, describeReaction, getReaction } from '@zynk/shared';

const { night: N, acidLime: L, pink: P, electricBlue: B, purple: U, offWhite: W } = BRAND.colors;
const stroke = { stroke: N, strokeWidth: 5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** Custom-drawn Y2K sticker pack (original vector art, 100×100 viewBox). */
const Y2K: Record<string, () => React.ReactElement> = {
  sparkle: () => (
    <>
      <Path d="M50 6c4 26 12 34 38 38-26 4-34 12-38 38-4-26-12-34-38-38 26-4 34-12 38-38z" fill={L} {...stroke} />
      <Path d="M80 66c2 9 5 12 13 13-8 2-11 5-13 13-2-8-5-11-13-13 8-1 11-4 13-13z" fill={P} {...stroke} strokeWidth={4} />
    </>
  ),
  bolt: () => <Path d="M58 4 18 56h26l-8 40 46-58H55z" fill={L} {...stroke} />,
  disc: () => (
    <>
      <Circle cx={50} cy={50} r={42} fill={U} {...stroke} />
      <Path d="M24 36a30 30 0 0 1 22-16" stroke={W} strokeWidth={6} strokeLinecap="round" fill="none" />
      <Circle cx={50} cy={50} r={12} fill={W} {...stroke} />
      <Circle cx={50} cy={50} r={3} fill={N} />
    </>
  ),
  flip: () => (
    <>
      <Rect x={28} y={8} width={44} height={84} rx={12} fill={B} {...stroke} />
      <Rect x={36} y={18} width={28} height={26} rx={4} fill={L} {...stroke} strokeWidth={4} />
      <Path d="M28 52h44" {...stroke} />
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <Circle key={`${r}${c}`} cx={40 + c * 10} cy={62 + r * 9} r={3} fill={N} />))}
    </>
  ),
  butterfly: () => (
    <>
      <Path d="M50 46C36 18 10 14 12 36c1 12 14 18 34 14C26 56 18 76 32 84c12 6 16-14 18-30z" fill={P} {...stroke} />
      <Path d="M50 46C64 18 90 14 88 36c-1 12-14 18-34 14 20 6 28 26 14 34-12 6-16-14-18-30z" fill={U} {...stroke} />
      <Path d="M50 30v52M50 30l-6-12M50 30l6-12" {...stroke} />
    </>
  ),
  alien: () => (
    <>
      <Path d="M50 8c22 0 38 16 38 36 0 24-22 48-38 48S12 68 12 44C12 24 28 8 50 8z" fill={L} {...stroke} />
      <Ellipse cx={34} cy={46} rx={11} ry={15} transform="rotate(-25 34 46)" fill={N} />
      <Ellipse cx={66} cy={46} rx={11} ry={15} transform="rotate(25 66 46)" fill={N} />
      <Path d="M42 74q8 5 16 0" {...stroke} fill="none" />
    </>
  ),
  smiley: () => (
    <>
      <Circle cx={50} cy={50} r={42} fill={L} {...stroke} />
      <Path d="M36 32v14M64 32v14" {...stroke} strokeWidth={7} />
      <Path d="M26 58q24 26 48 0" {...stroke} fill="none" strokeWidth={6} />
    </>
  ),
  pixel_heart: () => (
    <Polygon
      points="20,20 40,20 40,28 48,28 48,36 52,36 52,28 60,28 60,20 80,20 80,28 88,28 88,52 80,52 80,60 72,60 72,68 64,68 64,76 56,76 56,84 44,84 44,76 36,76 36,68 28,68 28,60 20,60 20,52 12,52 12,28 20,28"
      fill={P}
      {...stroke}
      strokeLinejoin="miter"
    />
  ),
};

function Animated_({ id, children }: { id: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    v.value = withRepeat(withSequence(withTiming(1, { duration: 380, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 380, easing: Easing.inOut(Easing.quad) })), 3);
  }, [v, reduce]);
  const style = useAnimatedStyle(() => {
    switch (id) {
      case 'bounce_heart':
      case 'pulse_ghost':
        return { transform: [{ scale: 1 + v.value * 0.18 }] };
      case 'spin_star':
        return { transform: [{ rotate: `${v.value * 180}deg` }] };
      case 'hop_frog':
        return { transform: [{ translateY: -v.value * 10 }] };
      default:
        return { transform: [{ rotate: `${(v.value - 0.5) * 24}deg` }] };
    }
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * Renders a reaction for anyone — owning the pack is only required to *send* it.
 * Unknown refs (e.g. a pack added in a newer app version) fall back to the
 * Unicode glyph stored on the event.
 */
export function ReactionGlyph({ reactionId, fallback, size = 40, animate = true }: { reactionId: string | null | undefined; fallback?: string | null; size?: number; animate?: boolean }) {
  const desc = describeReaction(reactionId, fallback);
  if (!desc) return null;
  const found = getReaction(reactionId);
  const label = desc.label;
  if (found?.item.kind === 'vector' && Y2K[found.item.id]) {
    const Art = Y2K[found.item.id]!;
    return (
      <View accessible accessibilityLabel={label} style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Art />
        </Svg>
      </View>
    );
  }
  const glyph = (
    <RNText accessibilityLabel={label} allowFontScaling={false} style={{ fontSize: size * 0.82, lineHeight: size * 1.05, textAlign: 'center' }}>
      {desc.glyph}
    </RNText>
  );
  return found?.item.animated && animate ? <Animated_ id={found.item.id}>{glyph}</Animated_> : glyph;
}
