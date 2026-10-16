import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { radius, space } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export function Section({ title, children, footer }: { title?: string; children: ReactNode; footer?: string }) {
  const t = useAppTheme();
  return (
    <View style={{ gap: space.sm }}>
      {title ? <Text variant="label" tone="muted" style={{ marginLeft: space.xs }}>{title}</Text> : null}
      <View style={[styles.group, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>{children}</View>
      {footer ? <Text variant="caption" tone="muted" style={{ marginHorizontal: space.xs }}>{footer}</Text> : null}
    </View>
  );
}

interface RowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
  disabled?: boolean;
}

export function Row({ title, subtitle, icon, right, onPress, destructive, chevron, disabled }: RowProps) {
  const t = useAppTheme();
  const content = (
    <>
      {icon ? <Icon name={icon} size={22} color={destructive ? t.colors.danger : t.colors.text} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" tone={destructive ? 'danger' : 'default'}>{title}</Text>
        {subtitle ? <Text variant="caption" tone="muted">{subtitle}</Text> : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron" size={20} color={t.colors.textMuted} /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.row, disabled && { opacity: 0.5 }]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.colors.surfaceAlt }, disabled && { opacity: 0.5 }]}
    >
      {content}
    </Pressable>
  );
}

export function ToggleRow({ title, subtitle, value, onChange, disabled }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const t = useAppTheme();
  return (
    <Row
      title={title}
      subtitle={subtitle}
      disabled={disabled}
      right={
        <Switch
          accessibilityLabel={title}
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{ true: t.colors.accent, false: t.colors.surfaceAlt }}
          thumbColor={t.scheme === 'dark' ? t.colors.text : '#FFFFFF'}
          ios_backgroundColor={t.colors.surfaceAlt}
        />
      }
    />
  );
}

export function Divider() {
  const t = useAppTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border, marginLeft: space.lg }} />;
}

const styles = StyleSheet.create({
  group: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56 },
});
