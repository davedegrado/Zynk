import { SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Unbounded_700Bold, Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DialogProvider, ToastProvider } from '../components/ui';
import { usePreferences } from '../lib/hooks';
import { queryClient } from '../lib/query';
import { SessionProvider, useSession } from '../lib/session';
import { ThemeProvider, useAppTheme } from '../theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Applies the user's *effective* appearance (entitlement-checked by the server). */
function ThemedRoot({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const prefs = usePreferences().data?.effective;
  const selection = useMemo(
    () =>
      status === 'signedIn' && prefs
        ? { themeId: prefs.themeId, accentId: prefs.accentId, bubbleColorId: prefs.bubbleColorId, appearance: prefs.appearance }
        : null,
    [status, prefs],
  );
  return <ThemeProvider selection={selection}>{children}</ThemeProvider>;
}

function Navigation() {
  const t = useAppTheme();
  const { status } = useSession();
  const navTheme = useMemo(() => {
    const base = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, background: t.colors.background, card: t.colors.surface, text: t.colors.text, border: t.colors.border, primary: t.colors.accentText },
    };
  }, [t]);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <DialogProvider>
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.background }, animation: 'fade_from_bottom' }} />
        </ToastProvider>
      </DialogProvider>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Unbounded_700Bold,
    Unbounded_800ExtraBold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  if (!fontsLoaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <ThemedRoot>
              <Navigation />
            </ThemedRoot>
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
