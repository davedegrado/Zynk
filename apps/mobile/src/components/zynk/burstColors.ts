import { BRAND } from '@zynk/shared';
import type { AppTheme } from '../../theme/ThemeProvider';

/**
 * Comic-style colors for a Speow: the bubble always gets an ink outline,
 * and the burst switches to a contrasting color when it would match the bubble.
 */
export function burstColorsFor(t: AppTheme, bubbleColor: string) {
  const burst = bubbleColor.toLowerCase() === t.colors.accent.toLowerCase() ? (t.scheme === 'dark' ? BRAND.colors.white : BRAND.colors.ink) : t.colors.accent;
  return { outline: BRAND.colors.ink, burst };
}
