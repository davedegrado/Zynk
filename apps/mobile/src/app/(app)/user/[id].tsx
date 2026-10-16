import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { colorName, getBubbleColor, getSound } from '@zynk/shared';
import { RelationshipAction, refreshSocial } from '../../../components/RelationshipAction';
import { Avatar, Button, Divider, ErrorState, Loading, PlusBadge, Row, Screen, Section, Text, ToggleRow, useConfirm, useToast } from '../../../components/ui';
import { burstColorsFor } from '../../../components/zynk/burstColors';
import { ReactionGlyph } from '../../../components/zynk/ReactionGlyph';
import { ReactionPicker } from '../../../components/zynk/ReactionPicker';
import { SpeowColorPicker } from '../../../components/zynk/SpeowColorPicker';
import { useSendZynk } from '../../../components/zynk/useSendZynk';
import { ZynkButton } from '../../../components/zynk/ZynkButton';
import { ZynkBurst } from '../../../components/zynk/ZynkBurst';
import { useI18n } from '../../../i18n';
import { api, errorMessage } from '../../../lib/api';
import { formatDate, timeAgo } from '../../../lib/format';
import { useEffectivePrefs, useHasFeature, useUser } from '../../../lib/hooks';
import { useUpdatePrefs } from '../../../lib/prefs';
import { keys, queryClient } from '../../../lib/query';
import { space } from '../../../theme/tokens';
import { useAppTheme } from '../../../theme/ThemeProvider';

function ZynkPanel({ friendId, name }: { friendId: string; name: string }) {
  const theme = useAppTheme();
  const { t, td, lang } = useI18n();
  const prefs = useEffectivePrefs();
  const updatePrefs = useUpdatePrefs();
  const systemReduce = useReducedMotion();
  const [reaction, setReaction] = useState<string | null>(null);
  const [colorId, setColorId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const { send, sending } = useSendZynk(friendId, {
    onSent: (r) => {
      setSentAt(r.zynk.createdAt);
      setReaction(null);
    },
  });
  // The chosen color is free and becomes the default for quick sends too.
  const selectedColor = colorId ?? prefs?.bubbleColorId ?? 'lime';
  const swatch = getBubbleColor(selectedColor) ?? getBubbleColor('lime')!;
  const colors = burstColorsFor(theme, swatch.color);
  const chooseColor = (id: string) => {
    setColorId(id);
    if (id !== prefs?.bubbleColorId) updatePrefs.mutate({ bubbleColorId: id });
  };

  return (
    <View style={{ alignItems: 'center', gap: space.md }}>
      <View style={{ height: 230, alignItems: 'center', justifyContent: 'center' }}>
        {playKey ? (
          <ZynkBurst
            playKey={playKey}
            effectId={prefs?.effectId ?? 'classic'}
            reduceMotion={(prefs?.reduceMotion ?? false) || systemReduce}
            bubbleFill={swatch.color}
            outline={colors.outline}
            burstColor={colors.burst}
            size={230}
            onDone={() => setPlayKey(0)}
          >
            {reaction ? <ReactionGlyph reactionId={reaction} size={52} /> : <Text variant="hero" style={{ color: swatch.ink, fontSize: 64, lineHeight: 72 }}>!</Text>}
          </ZynkBurst>
        ) : (
          <ZynkButton
            size={210}
            disabled={sending}
            fill={swatch.color}
            ink={swatch.ink}
            accessibilityLabel={t('send.button', { name, color: colorName(lang, selectedColor) ?? '' })}
            onPress={() => {
              if (send(reaction, null, selectedColor)) setPlayKey(Date.now());
            }}
          />
        )}
      </View>
      <Text tone="muted" accessibilityLiveRegion="polite">
        {sending ? t('send.sending') : sentAt ? t('send.sentAgo', { time: timeAgo(sentAt) }) : t('send.tapTo', { name })}
      </Text>
      <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: space.xs }}>
        <Text variant="label" tone="muted">{t('send.colorLabel', { color: td(`color.${selectedColor}`, swatch.name) })}</Text>
        <SpeowColorPicker value={selectedColor} onChange={chooseColor} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {reaction ? <ReactionGlyph reactionId={reaction} size={28} /> : null}
        <Button title={reaction ? t('send.changeReaction') : t('send.addReaction')} variant="secondary" size="sm" onPress={() => setShowPicker((v) => !v)} />
        {reaction ? <Button title={t('common.clear')} variant="ghost" size="sm" onPress={() => setReaction(null)} /> : null}
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
  const { t, td } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const user = useUser(id);
  const canFriendSounds = useHasFeature('custom_sounds');

  const after = () => {
    void queryClient.invalidateQueries({ queryKey: keys.user(id) });
    refreshSocial();
  };
  const mute = useMutation({ mutationFn: (m: boolean) => (m ? api.mute(id) : api.unmute(id)), onSuccess: after, onError: (e) => toast(errorMessage(e), 'error') });
  const remove = useMutation({
    mutationFn: () => api.removeFriend(id),
    onSuccess: () => {
      after();
      toast(t('user.removed'));
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const block = useMutation({
    mutationFn: (b: boolean) => (b ? api.block(id) : api.unblock(id)),
    onSuccess: (_d, b) => {
      after();
      void queryClient.invalidateQueries({ queryKey: keys.blocks });
      void queryClient.invalidateQueries({ queryKey: keys.activityAll });
      toast(b ? t('user.blocked') : t('user.unblocked'));
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  if (user.isLoading) return <Screen back><Loading /></Screen>;
  if (user.error || !user.data) {
    return (
      <Screen back>
        <ErrorState message={user.error ? errorMessage(user.error) : t('user.notFound')} onRetry={() => user.refetch()} />
      </Screen>
    );
  }
  const p = user.data;
  const isFriend = p.relationship === 'friend';
  const friendSound = p.friendSoundId ? getSound(p.friendSoundId) : undefined;

  return (
    <Screen back>
      <View style={styles.head}>
        <Avatar user={p} size={96} />
        <Text variant="title" center numberOfLines={2}>{p.displayName}</Text>
        <Text tone="muted">
          @{p.username}
          {p.friendSince ? ` · ${t('user.friendsSince', { date: formatDate(p.friendSince, { month: 'short', year: 'numeric' }) })}` : ''}
        </Text>
        {!isFriend && p.relationship !== 'blocked' && p.relationship !== 'self' ? <RelationshipAction profile={p} /> : null}
      </View>

      {isFriend ? <ZynkPanel friendId={p.id} name={p.displayName} /> : null}

      {isFriend ? (
        <Section title={t('user.thisFriend')} footer={t('user.muteFooter')}>
          <ToggleRow title={t('user.mute')} value={p.muted} onChange={(v) => mute.mutate(v)} />
          <Divider />
          <Row
            icon="sound"
            title={t('user.theirSound')}
            subtitle={friendSound ? td(`sound.${friendSound.id}.name`, friendSound.name) : t('user.defaultSound')}
            right={canFriendSounds ? undefined : <PlusBadge locked />}
            chevron
            onPress={() => router.push(canFriendSounds ? `/settings/sounds?friend=${p.id}` : '/plus')}
          />
        </Section>
      ) : null}

      {p.relationship !== 'self' ? (
        <Section title={t('user.safety')}>
          {isFriend ? (
            <>
              <Row
                icon="close"
                title={t('user.remove')}
                onPress={async () => {
                  if (await confirm({ title: t('user.removeTitle', { name: p.displayName }), body: t('user.removeBody'), confirm: t('user.removeConfirm'), cancel: t('common.cancel'), destructive: true })) remove.mutate();
                }}
              />
              <Divider />
            </>
          ) : null}
          {p.relationship === 'blocked' ? (
            <Row icon="shield" title={t('user.unblock')} onPress={() => block.mutate(false)} />
          ) : (
            <Row
              icon="shield"
              title={t('user.block')}
              destructive
              onPress={async () => {
                if (await confirm({ title: t('user.blockTitle', { name: p.displayName }), body: t('user.blockBody'), confirm: t('user.block'), cancel: t('common.cancel'), destructive: true })) block.mutate(true);
              }}
            />
          )}
          <Divider />
          <Row icon="flag" title={t('user.report')} destructive onPress={() => router.push(`/report/${p.id}`)} />
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: space.sm },
});
