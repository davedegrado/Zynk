import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { getSound } from '@zynk/shared';
import { RelationshipAction, refreshSocial } from '../../../components/RelationshipAction';
import { Avatar, Button, Divider, ErrorState, Loading, PlusBadge, Row, Screen, Section, Text, ToggleRow, useConfirm, useToast } from '../../../components/ui';
import { burstColorsFor } from '../../../components/zynk/burstColors';
import { ReactionGlyph } from '../../../components/zynk/ReactionGlyph';
import { ReactionPicker } from '../../../components/zynk/ReactionPicker';
import { useSendZynk } from '../../../components/zynk/useSendZynk';
import { ZynkButton } from '../../../components/zynk/ZynkButton';
import { ZynkBurst } from '../../../components/zynk/ZynkBurst';
import { api, errorMessage } from '../../../lib/api';
import { timeAgo } from '../../../lib/format';
import { useEffectivePrefs, useHasFeature, useUser } from '../../../lib/hooks';
import { keys, queryClient } from '../../../lib/query';
import { space } from '../../../theme/tokens';
import { useAppTheme } from '../../../theme/ThemeProvider';

function ZynkPanel({ friendId, name }: { friendId: string; name: string }) {
  const t = useAppTheme();
  const prefs = useEffectivePrefs();
  const systemReduce = useReducedMotion();
  const [reaction, setReaction] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const { send, sending } = useSendZynk(friendId, {
    onSent: (r) => {
      setSentAt(r.zynk.createdAt);
      setReaction(null);
    },
  });
  return (
    <View style={{ alignItems: 'center', gap: space.lg }}>
      <View style={{ height: 230, alignItems: 'center', justifyContent: 'center' }}>
        {playKey ? (
          <ZynkBurst
            playKey={playKey}
            effectId={prefs?.effectId ?? 'classic'}
            reduceMotion={(prefs?.reduceMotion ?? false) || systemReduce}
            bubbleFill={t.colors.bubble}
            outline={burstColorsFor(t, t.colors.bubble).outline}
            burstColor={burstColorsFor(t, t.colors.bubble).burst}
            size={230}
            onDone={() => setPlayKey(0)}
          >
            {reaction ? <ReactionGlyph reactionId={reaction} size={52} /> : <Text variant="hero" style={{ color: t.colors.onBubble, fontSize: 64, lineHeight: 72 }}>!</Text>}
          </ZynkBurst>
        ) : (
          <ZynkButton
            size={210}
            disabled={sending}
            accessibilityLabel={`Send a Speow to ${name}`}
            onPress={() => {
              if (send(reaction)) setPlayKey(Date.now());
            }}
          />
        )}
      </View>
      <Text tone="muted" accessibilityLiveRegion="polite">
        {sending ? 'Sending…' : sentAt ? `You sent a Speow! · ${timeAgo(sentAt)}` : `Tap to send ${name} a Speow`}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {reaction ? <ReactionGlyph reactionId={reaction} size={28} /> : null}
        <Button
          title={reaction ? 'Change reaction' : 'Add a reaction'}
          variant="secondary"
          size="sm"
          onPress={() => setShowPicker((v) => !v)}
        />
        {reaction ? <Button title="Clear" variant="ghost" size="sm" onPress={() => setReaction(null)} /> : null}
      </View>
      {showPicker ? (
        <View style={{ alignSelf: 'stretch' }}>
          <ReactionPicker
            value={reaction}
            onChange={(r) => {
              setReaction(r);
              if (r) setShowPicker(false);
            }}
            onLocked={() => router.push('/plus')}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const confirm = useConfirm();
  const user = useUser(id);
  const canFriendSounds = useHasFeature('custom_sounds');

  const after = () => {
    void queryClient.invalidateQueries({ queryKey: keys.user(id) });
    refreshSocial();
  };
  const mute = useMutation({ mutationFn: (m: boolean) => (m ? api.mute(id) : api.unmute(id)), onSuccess: after, onError: (e) => toast(errorMessage(e), 'error') });
  const remove = useMutation({ mutationFn: () => api.removeFriend(id), onSuccess: () => { after(); toast('Removed from friends'); }, onError: (e) => toast(errorMessage(e), 'error') });
  const block = useMutation({
    mutationFn: (b: boolean) => (b ? api.block(id) : api.unblock(id)),
    onSuccess: (_d, b) => {
      after();
      void queryClient.invalidateQueries({ queryKey: keys.blocks });
      void queryClient.invalidateQueries({ queryKey: keys.activityAll });
      toast(b ? 'Blocked. They can no longer find you or send you a Speow.' : 'Unblocked');
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  if (user.isLoading) return <Screen back><Loading /></Screen>;
  if (user.error || !user.data) {
    return (
      <Screen back>
        <ErrorState message={user.error ? errorMessage(user.error) : 'User not found'} onRetry={() => user.refetch()} />
      </Screen>
    );
  }
  const p = user.data;
  const isFriend = p.relationship === 'friend';

  return (
    <Screen back>
      <View style={styles.head}>
        <Avatar user={p} size={96} />
        <Text variant="title" center numberOfLines={2}>{p.displayName}</Text>
        <Text tone="muted">@{p.username}{p.friendSince ? ` · friends since ${new Date(p.friendSince).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : ''}</Text>
        {!isFriend && p.relationship !== 'blocked' && p.relationship !== 'self' ? <RelationshipAction profile={p} /> : null}
      </View>

      {isFriend ? <ZynkPanel friendId={p.id} name={p.displayName} /> : null}

      {isFriend ? (
        <Section title="This friend" footer="Muting stops notifications from this friend. Their Speows still appear in Activity.">
          <ToggleRow title="Mute notifications" value={p.muted} onChange={(v) => mute.mutate(v)} />
          <Divider />
          <Row
            icon="sound"
            title="Their Speow sound"
            subtitle={p.friendSoundId ? getSound(p.friendSoundId)?.name : 'Default'}
            right={canFriendSounds ? undefined : <PlusBadge locked />}
            chevron
            onPress={() => router.push(canFriendSounds ? `/settings/sounds?friend=${p.id}` : '/plus')}
          />
        </Section>
      ) : null}

      {p.relationship !== 'self' ? (
        <Section title="Safety">
          {isFriend ? (
            <>
              <Row
                icon="close"
                title="Remove friend"
                onPress={async () => {
                  if (await confirm({ title: `Remove ${p.displayName}?`, body: 'You can add each other again later.', confirm: 'Remove', destructive: true })) remove.mutate();
                }}
              />
              <Divider />
            </>
          ) : null}
          {p.relationship === 'blocked' ? (
            <Row icon="shield" title="Unblock" onPress={() => block.mutate(false)} />
          ) : (
            <Row
              icon="shield"
              title="Block"
              destructive
              onPress={async () => {
                if (await confirm({ title: `Block ${p.displayName}?`, body: "They won't be able to find you, add you or send you a Speow. They won't be notified.", confirm: 'Block', destructive: true })) block.mutate(true);
              }}
            />
          )}
          <Divider />
          <Row icon="flag" title="Report" destructive onPress={() => router.push(`/report/${p.id}`)} />
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: space.sm },
});
