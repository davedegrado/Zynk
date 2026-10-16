import Svg, { Path } from 'react-native-svg';
import logo from '../../../assets/brand/logo-paths.json';
import { useAppTheme } from '../../theme/ThemeProvider';

interface Props {
  size?: number;
  /** Bubble + burst color. Defaults to the theme accent (Acid Lime by default). */
  color?: string;
  /** Color of the "!" punched out of the bubble; should match what the logo sits on. */
  cutout?: string;
  mono?: boolean;
}

/** The Speow! symbol: a speech bubble with a small impact burst. Same geometry as the app icon. */
export function Logo({ size = 64, color, cutout, mono }: Props) {
  const t = useAppTheme();
  const fg = color ?? t.colors.accent;
  // Light themes: an ink outline + ink "!" keep the lime symbol legible on pale backgrounds.
  const inkOutline = t.scheme === 'light' && !color;
  if (mono) {
    return (
      <Svg width={size} height={size} viewBox={logo.viewBox} accessibilityLabel="Speow! logo">
        <Path d={logo.mono.d} fill={fg} fillRule="evenodd" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox={logo.viewBox} accessibilityLabel="Speow! logo">
      {logo.layers.map((l) => (
        <Path
          key={l.id}
          d={l.d}
          fill={l.role === 'cutout' ? (cutout ?? (inkOutline ? t.colors.text : t.colors.background)) : fg}
          stroke={inkOutline && l.role === 'fg' ? t.colors.text : undefined}
          strokeWidth={inkOutline && l.role === 'fg' ? 16 : 0}
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
