import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { colorName, getBubbleColor, resolveIncomingPresentation, resolveIncomingSound, type FriendSummary } from '@zynk/shared';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { incomingZynks, type IncomingZynk } from '../../lib/events';
import { haptic } from '../../lib/haptics';
import { useActivity, useEffectivePrefs, useFeatures } from '../../lib/hooks';
import { keys, queryClient } from '../../lib/query';
import { playSound } from '../../lib/sounds';
import { radius, space } from '../../theme/tokens';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Avatar, Button, Text } from '../ui';
import { burstColorsFor } from './burstColors';
import { ReactionGlyph } from './ReactionGlyph';
import { useSendZynk } from './useSendZynk';
import { ZynkBurst } from './ZynkBurst';

/**
 * Announces Speows received while the app is open — from a foreground push or
 * from the Activity poll (so it also works with notifications disabled).
 * Presentation and sound are decided by the *recipient's* settings.
 */
export function IncomingZynkOverlay() {
  const [current, setCurrent] = useState<IncomingZynk | null>(null);
  const queue = useRef<IncomingZynk[]>([]);
  const activity = useActivity('all');
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    const unsubscribe = incomingZynks.subscribe((z) => {
      if (current) queue.current.push(z);
      else setCurrent(z);
    });
    return () => {
      unsubscribe();
    };
  }, [current]);

  // Poll path: new, unseen received Speows since this app session started.
  useEffect(() => {
    for (const z of activity.data?.items ?? []) {
      if (z.direction !== 'received' || z.seenAt) continue;
      if (!startedAt.current || Date.parse(z.createdAt) < startedAt.current - 5000) {
        incomingZynks.markKnown(z.id);
        continue;
      }
      incomingZynks.emit({ zynk: z });
    }
  }, [activity.data]);

  const next = () => {
    const n = queue.current.shift() ?? null;
    setCurrent(n);
  };

  if (!current) return null;
  return <OverlayCard key={current.zynk.id} incoming={current} onClose={next} />;
}

function OverlayCard({ incoming, onClose }: { incoming: IncomingZynk; onClose: () => void }) {
  const t = useAppTheme();
  const { t: tr, lang } = useI18n();
  const prefs = useEffectivePrefs();
  const features = useFeatures();
  const systemReduceMotion = useReducedMotion();
  const { zynk } = incoming;
  const [playKey] = useState(1);
  const { send } = useSendZynk(zynk.counterpart.id, { onSent: onClose });

  const pres = resolveIncomingPresentation(
    { effectId: zynk.effectId, bubbleColorId: zynk.bubbleColorId },
    {
      showSenderStyle: prefs?.showSenderStyle ?? true,
      reduceMotion: prefs?.reduceMotion ?? false,
      bubbleColorId: prefs?.bubbleColorId ?? 'lime',
      effectId: prefs?.effectId ?? 'classic',
    },
    systemReduceMotion,
  );
  const bubble = getBubbleColor(pres.bubbleColorId) ?? getBubbleColor('lime')!;

  useEffect(() => {
    if (prefs?.haptics !== false) void haptic.zynk();
    const friends = queryClient.getQueryData<{ friends: FriendSummary[] }>(keys.friends)?.friends;
    const soundId =
      incoming.soundId !== undefined
        ? incoming.soundId
        : resolveIncomingSound({
            senderSoundId: zynk.soundId,
            recipient: {
              soundsEnabled: prefs?.soundsEnabled ?? true,
              allowSenderSounds: prefs?.allowSenderSounds ?? true,
              incomingSoundId: prefs?.incomingSoundId ?? 'zynk_classic',
            },
            recipientFeatures: features,
            friendOverrideSoundId: friends?.find((f) => f.id === zynk.counterpart.id)?.friendSoundId,
          });
    if (soundId && prefs?.soundsEnabled !== false) void playSound(soundId);
    api
      .markSeen([zynk.id])
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: keys.activityAll });
        void queryClient.invalidateQueries({ queryKey: keys.friends });
      })
      .catch(() => undefined);
    const timer = setTimeout(onClose, 4500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={tr('common.dismiss')}>
        <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(140)} style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
          <ZynkBurst
            playKey={playKey}
            effectId={pres.effectId}
            reduceMotion={pres.reduceMotion}
            bubbleFill={bubble.color}
            outline={burstColorsFor(t, bubble.color).outline}
            burstColor={burstColorsFor(t, bubble.color).burst}
            size={230}
          >
            {zynk.reactionId ? (
              <ReactionGlyph reactionId={zynk.reactionId} fallback={zynk.reactionFallback} size={54} />
            ) : (
              <Text variant="hero" style={{ color: bubble.ink, fontSize: 64, lineHeight: 72 }}>!</Text>
            )}
          </ZynkBurst>
          <View style={styles.who}>
            <Avatar user={zynk.counterpart} size={40} />
            <Text variant="heading" accessibilityLiveRegion="assertive">{zynk.bubbleColorId && colorName(lang, zynk.bubbleColorId)
                ? tr('activity.receivedColor', { name: zynk.counterpart.displayName, color: colorName(lang, zynk.bubbleColorId)! })
                : tr('activity.received', { name: zynk.counterpart.displayName })}
            </Text>
          </View>
          <View style={styles.actions}>
            <Button title={tr('common.later')} variant="ghost" size="sm" onPress={onClose} />
            <Button
              title={tr('activity.speowBack')}
              icon="bolt"
              size="sm"
              onPress={() => {
                send(null);
              }}
            />
          </View>
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              onClose();
              router.push(`/user/${zynk.counterpart.id}`);
            }}
          >
            <Text variant="caption" tone="muted">{tr('overlay.viewProfile')}</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,5,10,0.65)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { alignItems: 'center', borderRadius: radius.xl, borderWidth: 1, paddingVertical: space.xl, paddingHorizontal: space.xl, gap: space.md, width: '100%', maxWidth: 380 },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexShrink: 1 },
  actions: { flexDirection: 'row', gap: space.sm },
});
