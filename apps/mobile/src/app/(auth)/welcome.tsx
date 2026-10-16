import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BRAND } from '@zynk/shared';
import { Logo } from '../../components/brand/Logo';
import { Button, Text } from '../../components/ui';
import { fonts, space } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';

export default function Welcome() {
  const t = useAppTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]}>
      <View style={styles.hero}>
        <Logo size={176} />
        <Text style={{ fontFamily: fonts.display, fontSize: 72, lineHeight: 80, letterSpacing: -4, color: t.colors.text }}>zynk</Text>
        <Text variant="label" tone="accent" style={{ fontSize: 15, letterSpacing: 3 }}>{BRAND.tagline}</Text>
        <Text tone="muted" center style={{ maxWidth: 300, marginTop: space.md }}>
          One tap to say “you there?”, “thinking of you” — or just to bug your best friend. No chat. No feed. No pressure.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button title="Create account" onPress={() => router.push('/register')} fullWidth />
        <Button title="I already have one" variant="ghost" onPress={() => router.push('/login')} fullWidth />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: space.xl, justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  actions: { gap: space.md, paddingBottom: space.md },
});
