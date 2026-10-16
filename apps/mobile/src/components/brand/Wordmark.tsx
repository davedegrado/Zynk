import { Text, View } from 'react-native';
import { fonts } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Logo } from './Logo';

export function Wordmark({ size = 40, withSymbol = true, color }: { size?: number; withSymbol?: boolean; color?: string }) {
  const t = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.2 }} accessibilityRole="header" accessibilityLabel="ZYNK">
      {withSymbol && <Logo size={size * 1.25} />}
      <Text style={{ fontFamily: fonts.display, fontSize: size, lineHeight: size * 1.15, letterSpacing: -size * 0.05, color: color ?? t.colors.text }}>
        zynk
      </Text>
    </View>
  );
}
