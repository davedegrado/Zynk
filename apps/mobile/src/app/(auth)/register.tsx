import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AVATAR_COLORS, AVATARS, usernameSchema, type Avatar } from '@zynk/shared';
import { AvatarPicker } from '../../components/AvatarPicker';
import { AvatarArt, Button, Input, Screen, Text } from '../../components/ui';
import { useI18n } from '../../i18n';
import { api, ApiError, errorMessage, fieldMessage } from '../../lib/api';
import { useSession } from '../../lib/session';
import { space } from '../../theme/tokens';

const randomAvatar = (): Avatar => ({
  id: AVATARS[Math.floor(Math.random() * AVATARS.length)]!,
  color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!.id,
});

export default function Register() {
  const { signIn } = useSession();
  const { t, lang } = useI18n();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState<Avatar>(randomAvatar);
  const [picking, setPicking] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const usernameValid = username ? usernameSchema.safeParse(username).success : null;
  const usernameError = usernameValid === false ? t('register.usernameInvalid') : fields.username;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await signIn(
        await api.register({
          username: username.trim().toLowerCase(),
          displayName: displayName.trim() || username.trim(),
          password,
          avatar,
          language: lang,
        }),
      );
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        const f: Record<string, string> = {};
        for (const k of Object.keys(err.fields)) f[k] = fieldMessage(err, k);
        setFields(f);
      }
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back title={t('register.title')} subtitle={t('register.subtitle')}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('register.avatar')} onPress={() => setPicking((v) => !v)}>
          <AvatarArt avatarId={avatar.id} colorId={avatar.color} size={104} />
        </Pressable>
        <Text variant="caption" tone="muted">{t('register.avatarHint')}</Text>
      </View>
      {picking ? <AvatarPicker value={avatar} onChange={setAvatar} /> : null}
      <Input
        label={t('common.username')}
        icon="profile"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        placeholder={t('register.usernamePlaceholder')}
        value={username}
        onChangeText={(v) => setUsername(v.toLowerCase())}
        error={usernameError}
        hint={t('register.usernameHint')}
        maxLength={20}
      />
      <Input label={t('common.displayName')} placeholder={t('register.displayNamePlaceholder')} value={displayName} onChangeText={setDisplayName} maxLength={40} error={fields.displayName} autoComplete="name" />
      <Input
        label={t('common.password')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        value={password}
        onChangeText={setPassword}
        error={fields.password}
        hint={t('register.passwordHint')}
      />
      {error && !Object.keys(fields).length ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
      <Button title={t('register.submit')} onPress={submit} loading={busy} disabled={!usernameValid || password.length < 8} fullWidth />
      <Text variant="caption" tone="muted" center>
        {t('register.footer')}
      </Text>
    </Screen>
  );
}
