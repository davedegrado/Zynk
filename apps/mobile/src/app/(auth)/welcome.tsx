import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BRAND } from '@zynk/shared';
import { Logo } from '../../components/brand/Logo';
import { Wordmark } from '../../components/brand/Wordmark';
import { Button, Text } from '../../components/ui';
import { ALLOW_SERVER_OVERRIDE, getApiUrl } from '../../lib/config';
import { space } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';

export default function Welcome() {
  const t = useAppTheme();
  // Re-read when returning from the Server screen.
  const [server, setServer] = useState(getApiUrl());
  useFocusEffect(useCallback(() => setServer(getApiUrl()), []));
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]}>
      <View style={styles.hero}>
        <Logo size={168} />
        <Wordmark size={60} withSymbol={false} />
        <Text variant="label" tone="accent" style={{ fontSize: 15, letterSpacing: 3 }}>{BRAND.tagline}</Text>
        <Text tone="muted" center style={{ maxWidth: 300, marginTop: space.md }}>
          Send a Speow to say “you there?”, “thinking of you” — or just to bug your best friend. No chat. No feed. No pressure.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button title="Create account" onPress={() => router.push('/register')} fullWidth />
        <Button title="I already have one" variant="ghost" onPress={() => router.push('/login')} fullWidth />
        {ALLOW_SERVER_OVERRIDE ? (
          <Button
            title={server ? `Server: ${server.replace(/^https?:\/\//, '')}` : 'Set server address'}
            variant="ghost"
            size="sm"
            icon="link"
            onPress={() => router.push('/server')}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: space.xl, justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  actions: { gap: space.md, paddingBottom: space.md },
});
