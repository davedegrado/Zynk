import { BRAND, contrastRatio } from '@zynk/shared';
import { buildTheme } from '../theme/ThemeProvider';

describe('buildTheme', () => {
  it('builds the default Night + Acid Lime brand theme', () => {
    const t = buildTheme('night', 'lime', 'lime');
    expect(t.scheme).toBe('dark');
    expect(t.colors.background).toBe(BRAND.colors.ink);
    expect(t.colors.accent).toBe(BRAND.colors.lime);
    expect(t.colors.accentText).toBe(BRAND.colors.lime);
  });

  it('never uses an unreadable accent as text (lime on the Light theme falls back to ink)', () => {
    const t = buildTheme('daylight', 'lime', 'lime');
    expect(t.colors.accentText).toBe(t.colors.text);
    expect(contrastRatio(t.colors.background, t.colors.accentText)).toBeGreaterThanOrEqual(4.5);
  });

  it('falls back to defaults for unknown ids', () => {
    const t = buildTheme('nope', 'nope', 'nope');
    expect(t.id).toBe('night');
    expect(t.accent.id).toBe('lime');
    expect(t.bubble.id).toBe('lime');
  });
});
