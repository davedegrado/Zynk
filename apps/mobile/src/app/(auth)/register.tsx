import { useState } from 'react';
import { usernameSchema } from '@zynk/shared';
import { Button, Input, Screen, Text } from '../../components/ui';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useSession } from '../../lib/session';

export default function Register() {
  const { signIn } = useSession();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const usernameCheck = username ? usernameSchema.safeParse(username) : null;
  const usernameError = usernameCheck && !usernameCheck.success ? usernameCheck.error.issues[0]?.message : fields.username;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await signIn(await api.register({ username: username.trim().toLowerCase(), displayName: displayName.trim() || username.trim(), password }));
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFields(err.fields);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back title="Join Speow!" subtitle="Pick a username your friends can find you by.">
      <Input
        label="Username"
        icon="profile"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        placeholder="e.g. sam.rivers"
        value={username}
        onChangeText={(v) => setUsername(v.toLowerCase())}
        error={usernameError}
        hint="3–20 characters: letters, numbers, dots, underscores."
        maxLength={20}
      />
      <Input label="Display name" placeholder="What friends see" value={displayName} onChangeText={setDisplayName} maxLength={40} error={fields.displayName} autoComplete="name" />
      <Input
        label="Password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        value={password}
        onChangeText={setPassword}
        error={fields.password}
        hint="At least 8 characters."
      />
      {error && !Object.keys(fields).length ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
      <Button title="Create account" onPress={submit} loading={busy} disabled={!usernameCheck?.success || password.length < 8} fullWidth />
      <Text variant="caption" tone="muted" center>
        No contacts access, no public follower counts, no ads. Just Speows.
      </Text>
    </Screen>
  );
}
