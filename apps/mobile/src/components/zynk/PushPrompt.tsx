import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { getPushPermission, requestPushPermission, type PushPermission } from '../../lib/notifications';
import { space } from '../../theme/tokens';
import { Button, Card, Text } from '../ui';

/** Contextual, dismissible pre-permission card. We never prompt on launch. */
export function PushPrompt() {
  const [perm, setPerm] = useState<PushPermission | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    getPushPermission().then(setPerm).catch(() => setPerm(null));
  }, []);
  if (Platform.OS === 'web' || dismissed || !perm || perm === 'granted') return null;
  return (
    <Card style={{ gap: space.sm }}>
      <Text variant="heading">Don&apos;t miss a Zynk</Text>
      <Text tone="muted">
        {perm === 'denied'
          ? 'Notifications are off for ZYNK in system settings. Zynks still land in Activity while the app is open.'
          : 'Turn on notifications to feel it when a friend zynks you. You choose sounds, mutes and more later.'}
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
        {perm === 'denied' ? (
          <Button title="Open settings" size="sm" onPress={() => void Linking.openSettings()} />
        ) : (
          <Button title="Turn on" size="sm" icon="bolt" onPress={async () => setPerm(await requestPushPermission())} />
        )}
        <Button title="Not now" size="sm" variant="ghost" onPress={() => setDismissed(true)} />
      </View>
    </Card>
  );
}
