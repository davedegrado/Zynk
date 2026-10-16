import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import {
  BRAND,
  DEFAULTS,
  getAccent,
  getBubbleColor,
  getTheme,
  readableOn,
  type ColorSwatch,
  type ThemeItem,
} from '@zynk/shared';

export interface AppTheme {
  id: string;
  scheme: 'dark' | 'light';
  colors: ThemeItem['colors'] & {
    accent: string;
    onAccent: string;
    /** Accent when used as text/icon color on the background (falls back for contrast). */
    accentText: string;
    bubble: string;
    onBubble: string;
  };
  accent: ColorSwatch;
  bubble: ColorSwatch;
}

export function buildTheme(themeId: string, accentId: string, bubbleId: string): AppTheme {
  const theme = getTheme(themeId) ?? getTheme(DEFAULTS.themeId)!;
  const accent = getAccent(accentId) ?? getAccent(DEFAULTS.accentId)!;
  const bubble = getBubbleColor(bubbleId) ?? getBubbleColor(DEFAULTS.bubbleColorId)!;
  return {
    id: theme.id,
    scheme: theme.scheme,
    accent,
    bubble,
    colors: {
      ...theme.colors,
      accent: accent.color,
      onAccent: accent.ink,
      accentText: readableOn(theme.colors.background, accent.color, theme.colors.text),
      bubble: bubble.color,
      onBubble: bubble.ink,
    },
  };
}

const ThemeContext = createContext<AppTheme>(buildTheme('night', 'lime', 'lime'));

export interface ThemeSelection {
  themeId: string;
  accentId: string;
  bubbleColorId: string;
  appearance: 'theme' | 'system';
}

/**
 * `selection` must be the *effective* (entitlement-checked) preferences from the server.
 * With appearance = "system", the free Dark/Light pair (theme ids night/daylight) follows the OS setting.
 */
export function ThemeProvider({ selection, children }: { selection: ThemeSelection | null; children: ReactNode }) {
  const system = useColorScheme();
  const value = useMemo(() => {
    if (!selection) return buildTheme('night', 'lime', 'lime');
    const themeId =
      selection.appearance === 'system' ? (system === 'light' ? 'daylight' : 'night') : selection.themeId;
    return buildTheme(themeId, selection.accentId, selection.bubbleColorId);
  }, [selection, system]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useAppTheme = () => useContext(ThemeContext);
export const brand = BRAND;
