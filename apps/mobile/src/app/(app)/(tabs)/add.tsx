import { useMutation, useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import type { UserProfile } from '@zynk/shared';
import { RelationshipAction, refreshSocial as refresh } from '../../../components/RelationshipAction';
import { Avatar, Button, Card, IconButton, Input, Loading, Screen, Text, useConfirm, useToast } from '../../../components/ui';
import { translate, useI18n } from '../../../i18n';
import { api, errorMessage } from '../../../lib/api';
import { getInviteBaseUrl } from '../../../lib/config';
import { useFriendRequests, useInvite } from '../../../lib/hooks';
import { keys, queryClient } from '../../../lib/query';
import { radius, space } from '../../../theme/tokens';
import { useAppTheme } from '../../../theme/ThemeProvider';

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function UserRow({ user, right }: { user: Pick<UserProfile, 'id' | 'displayName' | 'username' | 'avatar'>; right: React.ReactNode }) {
  const t = useAppTheme();
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/user/${user.id}`)} style={[styles.row, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
      <Avatar user={user} size={44} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>{user.displayName}</Text>
        <Text variant="caption" tone="muted">@{user.username}</Text>
      </View>
      {right}
    </Pressable>
  );
}

function InviteCard() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const invite = useInvite();
  const url = invite.data ? `${getInviteBaseUrl()}/i/${invite.data.code}` : null;
  const rotate = useMutation({
    mutationFn: api.rotateInvite,
    onSuccess: (d) => {
      queryClient.setQueryData(keys.invite, d);
      toast(translate('invite.rotated'), 'success');
    },
  });
  return (
    <Card style={{ gap: space.md }}>
      <Text variant="heading">{t('invite.title')}</Text>
      <Text tone="muted">{t('invite.body')}</Text>
      {url ? (
        <Text variant="caption" selectable numberOfLines={1}>{url}</Text>
      ) : (
        <Loading size={28} />
      )}
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Button title={t('invite.share')} icon="share" size="sm" disabled={!url} onPress={() => url && void Share.share({ message: t('invite.shareMessage', { url }), url })} />
        <Button
          title={t('invite.copy')}
          icon="link"
          size="sm"
          variant="secondary"
          disabled={!url}
          onPress={async () => {
            if (!url) return;
            await Clipboard.setStringAsync(url);
            toast(t('invite.copied'), 'success');
          }}
        />
        <Button
          title={t('invite.reset')}
          size="sm"
          variant="ghost"
          onPress={async () => {
            if (await confirm({ title: t('invite.resetTitle'), body: t('invite.resetBody'), confirm: t('invite.reset') })) rotate.mutate();
          }}
        />
      </View>
    </Card>
  );
}

export default function AddScreen() {
  const { t: tt } = useI18n();
  const t = useAppTheme();
  const toast = useToast();
  const [term, setTerm] = useState('');
  const q = useDebounced(term.trim().toLowerCase().replace(/^@/, ''), 300);
  const search = useQuery({ queryKey: keys.search(q), queryFn: () => api.search(q), enabled: q.length >= 2 });
  const requests = useFriendRequests();

  const respond = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => (accept ? api.acceptRequest(id) : api.rejectRequest(id)),
    onSuccess: (_d, v) => {
      toast(tt(v.accept ? 'requests.added' : 'requests.declined'), v.accept ? 'success' : 'info');
      refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const cancel = useMutation({ mutationFn: api.cancelRequest, onSuccess: refresh, onError: (e) => toast(errorMessage(e), 'error') });

  const incoming = requests.data?.incoming ?? [];
  const outgoing = requests.data?.outgoing ?? [];

  return (
    <Screen edges={['top']} title={tt('add.title')}>
      <Input icon="search" placeholder={tt('add.search')} autoCapitalize="none" autoCorrect={false} value={term} onChangeText={setTerm} returnKeyType="search" />
      {q.length >= 2 ? (
        <View style={{ gap: space.sm }}>
          {search.isLoading ? (
            <Loading size={32} />
          ) : search.data?.users.length ? (
            search.data.users.map((u) => <UserRow key={u.id} user={u} right={<RelationshipAction profile={u} />} />)
          ) : (
            <Text tone="muted">{tt('add.noResults', { q })}</Text>
          )}
        </View>
      ) : null}

      {incoming.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">{tt('add.incoming')}</Text>
          {incoming.map((r) => (
            <UserRow
              key={r.id}
              user={r.user}
              right={
                <View style={{ flexDirection: 'row', gap: space.xs }}>
                  <IconButton name="close" label={tt('requests.decline', { name: r.user.displayName })} color={t.colors.textMuted} onPress={() => respond.mutate({ id: r.id, accept: false })} />
                  <Button title={tt('requests.accept')} size="sm" onPress={() => respond.mutate({ id: r.id, accept: true })} />
                </View>
              }
            />
          ))}
        </View>
      ) : null}

      <InviteCard />

      {outgoing.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">{tt('add.outgoing')}</Text>
          {outgoing.map((r) => (
            <UserRow key={r.id} user={r.user} right={<Button title={tt('common.cancel')} size="sm" variant="ghost" onPress={() => cancel.mutate(r.id)} />} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
});
