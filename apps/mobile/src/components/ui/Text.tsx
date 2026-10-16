import { Text as RNText, type TextProps } from 'react-native';
import { type as typeScale, type TypeVariant } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  tone?: 'default' | 'muted' | 'accent' | 'danger' | 'onAccent';
  center?: boolean;
}

export function Text({ variant = 'body', tone = 'default', center, style, ...rest }: AppTextProps) {
  const t = useAppTheme();
  const color = {
    default: t.colors.text,
    muted: t.colors.textMuted,
    accent: t.colors.accentText,
    danger: t.colors.danger,
    onAccent: t.colors.onAccent,
  }[tone];
  return <RNText maxFontSizeMultiplier={1.6} {...rest} style={[typeScale[variant], { color }, center && { textAlign: 'center' }, style]} />;
}
