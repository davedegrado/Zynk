import { useState } from 'react';
import { Button, Input, Screen, Text } from '../../components/ui';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useSession } from '../../lib/session';

export default function Login() {
  const { signIn } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(await api.login({ username: username.trim(), password }));
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'validation_failed' ? 'Enter your username and password' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back title="Welcome back" subtitle="Log in with your ZYNK username.">
      <Input label="Username" icon="profile" autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" value={username} onChangeText={setUsername} returnKeyType="next" />
      <Input label="Password" secureTextEntry autoComplete="current-password" textContentType="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} returnKeyType="go" />
      {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
      <Button title="Log in" onPress={submit} loading={busy} disabled={!username || !password} fullWidth />
    </Screen>
  );
}
