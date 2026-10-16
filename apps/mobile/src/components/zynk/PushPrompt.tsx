import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { useI18n } from '../../i18n';
import { getPushPermission, requestPushPermission, type PushPermission } from '../../lib/notifications';
import { space } from '../../theme/tokens';
import { Button, Card, Text } from '../ui';

/** Contextual, dismissible pre-permission card. We never prompt on launch. */
export function PushPrompt() {
  const { t } = useI18n();
  const [perm, setPerm] = useState<PushPermission | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    getPushPermission().then(setPerm).catch(() => setPerm(null));
  }, []);
  if (Platform.OS === 'web' || dismissed || !perm || perm === 'granted') return null;
  return (
    <Card style={{ gap: space.sm }}>
      <Text variant="heading">{t('pushPrompt.title')}</Text>
      <Text tone="muted">
        {perm === 'denied'
          ? t('pushPrompt.denied')
          : t('pushPrompt.body')}
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
        {perm === 'denied' ? (
          <Button title={t('pushPrompt.openSettings')} size="sm" onPress={() => void Linking.openSettings()} />
        ) : (
          <Button title={t('pushPrompt.turnOn')} size="sm" icon="bolt" onPress={async () => setPerm(await requestPushPermission())} />
        )}
        <Button title={t('pushPrompt.notNow')} size="sm" variant="ghost" onPress={() => setDismissed(true)} />
      </View>
    </Card>
  );
}
