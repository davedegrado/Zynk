import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';
import { IconButton } from './Button';
import { Text } from './Text';

interface ScreenProps {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  scroll?: boolean;
  children: ReactNode;
  refreshControl?: ScrollViewProps['refreshControl'];
  /** Tab screens draw under the tab bar, so they skip the bottom safe area. */
  edges?: ('top' | 'bottom')[];
}

export function Screen({ title, subtitle, back, right, scroll = true, children, refreshControl, edges = ['top', 'bottom'] }: ScreenProps) {
  const t = useAppTheme();
  const header = (title || back || right) && (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {back ? <IconButton name="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : null}
        <View style={{ flex: 1 }} />
        {right}
      </View>
      {title ? (
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text tone="muted" style={{ marginTop: space.xs }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: t.colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
            showsVerticalScrollIndicator={false}
          >
            {header}
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.contentNoScroll]}>
            {header}
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingBottom: 120, gap: space.lg },
  contentNoScroll: { paddingHorizontal: space.lg, gap: space.lg },
  header: { paddingTop: space.sm, gap: space.xs, marginBottom: space.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, marginLeft: -space.sm },
});
