import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useI18n } from '../../i18n';
import { space } from '../../theme/tokens';
import { Logo } from '../brand/Logo';
import { Button } from './Button';
import { Text } from './Text';

/** Branded loading indicator: the logo gives a little "nudge" shake. */
export function Loading({ label, size = 56 }: { label?: string; size?: number }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    r.value = withRepeat(
      withSequence(withTiming(-8, { duration: 90 }), withTiming(8, { duration: 90 }), withTiming(0, { duration: 90, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 500 })),
      -1,
    );
  }, [r, reduce]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label ?? t('common.loading')}>
      <Animated.View style={style}>
        <Logo size={size} />
      </Animated.View>
      {label ? <Text tone="muted">{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, body, action, onAction, art }: { title: string; body: string; action?: string; onAction?: () => void; art?: React.ReactNode }) {
  return (
    <View style={[styles.center, { paddingVertical: space.xxxl }]}>
      {art ?? <Logo size={88} />}
      <Text variant="heading" center>{title}</Text>
      <Text tone="muted" center style={{ maxWidth: 300 }}>{body}</Text>
      {action && onAction ? <Button title={action} onPress={onAction} style={{ marginTop: space.sm }} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <View style={[styles.center, { paddingVertical: space.xxl }]} accessibilityRole="alert">
      <Text variant="heading" center>{t('error.title')}</Text>
      <Text tone="muted" center style={{ maxWidth: 300 }}>{message}</Text>
      {onRetry ? <Button title={t('common.tryAgain')} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
});
