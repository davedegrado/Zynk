import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { BRAND, getEffect, type BurstStyle } from '@zynk/shared';
import logo from '../../../assets/brand/logo-paths.json';

/**
 * The Speow animation: a speech bubble pops in with a quick shake while a burst
 * plays behind it. All effects are short (<1s), never flash, and collapse to a
 * gentle fade when reduced motion is on.
 */

const ACCENTS = [BRAND.colors.lime, BRAND.colors.pink, BRAND.colors.electricBlue, BRAND.colors.purple];

function starPoints(cx: number, cy: number, outer: number, inner: number, n: number, jitter = 0) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer * (1 - (jitter * ((i * 37) % 7)) / 10) : inner;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

// The bubble from the Speow! logo (512 viewBox): body x 40..392, y 136..408, tail tip at y 474.
const LOGO_BUBBLE = logo.layers.find((l) => l.id === 'bubble')!.d;
const VB = { x: 28, y: 124, w: 376, h: 362 };
const BODY = { x: 40, y: 136, w: 352, h: 272 };

export function BubbleShape({ size, fill, outline, children }: { size: number; fill: string; outline: string; children?: ReactNode }) {
  const height = (size * VB.h) / VB.w;
  const k = size / VB.w;
  return (
    <View style={{ width: size, height }}>
      <Svg width={size} height={height} viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} style={StyleSheet.absoluteFill}>
        <Path d={LOGO_BUBBLE} fill={fill} stroke={outline} strokeWidth={14} strokeLinejoin="round" />
      </Svg>
      <View
        style={{
          position: 'absolute',
          left: (BODY.x - VB.x) * k,
          top: (BODY.y - VB.y) * k,
          width: BODY.w * k,
          height: BODY.h * k,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Classic({ p, size, color }: { p: SharedValue<number>; size: number; color: string }) {
  const s = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
    transform: [{ scale: interpolate(p.value, [0, 0.35, 1], [0.3, 1.1, 1.25]) }, { rotate: `${interpolate(p.value, [0, 1], [-12, 6])}deg` }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, s]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Polygon points={starPoints(100, 100, 98, 62, 12, 0.6)} fill={color} />
      </Svg>
    </Animated.View>
  );
}

function Ring({ p, delay, size, color }: { p: SharedValue<number>; delay: number; size: number; color: string }) {
  const s = useAnimatedStyle(() => {
    const q = Math.min(1, Math.max(0, (p.value - delay) / (1 - delay)));
    return { opacity: interpolate(q, [0, 0.1, 1], [0, 0.9, 0]), transform: [{ scale: interpolate(q, [0, 1], [0.4, 1.35]) }] };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, s]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Circle cx={100} cy={100} r={80} stroke={color} strokeWidth={8} fill="none" />
      </Svg>
    </Animated.View>
  );
}

function Particle({ p, i, n, size, kind }: { p: SharedValue<number>; i: number; n: number; size: number; kind: 'bolt' | 'confetti' }) {
  const angle = (2 * Math.PI * i) / n + (kind === 'confetti' ? (i % 3) * 0.2 : Math.PI / n);
  const dist = size * (kind === 'confetti' ? 0.48 + (i % 3) * 0.08 : 0.5);
  const color = ACCENTS[i % ACCENTS.length]!;
  const s = useAnimatedStyle(() => {
    const e = Easing.out(Easing.cubic)(Math.min(1, p.value * 1.2));
    return {
      opacity: interpolate(p.value, [0, 0.1, 0.75, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: Math.cos(angle) * dist * e },
        { translateY: Math.sin(angle) * dist * e + (kind === 'confetti' ? p.value * p.value * 30 : 0) },
        { rotate: `${(angle * 180) / Math.PI + 90 + (kind === 'confetti' ? p.value * 360 : 0)}deg` },
        { scale: interpolate(p.value, [0, 0.3, 1], [0.4, 1, 0.8]) },
      ],
    };
  });
  const w = kind === 'bolt' ? size * 0.16 : size * 0.06;
  return (
    <Animated.View style={[styles.particle, { width: w, height: kind === 'bolt' ? w * 1.6 : w * 1.8, marginLeft: -w / 2, marginTop: -w }, s]}>
      {kind === 'bolt' ? (
        <Svg width="100%" height="100%" viewBox="0 0 24 38">
          <Path d="M15 0 2 21h9l-3 17 14-23h-9z" fill={color} stroke={BRAND.colors.ink} strokeWidth={1.5} strokeLinejoin="round" />
        </Svg>
      ) : (
        <View style={{ flex: 1, backgroundColor: color, borderRadius: 2 }} />
      )}
    </Animated.View>
  );
}

function Starburst({ p, size, color }: { p: SharedValue<number>; size: number; color: string }) {
  const s = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.1, 0.8, 1], [0, 1, 1, 0]),
    transform: [{ scale: interpolate(p.value, [0, 0.3, 1], [0.2, 1.15, 1.05]) }, { rotate: `${p.value * 140}deg` }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, s]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Polygon points={starPoints(100, 100, 98, 40, 8)} fill={color} stroke={BRAND.colors.ink} strokeWidth={4} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

function Burst({ style, p, size, color }: { style: BurstStyle; p: SharedValue<number>; size: number; color: string }) {
  switch (style) {
    case 'shockwave':
      return (
        <>
          {[0, 0.18, 0.36].map((d, i) => (
            <Ring key={d} p={p} delay={d} size={size} color={ACCENTS[(i + 1) % ACCENTS.length]!} />
          ))}
        </>
      );
    case 'zigzag':
      return (
        <>
          {Array.from({ length: 6 }, (_, i) => (
            <Particle key={i} p={p} i={i} n={6} size={size} kind="bolt" />
          ))}
        </>
      );
    case 'confetti':
      return (
        <>
          {Array.from({ length: 16 }, (_, i) => (
            <Particle key={i} p={p} i={i} n={16} size={size} kind="confetti" />
          ))}
        </>
      );
    case 'starburst':
      return <Starburst p={p} size={size} color={color} />;
    default:
      return <Classic p={p} size={size} color={color} />;
  }
}

interface ZynkBurstProps {
  /** Change this value to (re)play the animation. 0 = idle. */
  playKey: number;
  effectId: string;
  bubbleFill: string;
  outline: string;
  burstColor: string;
  size?: number;
  reduceMotion?: boolean;
  children?: ReactNode;
  onDone?: () => void;
}

export function ZynkBurst({ playKey, effectId, bubbleFill, outline, burstColor, size = 220, reduceMotion, children, onDone }: ZynkBurstProps) {
  const effect = getEffect(effectId) ?? getEffect('classic')!;
  const p = useSharedValue(0);
  const shake = useSharedValue(0);
  const pop = useSharedValue(playKey ? 0 : 1);

  useEffect(() => {
    if (!playKey) return;
    const finish = () => {
      'worklet';
      if (onDone) runOnJS(onDone)();
    };
    if (reduceMotion) {
      p.value = 0;
      pop.value = 0.9;
      pop.value = withTiming(1, { duration: 220 }, (ok) => ok && finish());
      return;
    }
    p.value = 0;
    p.value = withTiming(1, { duration: effect.durationMs, easing: Easing.out(Easing.quad) }, (ok) => ok && finish());
    pop.value = 0.2;
    pop.value = withSequence(withTiming(1.15, { duration: 160, easing: Easing.out(Easing.back(2)) }), withTiming(1, { duration: 140 }));
    shake.value = withSequence(
      withTiming(0, { duration: 140 }),
      withTiming(-9, { duration: 45 }),
      withTiming(9, { duration: 70 }),
      withTiming(-6, { duration: 60 }),
      withTiming(4, { duration: 50 }),
      withTiming(0, { duration: 45 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey]);

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? interpolate(pop.value, [0.9, 1], [0.3, 1]) : 1,
    transform: [{ scale: pop.value }, { rotate: `${shake.value}deg` }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      {!reduceMotion && playKey ? <Burst style={effect.burst} p={p} size={size} color={burstColor} /> : null}
      <Animated.View style={bubbleStyle}>
        <BubbleShape size={size * 0.62} fill={bubbleFill} outline={outline}>
          {children}
        </BubbleShape>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', left: '50%', top: '50%' },
});
