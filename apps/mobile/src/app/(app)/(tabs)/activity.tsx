import { useMutation } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { hasFeature, REACTION_PACKS, reactionRef, type ZynkEvent } from '@zynk/shared';
import { Avatar, Button, Chip, EmptyState, ErrorState, Icon, Loading, Screen, Text, useToast } from '../../../components/ui';
import { ReactionGlyph } from '../../../components/zynk/ReactionGlyph';
import { useSendZynk } from '../../../components/zynk/useSendZynk';
import { api, errorMessage } from '../../../lib/api';
import { timeAgo } from '../../../lib/format';
import { useActivity, useFeatures } from '../../../lib/hooks';
import { keys, queryClient } from '../../../lib/query';
import { radius, space } from '../../../theme/tokens';
import { useAppTheme } from '../../../theme/ThemeProvider';

type Filter = 'all' | 'received' | 'sent';

function ReactRow({ zynk, onDone }: { zynk: ZynkEvent; onDone: () => void }) {
  const t = useAppTheme();
  const toast = useToast();
  const features = useFeatures();
  const options = REACTION_PACKS.filter((p) => !p.retired && hasFeature(features, p.requiredFeature)).flatMap((p) =>
    p.items.slice(0, p.id === 'basic' ? 8 : 4).map((i) => reactionRef(p.id, i.id)),
  );
  const react = useMutation({
    mutationFn: (ref: string | null) => api.reactToZynk(zynk.id, ref),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.activityAll });
      onDone();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <View style={[styles.reactRow, { backgroundColor: t.colors.surfaceAlt }]}>
      {options.map((ref) => (
        <Pressable key={ref} accessibilityRole="button" onPress={() => react.mutate(zynk.responseReactionId === ref ? null : ref)} style={[styles.reactCell, zynk.responseReactionId === ref && { backgroundColor: t.colors.accent }]}>
          <ReactionGlyph reactionId={ref} size={28} animate={false} />
        </Pressable>
      ))}
    </View>
  );
}

function ActivityItem({ zynk, highlighted }: { zynk: ZynkEvent; highlighted: boolean }) {
  const t = useAppTheme();
  const toast = useToast();
  const [reacting, setReacting] = useState(false);
  const { send, sending } = useSendZynk(zynk.counterpart.id, { onSent: () => toast(`Zynked ${zynk.counterpart.displayName} back!`, 'success') });
  const received = zynk.direction === 'received';
  const isNew = received && !zynk.seenAt;
  return (
    <View style={[styles.item, { backgroundColor: t.colors.surface, borderColor: highlighted || isNew ? t.colors.accent : t.colors.border }]}>
      <View style={styles.itemTop}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${zynk.counterpart.displayName}'s profile`} onPress={() => router.push(`/user/${zynk.counterpart.id}`)}>
          <Avatar user={zynk.counterpart} size={44} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {received ? `${zynk.counterpart.displayName} zynked you` : `You zynked ${zynk.counterpart.displayName}`}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Icon name={received ? 'arrowIn' : 'arrowOut'} size={14} color={t.colors.textMuted} />
            <Text variant="caption" tone="muted">
              {timeAgo(zynk.createdAt)}
              {!received ? (zynk.seenAt ? ' · Seen' : ' · Delivered') : ''}
            </Text>
            {isNew ? <View style={[styles.dot, { backgroundColor: t.colors.accent }]} accessibilityLabel="New" /> : null}
          </View>
        </View>
        {zynk.reactionId ? <ReactionGlyph reactionId={zynk.reactionId} fallback={zynk.reactionFallback} size={36} /> : null}
      </View>
      {zynk.responseReactionId ? (
        <View style={styles.response}>
          <Text variant="caption" tone="muted">{received ? 'You reacted' : `${zynk.counterpart.displayName} reacted`}</Text>
          <ReactionGlyph reactionId={zynk.responseReactionId} fallback={zynk.responseReactionFallback} size={24} />
        </View>
      ) : null}
      {received ? (
        <View style={styles.actions}>
          <Button title="Zynk back" icon="bolt" size="sm" onPress={() => send(null)} loading={sending} />
          <Button title={reacting ? 'Close' : 'React'} size="sm" variant="secondary" onPress={() => setReacting((v) => !v)} />
        </View>
      ) : null}
      {reacting ? <ReactRow zynk={zynk} onDone={() => setReacting(false)} /> : null}
    </View>
  );
}

export default function ActivityScreen() {
  const params = useLocalSearchParams<{ zynk?: string }>();
  const [filter, setFilter] = useState<Filter>('all');
  const activity = useActivity(filter);
  const [older, setOlder] = useState<ZynkEvent[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);

  // Opening Activity marks received Zynks as seen.
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        api.markAllSeen()
          .then((r) => {
            if (r.updated) {
              void queryClient.invalidateQueries({ queryKey: keys.activityAll });
              void queryClient.invalidateQueries({ queryKey: keys.friends });
            }
          })
          .catch(() => undefined);
      }, 1200);
      return () => clearTimeout(timer);
    }, []),
  );

  const items = [...(activity.data?.items ?? []), ...older];
  const nextBefore = cursor === undefined ? activity.data?.nextBefore : cursor;

  const loadMore = async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.activity({ direction: filter, before: nextBefore, limit: 50 });
      setOlder((o) => [...o, ...page.items]);
      setCursor(page.nextBefore);
    } finally {
      setLoadingMore(false);
    }
  };

  const changeFilter = (f: Filter) => {
    setFilter(f);
    setOlder([]);
    setCursor(undefined);
  };

  return (
    <Screen edges={['top']} title="Activity" refreshControl={<RefreshControl refreshing={false} onRefresh={() => void activity.refetch()} />}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {(['all', 'received', 'sent'] as const).map((f) => (
          <Chip key={f} label={f === 'all' ? 'All' : f === 'received' ? 'Received' : 'Sent'} selected={filter === f} onPress={() => changeFilter(f)} />
        ))}
      </View>
      {activity.isLoading ? (
        <Loading />
      ) : activity.error ? (
        <ErrorState message={errorMessage(activity.error)} onRetry={() => activity.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={filter === 'sent' ? 'Nothing sent yet' : 'No Zynks yet'}
          body={filter === 'sent' ? 'Pick a friend and hit the big burst.' : "When friends zynk you, it'll show up here — even with notifications off."}
          action="Go to friends"
          onAction={() => router.push('/')}
        />
      ) : (
        <View style={{ gap: space.sm }}>
          {items.map((z) => (
            <ActivityItem key={z.id} zynk={z} highlighted={params.zynk === z.id} />
          ))}
          {nextBefore ? <Button title="Load older" variant="ghost" onPress={loadMore} loading={loadingMore} /> : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { borderRadius: radius.lg, borderWidth: 1.5, padding: space.md, gap: space.md },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actions: { flexDirection: 'row', gap: space.sm },
  response: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginLeft: 56 },
  reactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, padding: space.sm, borderRadius: radius.md },
  reactCell: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
