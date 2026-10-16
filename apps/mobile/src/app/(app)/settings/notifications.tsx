import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { Button, Divider, Screen, Section, Text, ToggleRow } from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { usePreferences } from '../../../lib/hooks';
import { getPushPermission, requestPushPermission, type PushPermission } from '../../../lib/notifications';
import { useUpdatePrefs } from '../../../lib/prefs';

export default function NotificationSettings() {
  const { t } = useI18n();
  const prefs = usePreferences().data?.selected;
  const update = useUpdatePrefs();
  const [perm, setPerm] = useState<PushPermission | null>(null);
  useEffect(() => {
    void getPushPermission().then(setPerm);
  }, []);
  if (!prefs) return <Screen back title={t('notif.title')}><Text tone="muted">{t('common.loading')}</Text></Screen>;
  return (
    <Screen back title={t('notif.title')} subtitle={t('notif.subtitle')}>
      {perm && perm !== 'granted' ? (
        <Section footer={perm === 'denied' ? t('notif.deniedFooter') : t('notif.undeterminedFooter')}>
          <Text style={{ padding: 16 }}>{t('notif.systemOff')}</Text>
          {perm === 'denied' ? (
            <Button title={t('notif.openSettings')} variant="secondary" onPress={() => void Linking.openSettings()} style={{ margin: 16, marginTop: 0 }} />
          ) : (
            <Button title={t('notif.allow')} onPress={async () => setPerm(await requestPushPermission())} style={{ margin: 16, marginTop: 0 }} />
          )}
        </Section>
      ) : null}
      <Section title={t('notif.push')}>
        <ToggleRow title={t('notif.all')} subtitle={t('notif.allSub')} value={prefs.pushEnabled} onChange={(v) => update.mutate({ pushEnabled: v })} />
        <Divider />
        <ToggleRow title={t('notif.speows')} value={prefs.zynkPush} disabled={!prefs.pushEnabled} onChange={(v) => update.mutate({ zynkPush: v })} />
        <Divider />
        <ToggleRow title={t('notif.requests')} value={prefs.friendRequestPush} disabled={!prefs.pushEnabled} onChange={(v) => update.mutate({ friendRequestPush: v })} />
      </Section>
      <Section title={t('notif.inApp')} footer={t('notif.inAppFooter')}>
        <ToggleRow title={t('sounds.enabled')} value={prefs.soundsEnabled} onChange={(v) => update.mutate({ soundsEnabled: v })} />
        <Divider />
        <ToggleRow title={t('notif.haptics')} subtitle={t('notif.hapticsSub')} value={prefs.haptics} onChange={(v) => update.mutate({ haptics: v })} />
      </Section>
    </Screen>
  );
}
