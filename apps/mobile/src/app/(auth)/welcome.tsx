import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../../components/brand/Logo';
import { Wordmark } from '../../components/brand/Wordmark';
import { Button, Chip, Text } from '../../components/ui';
import { useI18n } from '../../i18n';
import { ALLOW_SERVER_OVERRIDE, getApiUrl } from '../../lib/config';
import { space } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';

export default function Welcome() {
  const theme = useAppTheme();
  const { t, lang, setChoice } = useI18n();
  // Re-read when returning from the Server screen.
  const [server, setServer] = useState(getApiUrl());
  useFocusEffect(useCallback(() => setServer(getApiUrl()), []));
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={styles.lang} accessibilityLabel={t('welcome.language')}>
        <Chip label="EN" selected={lang === 'en'} onPress={() => void setChoice('en')} />
        <Chip label="IT" selected={lang === 'it'} onPress={() => void setChoice('it')} />
      </View>
      <View style={styles.hero}>
        <Logo size={168} />
        <Wordmark size={60} withSymbol={false} />
        <Text variant="label" tone="accent" style={{ fontSize: 15, letterSpacing: 3 }}>{t('welcome.tagline')}</Text>
        <Text tone="muted" center style={{ maxWidth: 300, marginTop: space.md }}>
          {t('welcome.pitch')}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button title={t('welcome.create')} onPress={() => router.push('/register')} fullWidth />
        <Button title={t('welcome.haveOne')} variant="ghost" onPress={() => router.push('/login')} fullWidth />
        {ALLOW_SERVER_OVERRIDE ? (
          <Button
            title={server ? t('welcome.server', { host: server.replace(/^https?:\/\//, '') }) : t('welcome.setServer')}
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
  lang: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  actions: { gap: space.md, paddingBottom: space.md },
});
