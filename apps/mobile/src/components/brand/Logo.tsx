import Svg, { Path } from 'react-native-svg';
import logo from '../../../assets/brand/logo-paths.json';
import { useAppTheme } from '../../theme/ThemeProvider';

interface Props {
  size?: number;
  /** Burst + "!" color. Defaults to the theme accent (Acid Lime by default). */
  color?: string;
  /** Speech-bubble color; should match what the logo sits on. */
  cutout?: string;
  mono?: boolean;
}

/** The ZYNK symbol: a comic impact burst with a speech bubble. Same geometry as the app icon. */
export function Logo({ size = 64, color, cutout, mono }: Props) {
  const t = useAppTheme();
  const fg = color ?? t.colors.accent;
  const inkOutline = t.scheme === 'light' && !color;
  if (mono) {
    return (
      <Svg width={size} height={size} viewBox={logo.viewBox}>
        <Path d={logo.mono.d} fill={fg} fillRule="evenodd" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox={logo.viewBox} accessibilityLabel="ZYNK logo">
      {logo.layers.map((l) => (
        <Path
          key={l.id}
          d={l.d}
          fill={l.role === 'cutout' ? (cutout ?? (inkOutline ? t.colors.text : t.colors.background)) : fg}
          // Light themes: an ink outline keeps the lime symbol legible on pale backgrounds.
          stroke={inkOutline && l.id === 'burst' ? t.colors.text : undefined}
          strokeWidth={inkOutline && l.id === 'burst' ? 14 : 0}
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
