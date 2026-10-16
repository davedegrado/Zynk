import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Input, Screen, Text } from '../../components/ui';
import { useI18n } from '../../i18n';
import { getApiUrl, normalizeServerUrl, saveServerOverride } from '../../lib/config';

/** Test builds only: point the app at a Speow! server, e.g. your computer on the same Wi-Fi. */
export default function ServerScreen() {
  const { t } = useI18n();
  const [value, setValue] = useState(getApiUrl());
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const test = async (): Promise<string | null> => {
    const url = normalizeServerUrl(value);
    if (!url) {
      setStatus({ ok: false, message: t('server.invalid') });
      return null;
    }
    setBusy(true);
    setStatus({ ok: true, message: t('server.connecting') });
    try {
      const ctrl = new AbortController();
      // Free hosting sleeps when idle; waking up can take about a minute.
      const timer = setTimeout(() => ctrl.abort(), 90_000);
      const res = await fetch(`${url}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !body?.ok) throw new Error(`HTTP ${res.status}`);
      setStatus({ ok: true, message: t('server.ok', { url }) });
      return url;
    } catch {
      setStatus({ ok: false, message: t('server.fail', { url }) });
      return null;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back title={t('server.title')} subtitle={t('server.subtitle')}>
      <Input
        label={t('server.label')}
        placeholder="speow-api.onrender.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={value}
        onChangeText={setValue}
        hint={t('server.hint')}
      />
      {status ? <Text tone={status.ok ? 'accent' : 'danger'} accessibilityRole="alert">{status.message}</Text> : null}
      <Button title={t('server.test')} variant="secondary" loading={busy} onPress={() => void test()} />
      <Button
        title={t('common.save')}
        disabled={busy}
        onPress={async () => {
          const url = await test();
          if (url) {
            await saveServerOverride(url);
            router.back();
          }
        }}
      />
    </Screen>
  );
}
