import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Input, Screen, Text } from '../../components/ui';
import { getApiUrl, normalizeServerUrl, saveServerOverride } from '../../lib/config';

/** Test builds only: point the app at a Speow! server, e.g. your computer on the same Wi-Fi. */
export default function ServerScreen() {
  const [value, setValue] = useState(getApiUrl());
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const test = async (): Promise<string | null> => {
    const url = normalizeServerUrl(value);
    if (!url) {
      setStatus({ ok: false, message: 'That doesn’t look like an address. Example: 192.168.1.20' });
      return null;
    }
    setBusy(true);
    setStatus(null);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`${url}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !body?.ok) throw new Error(`HTTP ${res.status}`);
      setStatus({ ok: true, message: `Connected to ${url}` });
      return url;
    } catch {
      setStatus({
        ok: false,
        message: `Can’t reach ${url}. Check that the server is running, that your phone is on the same Wi-Fi, and that the computer’s firewall allows port 4000.`,
      });
      return null;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back title="Server" subtitle="Test builds only. Enter the address of the computer running the Speow! server.">
      <Input
        label="Server address"
        placeholder="192.168.1.20"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={value}
        onChangeText={setValue}
        hint="Port 4000 is added automatically for plain IP addresses."
      />
      {status ? <Text tone={status.ok ? 'accent' : 'danger'} accessibilityRole="alert">{status.message}</Text> : null}
      <Button title="Test connection" variant="secondary" loading={busy} onPress={() => void test()} />
      <Button
        title="Save"
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
