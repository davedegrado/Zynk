import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { fonts, radius, space } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: IconName;
}

export const Input = forwardRef<TextInputInstance, InputProps>(function Input({ label, error, hint, icon, style, onFocus, onBlur, ...rest }, ref) {
  const t = useAppTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? t.colors.danger : focused ? t.colors.accent : t.colors.border;
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text variant="label" tone="muted">{label}</Text> : null}
      <View style={[styles.box, { backgroundColor: t.colors.surface, borderColor }]}>
        {icon ? <Icon name={icon} size={20} color={t.colors.textMuted} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={t.colors.textMuted}
          selectionColor={t.colors.accent}
          maxFontSizeMultiplier={1.6}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          accessibilityLabel={label ?? rest.placeholder}
          style={[styles.input, { color: t.colors.text }, style]}
          {...rest}
        />
      </View>
      {error ? <Text variant="caption" tone="danger">{error}</Text> : hint ? <Text variant="caption" tone="muted">{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 2, borderRadius: radius.md, paddingHorizontal: space.lg, minHeight: 54 },
  input: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, paddingVertical: space.md },
});
