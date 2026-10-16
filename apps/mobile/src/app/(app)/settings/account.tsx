import { useMutation } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, Button, Input, Screen, Section, Text, useConfirm, useToast } from '../../../components/ui';
import { api, ApiError, errorMessage } from '../../../lib/api';
import { useEntitlements } from '../../../lib/hooks';
import { useSession } from '../../../lib/session';
import { space } from '../../../theme/tokens';

async function pickAvatar(): Promise<Blob | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (res.canceled || !res.assets[0]) return null;
  // Downscale + re-encode on device: strips EXIF/location metadata and keeps uploads small.
  const ref = await ImageManipulator.manipulate(res.assets[0].uri).resize({ width: 512 }).renderAsync();
  const out = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return (await fetch(out.uri)).blob();
}

export default function AccountSettings() {
  const { user, setUser, signOut } = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const sub = useEntitlements().data?.subscription;
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [pw, setPw] = useState({ current: '', next: '' });
  const [deletePw, setDeletePw] = useState('');

  const save = useMutation({
    mutationFn: () =>
      api.updateMe({
        displayName: displayName.trim() !== user?.displayName ? displayName.trim() : undefined,
        username: username.trim() !== user?.username ? username.trim().toLowerCase() : undefined,
      }),
    onSuccess: (me) => {
      setUser(me);
      setFieldErr({});
      toast('Profile saved', 'success');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) setFieldErr(e.fields);
      toast(errorMessage(e), 'error');
    },
  });
  const avatar = useMutation({
    mutationFn: async (remove: boolean) => {
      if (remove) return api.removeAvatar();
      const blob = await pickAvatar();
      return blob ? api.uploadAvatar(blob, 'image/jpeg') : null;
    },
    onSuccess: (me) => me && setUser(me),
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const changePw = useMutation({
    mutationFn: () => api.changePassword({ currentPassword: pw.current, newPassword: pw.next }),
    onSuccess: () => {
      setPw({ current: '', next: '' });
      toast('Password changed. Other devices were signed out.', 'success');
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const del = useMutation({
    mutationFn: () => api.deleteAccount(deletePw),
    onSuccess: () => void signOut({ remote: false }),
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  if (!user) return null;
  const dirty = displayName.trim() !== user.displayName || username.trim() !== user.username;
  const activeSub = sub && ['active', 'in_grace', 'billing_issue'].includes(sub.status) && sub.willRenew;

  return (
    <Screen back title="Account">
      <View style={{ alignItems: 'center', gap: space.md }}>
        <Avatar user={user} size={104} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button title={user.avatarUrl ? 'Change photo' : 'Add photo'} icon="camera" size="sm" variant="secondary" loading={avatar.isPending} onPress={() => avatar.mutate(false)} />
          {user.avatarUrl ? <Button title="Remove" size="sm" variant="ghost" onPress={() => avatar.mutate(true)} /> : null}
        </View>
      </View>

      <Input label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={40} error={fieldErr.displayName} />
      <Input label="Username" value={username} onChangeText={(v) => setUsername(v.toLowerCase())} autoCapitalize="none" autoCorrect={false} maxLength={20} error={fieldErr.username} hint="Friends find you by this." />
      <Button title="Save profile" onPress={() => save.mutate()} disabled={!dirty} loading={save.isPending} />

      <Section title="Password">
        <View style={{ padding: space.lg, gap: space.md }}>
          <Input label="Current password" secureTextEntry value={pw.current} onChangeText={(v) => setPw((p) => ({ ...p, current: v }))} autoComplete="current-password" />
          <Input label="New password" secureTextEntry value={pw.next} onChangeText={(v) => setPw((p) => ({ ...p, next: v }))} autoComplete="new-password" hint="At least 8 characters." />
          <Button title="Change password" variant="secondary" size="sm" disabled={!pw.current || pw.next.length < 8} loading={changePw.isPending} onPress={() => changePw.mutate()} />
        </View>
      </Section>

      <Section title="Delete account" footer="Deletes your profile, friends, Speows, preferences and devices permanently. This cannot be undone.">
        <View style={{ padding: space.lg, gap: space.md }}>
          {activeSub ? (
            <Text tone="danger">
              You have an active Speow Plus subscription. Deleting your account does not cancel it — cancel it in the {sub?.store === 'play_store' ? 'Google Play' : 'App Store'} subscription settings first.
            </Text>
          ) : null}
          <Input label="Confirm with your password" secureTextEntry value={deletePw} onChangeText={setDeletePw} />
          <Button
            title="Delete my account"
            variant="danger"
            size="sm"
            disabled={!deletePw}
            loading={del.isPending}
            onPress={async () => {
              if (await confirm({ title: 'Delete your account?', body: 'Everything is removed for good. Your friends will no longer see you.', confirm: 'Delete forever', destructive: true })) del.mutate();
            }}
          />
        </View>
      </Section>
    </Screen>
  );
}
