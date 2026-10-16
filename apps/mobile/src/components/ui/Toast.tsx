import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

type Tone = 'info' | 'success' | 'error';
interface ToastItem { id: number; message: string; tone: Tone }

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((message: string, tone: Tone = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  const bg = toast?.tone === 'error' ? t.colors.danger : toast?.tone === 'success' ? t.colors.accent : t.colors.text;
  const fg = toast?.tone === 'error' ? t.colors.onDanger : toast?.tone === 'success' ? t.colors.onAccent : t.colors.background;
  return (
    <ToastContext.Provider value={show}>
      {children}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + space.sm, alignItems: 'center' }]}>
        {toast ? (
          <Animated.View key={toast.id} entering={FadeInUp.duration(180)} exiting={FadeOutUp.duration(160)} style={[styles.toast, { backgroundColor: bg }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Text variant="bodyStrong" style={{ color: fg }} center>{toast.message}</Text>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toast: { paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.pill, maxWidth: '90%' },
});
