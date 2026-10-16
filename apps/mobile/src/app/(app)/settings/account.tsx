import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import type { Avatar } from '@zynk/shared';
import { AvatarPicker } from '../../../components/AvatarPicker';
import { AvatarArt, Button, Input, Screen, Section, Text, useConfirm, useToast } from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { api, ApiError, errorMessage, fieldMessage } from '../../../lib/api';
import { useEntitlements } from '../../../lib/hooks';
import { useSession } from '../../../lib/session';
import { space } from '../../../theme/tokens';

export default function AccountSettings() {
  const { user, setUser, signOut } = useSession();
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const sub = useEntitlements().data?.subscription;
  const [avatar, setAvatar] = useState<Avatar>(user?.avatar ?? { id: 'cat', color: 'lime' });
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [pw, setPw] = useState({ current: '', next: '' });
  const [deletePw, setDeletePw] = useState('');

  const avatarDirty = !!user && (avatar.id !== user.avatar.id || avatar.color !== user.avatar.color);
  const dirty = !!user && (avatarDirty || displayName.trim() !== user.displayName || username.trim() !== user.username);

  const save = useMutation({
    mutationFn: () =>
      api.updateMe({
        displayName: displayName.trim() !== user?.displayName ? displayName.trim() : undefined,
        username: username.trim() !== user?.username ? username.trim().toLowerCase() : undefined,
        avatar: avatarDirty ? avatar : undefined,
      }),
    onSuccess: (me) => {
      setUser(me);
      setFieldErr({});
      toast(t('account.saved'), 'success');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) {
        const f: Record<string, string> = {};
        for (const k of Object.keys(e.fields)) f[k] = fieldMessage(e, k);
        setFieldErr(f);
      }
      toast(errorMessage(e), 'error');
    },
  });
  const changePw = useMutation({
    mutationFn: () => api.changePassword({ currentPassword: pw.current, newPassword: pw.next }),
    onSuccess: () => {
      setPw({ current: '', next: '' });
      toast(t('account.passwordChanged'), 'success');
    },
    onError: (e) => toast(e instanceof ApiError && e.code === 'invalid_credentials' ? t('error.wrongPassword') : errorMessage(e), 'error'),
  });
  const del = useMutation({
    mutationFn: () => api.deleteAccount(deletePw),
    onSuccess: () => void signOut({ remote: false }),
    onError: (e) => toast(e instanceof ApiError && e.code === 'invalid_credentials' ? t('error.wrongPassword') : errorMessage(e), 'error'),
  });

  if (!user) return null;
  const activeSub = sub && ['active', 'in_grace', 'billing_issue'].includes(sub.status) && sub.willRenew;

  return (
    <Screen back title={t('profile.account')}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <AvatarArt avatarId={avatar.id} colorId={avatar.color} size={112} />
        <Text variant="label" tone="muted">{t('account.avatar')}</Text>
      </View>
      <AvatarPicker value={avatar} onChange={setAvatar} />

      <Input label={t('common.displayName')} value={displayName} onChangeText={setDisplayName} maxLength={40} error={fieldErr.displayName} />
      <Input label={t('common.username')} value={username} onChangeText={(v) => setUsername(v.toLowerCase())} autoCapitalize="none" autoCorrect={false} maxLength={20} error={fieldErr.username} hint={t('account.usernameHint')} />
      <Button title={t('account.save')} onPress={() => save.mutate()} disabled={!dirty} loading={save.isPending} />

      <Section title={t('common.password')}>
        <View style={{ padding: space.lg, gap: space.md }}>
          <Input label={t('account.currentPassword')} secureTextEntry value={pw.current} onChangeText={(v) => setPw((p) => ({ ...p, current: v }))} autoComplete="current-password" />
          <Input label={t('account.newPassword')} secureTextEntry value={pw.next} onChangeText={(v) => setPw((p) => ({ ...p, next: v }))} autoComplete="new-password" hint={t('register.passwordHint')} />
          <Button title={t('account.changePassword')} variant="secondary" size="sm" disabled={!pw.current || pw.next.length < 8} loading={changePw.isPending} onPress={() => changePw.mutate()} />
        </View>
      </Section>

      <Section title={t('account.delete')} footer={t('account.deleteFooter')}>
        <View style={{ padding: space.lg, gap: space.md }}>
          {activeSub ? <Text tone="danger">{t(sub?.store === 'play_store' ? 'account.activeSubPlay' : 'account.activeSubApple')}</Text> : null}
          <Input label={t('account.confirmPassword')} secureTextEntry value={deletePw} onChangeText={setDeletePw} />
          <Button
            title={t('account.deleteButton')}
            variant="danger"
            size="sm"
            disabled={!deletePw}
            loading={del.isPending}
            onPress={async () => {
              if (await confirm({ title: t('account.deleteTitle'), body: t('account.deleteBody'), confirm: t('account.deleteConfirm'), cancel: t('common.cancel'), destructive: true })) del.mutate();
            }}
          />
        </View>
      </Section>
    </Screen>
  );
}
