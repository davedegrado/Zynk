import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { Button, Divider, Screen, Section, Text, ToggleRow } from '../../../components/ui';
import { usePreferences } from '../../../lib/hooks';
import { getPushPermission, requestPushPermission, type PushPermission } from '../../../lib/notifications';
import { useUpdatePrefs } from '../../../lib/prefs';

export default function NotificationSettings() {
  const prefs = usePreferences().data?.selected;
  const update = useUpdatePrefs();
  const [perm, setPerm] = useState<PushPermission | null>(null);
  useEffect(() => {
    void getPushPermission().then(setPerm);
  }, []);
  if (!prefs) return <Screen back title="Notifications"><Text tone="muted">Loading…</Text></Screen>;
  return (
    <Screen back title="Notifications" subtitle="Speows always appear in Activity, whatever you choose here.">
      {perm && perm !== 'granted' ? (
        <Section footer={perm === 'denied' ? 'Notifications are turned off for Speow! in system settings.' : 'Speow! has not asked for permission yet.'}>
          <Text style={{ padding: 16 }}>System notifications are off.</Text>
          {perm === 'denied' ? (
            <Button title="Open system settings" variant="secondary" onPress={() => void Linking.openSettings()} style={{ margin: 16, marginTop: 0 }} />
          ) : (
            <Button title="Allow notifications" onPress={async () => setPerm(await requestPushPermission())} style={{ margin: 16, marginTop: 0 }} />
          )}
        </Section>
      ) : null}
      <Section title="Push">
        <ToggleRow title="All notifications" subtitle="Master switch for this account" value={prefs.pushEnabled} onChange={(v) => update.mutate({ pushEnabled: v })} />
        <Divider />
        <ToggleRow title="Speows" value={prefs.zynkPush} disabled={!prefs.pushEnabled} onChange={(v) => update.mutate({ zynkPush: v })} />
        <Divider />
        <ToggleRow title="Friend requests" value={prefs.friendRequestPush} disabled={!prefs.pushEnabled} onChange={(v) => update.mutate({ friendRequestPush: v })} />
      </Section>
      <Section title="In the app" footer="Sounds follow your phone's silent mode and volume. To mute a single friend, open their profile.">
        <ToggleRow title="Speow sounds" value={prefs.soundsEnabled} onChange={(v) => update.mutate({ soundsEnabled: v })} />
        <Divider />
        <ToggleRow title="Haptics" subtitle="Vibration when you send or receive" value={prefs.haptics} onChange={(v) => update.mutate({ haptics: v })} />
      </Section>
    </Screen>
  );
}
