import { BRAND } from '@zynk/shared';
import type { AppTheme } from '../../theme/ThemeProvider';

/**
 * Comic-style colors for a Zynk: the bubble always gets a Night ink outline,
 * and the burst switches to a contrasting color when it would match the bubble.
 */
export function burstColorsFor(t: AppTheme, bubbleColor: string) {
  const burst = bubbleColor.toLowerCase() === t.colors.accent.toLowerCase() ? (t.scheme === 'dark' ? BRAND.colors.offWhite : BRAND.colors.night) : t.colors.accent;
  return { outline: BRAND.colors.night, burst };
}
