/** Speow! brand tokens. Near-black (ink) and Acid Lime are primary; the rest are accents. */
export const BRAND = {
  name: 'Speow!',
  /** Wordmark text (the "!" is part of the name). */
  wordmark: 'Speow!',
  /** The core action, used in copy: "Send a Speow". */
  action: 'Speow',
  tagline: 'SEND A SPEOW.',
  colors: {
    ink: '#111111',
    lime: '#D7FF36',
    white: '#FFFFFF',
    // Neutral grays for secondary text, dividers and disabled states.
    gray100: '#F2F2F2',
    gray300: '#D4D4D4',
    gray500: '#8A8A8A',
    gray700: '#3A3A3A',
    gray900: '#1C1C1C',
    // Secondary accents (premium themes and colors).
    purple: '#B892FF',
    electricBlue: '#37C8FF',
    pink: '#FF6AD5',
  },
} as const;

/**
 * URL scheme for deep links (zynk://...). Deliberately kept from the previous
 * brand: it is baked into installed apps, push payloads and shared invite links.
 */
export const APP_SCHEME = 'zynk';
