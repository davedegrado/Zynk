/** ZYNK brand tokens. Black (Night) and Acid Lime are primary; the rest are accents. */
export const BRAND = {
  name: 'ZYNK',
  wordmark: 'zynk',
  tagline: 'MAKE SOME NOISE.',
  colors: {
    night: '#0B0B12',
    acidLime: '#DFFF00',
    offWhite: '#F7F7F2',
    purple: '#B892FF',
    electricBlue: '#37C8FF',
    pink: '#FF6AD5',
  },
} as const;

/** Product scheme used for deep links (zynk://...). */
export const APP_SCHEME = 'zynk';
