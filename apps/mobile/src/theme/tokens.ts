import { BRAND } from '@zynk/shared';

export const palette = BRAND.colors;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 } as const;

export const fonts = {
  display: 'Unbounded_800ExtraBold',
  displayBold: 'Unbounded_700Bold',
  body: 'SpaceGrotesk_400Regular',
  bodyMedium: 'SpaceGrotesk_500Medium',
  bodyBold: 'SpaceGrotesk_700Bold',
} as const;

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 44, lineHeight: 48, letterSpacing: -1.5 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.8 },
  heading: { fontFamily: fonts.displayBold, fontSize: 19, lineHeight: 24, letterSpacing: -0.3 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: fonts.displayBold, fontSize: 16, lineHeight: 20, letterSpacing: 0.2 },
} as const;

export type TypeVariant = keyof typeof type;

export const motion = { fast: 120, base: 220, slow: 380 } as const;
