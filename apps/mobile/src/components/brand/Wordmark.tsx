import { Text, View } from 'react-native';
import { BRAND } from '@zynk/shared';
import { fonts } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Logo } from './Logo';

/** Symbol + "Speow!" wordmark set in the heavy display face. */
export function Wordmark({ size = 40, withSymbol = true, color }: { size?: number; withSymbol?: boolean; color?: string }) {
  const t = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.18 }} accessibilityRole="header" accessibilityLabel={BRAND.name}>
      {withSymbol && <Logo size={size * 1.3} />}
      <Text
        allowFontScaling={false}
        style={{ fontFamily: fonts.display, fontSize: size, lineHeight: size * 1.2, letterSpacing: -size * 0.04, color: color ?? t.colors.text }}
      >
        {BRAND.wordmark}
      </Text>
    </View>
  );
}
