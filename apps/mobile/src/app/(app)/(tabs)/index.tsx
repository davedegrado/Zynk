import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import type { FriendSummary } from '@zynk/shared';
import { Wordmark } from '../../../components/brand/Wordmark';
import { Avatar, CountBadge, EmptyState, ErrorState, Icon, Loading, Screen, Text, useToast } from '../../../components/ui';
import { PushPrompt } from '../../../components/zynk/PushPrompt';
import { useSendZynk } from '../../../components/zynk/useSendZynk';
import { ZynkMini } from '../../../components/zynk/ZynkButton';
import { errorMessage } from '../../../lib/api';
import { timeAgo } from '../../../lib/format';
import { useFriends } from '../../../lib/hooks';
import { radius, space } from '../../../theme/tokens';
import { useAppTheme } from '../../../theme/ThemeProvider';

function FriendRow({ friend }: { friend: FriendSummary }) {
  const t = useAppTheme();
  const toast = useToast();
  const { send, sending } = useSendZynk(friend.id, { onSent: (r) => !r.duplicate && toast(`You sent ${friend.displayName} a Speow!`, 'success') });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${friend.displayName}, open profile`}
      onPress={() => router.push(`/user/${friend.id}`)}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.colors.surfaceAlt : t.colors.surface, borderColor: t.colors.border }]}
    >
      <Avatar user={friend} size={52} ring={friend.unseenFromThem ? t.colors.accent : undefined} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{friend.displayName}</Text>
          {friend.muted ? <Icon name="soundOff" size={16} color={t.colors.textMuted} /> : null}
        </View>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          @{friend.username}
          {friend.lastZynkAt ? ` · ${timeAgo(friend.lastZynkAt)}` : ''}
        </Text>
      </View>
      <CountBadge count={friend.unseenFromThem} />
      <ZynkMini onPress={() => send(null)} disabled={sending} accessibilityLabel={`Send ${friend.displayName} a Speow`} />
    </Pressable>
  );
}

export default function FriendsScreen() {
  const friends = useFriends();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await friends.refetch();
    setRefreshing(false);
  };
  return (
    <Screen edges={['top']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Wordmark size={30} />
      </View>
      <PushPrompt />
      {friends.isLoading ? (
        <Loading />
      ) : friends.error ? (
        <ErrorState message={errorMessage(friends.error)} onRetry={() => friends.refetch()} />
      ) : !friends.data?.length ? (
        <EmptyState
          title="It's quiet in here"
          body="Add a friend by username or share your invite link. Then send your first Speow."
          action="Add friends"
          onAction={() => router.push('/add')}
        />
      ) : (
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">Tap the bubble to send a Speow</Text>
          {friends.data.map((f) => (
            <FriendRow key={f.id} friend={f} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: space.md, paddingBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
});
