import { useMutation, useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import type { UserProfile } from '@zynk/shared';
import { RelationshipAction, refreshSocial as refresh } from '../../../components/RelationshipAction';
import { Avatar, Button, Card, IconButton, Input, Loading, Screen, Text, useConfirm, useToast } from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { INVITE_BASE_URL } from '../../../lib/config';
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

function UserRow({ user, right }: { user: Pick<UserProfile, 'id' | 'displayName' | 'username' | 'avatarUrl'>; right: React.ReactNode }) {
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
  const toast = useToast();
  const confirm = useConfirm();
  const invite = useInvite();
  const url = invite.data ? `${INVITE_BASE_URL}/i/${invite.data.code}` : null;
  const rotate = useMutation({
    mutationFn: api.rotateInvite,
    onSuccess: (d) => {
      queryClient.setQueryData(keys.invite, d);
      toast('New invite link created. The old one no longer works.', 'success');
    },
  });
  return (
    <Card style={{ gap: space.md }}>
      <Text variant="heading">Invite friends</Text>
      <Text tone="muted">Share your personal link. Anyone who opens it can send you a friend request — no contacts needed.</Text>
      {url ? (
        <Text variant="caption" selectable numberOfLines={1}>{url}</Text>
      ) : (
        <Loading size={28} />
      )}
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Button title="Share link" icon="share" size="sm" disabled={!url} onPress={() => url && void Share.share({ message: `Send me a Speow! ${url}`, url })} />
        <Button
          title="Copy"
          icon="link"
          size="sm"
          variant="secondary"
          disabled={!url}
          onPress={async () => {
            if (!url) return;
            await Clipboard.setStringAsync(url);
            toast('Link copied', 'success');
          }}
        />
        <Button
          title="Reset"
          size="sm"
          variant="ghost"
          onPress={async () => {
            if (await confirm({ title: 'Reset invite link?', body: 'Your current link will stop working. Pending requests stay.', confirm: 'Reset' })) rotate.mutate();
          }}
        />
      </View>
    </Card>
  );
}

export default function AddScreen() {
  const t = useAppTheme();
  const toast = useToast();
  const [term, setTerm] = useState('');
  const q = useDebounced(term.trim().toLowerCase().replace(/^@/, ''), 300);
  const search = useQuery({ queryKey: keys.search(q), queryFn: () => api.search(q), enabled: q.length >= 2 });
  const requests = useFriendRequests();

  const respond = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => (accept ? api.acceptRequest(id) : api.rejectRequest(id)),
    onSuccess: (_d, v) => {
      toast(v.accept ? 'Friend added!' : 'Request declined', v.accept ? 'success' : 'info');
      refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const cancel = useMutation({ mutationFn: api.cancelRequest, onSuccess: refresh, onError: (e) => toast(errorMessage(e), 'error') });

  const incoming = requests.data?.incoming ?? [];
  const outgoing = requests.data?.outgoing ?? [];

  return (
    <Screen edges={['top']} title="Add friends">
      <Input icon="search" placeholder="Search by username" autoCapitalize="none" autoCorrect={false} value={term} onChangeText={setTerm} returnKeyType="search" />
      {q.length >= 2 ? (
        <View style={{ gap: space.sm }}>
          {search.isLoading ? (
            <Loading size={32} />
          ) : search.data?.users.length ? (
            search.data.users.map((u) => <UserRow key={u.id} user={u} right={<RelationshipAction profile={u} />} />)
          ) : (
            <Text tone="muted">No one with a username starting with “{q}”.</Text>
          )}
        </View>
      ) : null}

      {incoming.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">Requests for you</Text>
          {incoming.map((r) => (
            <UserRow
              key={r.id}
              user={r.user}
              right={
                <View style={{ flexDirection: 'row', gap: space.xs }}>
                  <IconButton name="close" label={`Decline ${r.user.displayName}`} color={t.colors.textMuted} onPress={() => respond.mutate({ id: r.id, accept: false })} />
                  <Button title="Accept" size="sm" onPress={() => respond.mutate({ id: r.id, accept: true })} />
                </View>
              }
            />
          ))}
        </View>
      ) : null}

      <InviteCard />

      {outgoing.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">Sent requests</Text>
          {outgoing.map((r) => (
            <UserRow key={r.id} user={r.user} right={<Button title="Cancel" size="sm" variant="ghost" onPress={() => cancel.mutate(r.id)} />} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
});
