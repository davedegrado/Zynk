import { useMutation } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { colorName, getBubbleColor, hasFeature, REACTION_PACKS, reactionRef, type ZynkEvent } from '@zynk/shared';
import { Avatar, Button, Chip, EmptyState, ErrorState, Icon, Loading, Screen, Text, useToast } from '../../../components/ui';
import { ReactionGlyph } from '../../../components/zynk/ReactionGlyph';
import { useSendZynk } from '../../../components/zynk/useSendZynk';
import { useI18n } from '../../../i18n';
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

function ActivityItem({ zynk, highlighted, showActions }: { zynk: ZynkEvent; highlighted: boolean; showActions: boolean }) {
  const t = useAppTheme();
  const { t: tr, lang } = useI18n();
  const toast = useToast();
  const [reacting, setReacting] = useState(false);
  const { send, sending } = useSendZynk(zynk.counterpart.id, { onSent: () => toast(tr('activity.sentBack', { name: zynk.counterpart.displayName }), 'success') });
  const received = zynk.direction === 'received';
  const name = zynk.counterpart.displayName;
  const color = colorName(lang, zynk.bubbleColorId);
  const swatch = getBubbleColor(zynk.bubbleColorId);
  const isNew = received && !zynk.seenAt;
  return (
    <View style={[styles.item, { backgroundColor: t.colors.surface, borderColor: highlighted || isNew ? t.colors.accent : t.colors.border }]}>
      <View style={styles.itemTop}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr('friends.openProfile', { name })} onPress={() => router.push(`/user/${zynk.counterpart.id}`)}>
          <Avatar user={zynk.counterpart} size={44} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {received ? tr(color ? 'activity.receivedColor' : 'activity.received', { name, color: color ?? '' }) : tr(color ? 'activity.sentColor' : 'activity.sent', { name, color: color ?? '' })}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            {swatch ? <View style={[styles.colorDot, { backgroundColor: swatch.color, borderColor: t.colors.border }]} /> : null}
            <Icon name={received ? 'arrowIn' : 'arrowOut'} size={14} color={t.colors.textMuted} />
            <Text variant="caption" tone="muted">
              {timeAgo(zynk.createdAt)}
              {!received ? ` · ${tr(zynk.seenAt ? 'activity.seen' : 'activity.delivered')}` : ''}
            </Text>
            {isNew ? <View style={[styles.dot, { backgroundColor: t.colors.accent }]} accessibilityLabel={tr('common.new')} /> : null}
          </View>
        </View>
        {zynk.reactionId ? <ReactionGlyph reactionId={zynk.reactionId} fallback={zynk.reactionFallback} size={36} /> : null}
      </View>
      {zynk.responseReactionId ? (
        <View style={styles.response}>
          <Text variant="caption" tone="muted">{received ? tr('activity.youReacted') : tr('activity.theyReacted', { name })}</Text>
          <ReactionGlyph reactionId={zynk.responseReactionId} fallback={zynk.responseReactionFallback} size={24} />
        </View>
      ) : null}
      {received && showActions ? (
        <View style={styles.actions}>
          <Button title={tr('activity.speowBack')} icon="bolt" size="sm" onPress={() => send(null)} loading={sending} />
          <Button title={reacting ? tr('common.close') : tr('activity.react')} size="sm" variant="secondary" onPress={() => setReacting((v) => !v)} />
        </View>
      ) : null}
      {reacting ? <ReactRow zynk={zynk} onDone={() => setReacting(false)} /> : null}
    </View>
  );
}

export default function ActivityScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ zynk?: string }>();
  const [filter, setFilter] = useState<Filter>('all');
  const activity = useActivity(filter);
  const [older, setOlder] = useState<ZynkEvent[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);

  // Opening Activity marks received Speows as seen.
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
  // Quick actions on the most recent Speow from each friend keep the list calm.
  const latestReceived = new Set<string>();
  const seenFriends = new Set<string>();
  for (const z of items) {
    if (z.direction === 'received' && !seenFriends.has(z.counterpart.id)) {
      seenFriends.add(z.counterpart.id);
      latestReceived.add(z.id);
    }
  }

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
    <Screen edges={['top']} title={t('tabs.activity')} refreshControl={<RefreshControl refreshing={false} onRefresh={() => void activity.refetch()} />}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {(['all', 'received', 'sent'] as const).map((f) => (
          <Chip key={f} label={t(f === 'all' ? 'activity.all' : f === 'received' ? 'activity.filterReceived' : 'activity.filterSent')} selected={filter === f} onPress={() => changeFilter(f)} />
        ))}
      </View>
      {activity.isLoading ? (
        <Loading />
      ) : activity.error ? (
        <ErrorState message={errorMessage(activity.error)} onRetry={() => activity.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t(filter === 'sent' ? 'activity.emptySentTitle' : 'activity.emptyTitle')}
          body={t(filter === 'sent' ? 'activity.emptySentBody' : 'activity.emptyBody')}
          action={t('activity.emptyAction')}
          onAction={() => router.push('/')}
        />
      ) : (
        <View style={{ gap: space.sm }}>
          {items.map((z) => (
            <ActivityItem key={z.id} zynk={z} highlighted={params.zynk === z.id} showActions={latestReceived.has(z.id) || params.zynk === z.id} />
          ))}
          {nextBefore ? <Button title={t('activity.loadOlder')} variant="ghost" onPress={loadMore} loading={loadingMore} /> : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { borderRadius: radius.lg, borderWidth: 1.5, padding: space.md, gap: space.md },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
  colorDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  actions: { flexDirection: 'row', gap: space.sm },
  response: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginLeft: 56 },
  reactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, padding: space.sm, borderRadius: radius.md },
  reactCell: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
