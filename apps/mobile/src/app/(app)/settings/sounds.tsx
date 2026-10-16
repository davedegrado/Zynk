import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DEFAULTS, hasFeature, SOUNDS } from '@zynk/shared';
import { Chip, Divider, Icon, IconButton, PlusBadge, Screen, Section, Text, ToggleRow, useToast } from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { useFeatures, usePreferences, useUser } from '../../../lib/hooks';
import { useUpdatePrefs } from '../../../lib/prefs';
import { keys, queryClient } from '../../../lib/query';
import { playSound } from '../../../lib/sounds';
import { space } from '../../../theme/tokens';
import { useAppTheme } from '../../../theme/ThemeProvider';

function SoundList({ value, onSelect, defaultLabel }: { value: string | null; onSelect: (id: string | null) => void; defaultLabel?: string }) {
  const t = useAppTheme();
  const features = useFeatures();
  return (
    <Section>
      {defaultLabel ? (
        <>
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: value === null }} onPress={() => onSelect(null)} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{defaultLabel}</Text>
            </View>
            {value === null ? <Icon name="check" color={t.colors.accentText} /> : null}
          </Pressable>
          <Divider />
        </>
      ) : null}
      {SOUNDS.filter((s) => !s.retired).map((s, i) => {
        const locked = !hasFeature(features, s.requiredFeature);
        const selected = value === s.id;
        return (
          <View key={s.id}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${s.name}${locked ? ', ZYNK Plus' : ''}`}
              onPress={() => (locked ? router.push('/plus') : onSelect(s.id))}
              style={styles.row}
            >
              <IconButton name="sound" label={`Preview ${s.name}`} onPress={() => void playSound(s.id)} color={t.colors.accentText} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{s.name}</Text>
                <Text variant="caption" tone="muted">{s.description}</Text>
              </View>
              {locked ? <PlusBadge locked /> : selected ? <Icon name="check" color={t.colors.accentText} /> : null}
            </Pressable>
            {i < SOUNDS.length - 1 ? <Divider /> : null}
          </View>
        );
      })}
    </Section>
  );
}

function FriendSound({ friendId }: { friendId: string }) {
  const toast = useToast();
  const friend = useUser(friendId);
  const set = useMutation({
    mutationFn: (soundId: string | null) => api.setFriendSound(friendId, soundId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.user(friendId) });
      void queryClient.invalidateQueries({ queryKey: keys.friends });
      toast('Saved', 'success');
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const name = friend.data?.displayName ?? 'this friend';
  return (
    <Screen back title={`When ${name} zynks you`} subtitle="Only you hear this. It overrides the sound they picked.">
      <SoundList value={friend.data?.friendSoundId ?? null} onSelect={(id) => set.mutate(id)} defaultLabel="Use my normal settings" />
    </Screen>
  );
}

export default function SoundSettings() {
  const { friend } = useLocalSearchParams<{ friend?: string }>();
  const prefs = usePreferences().data?.selected;
  const update = useUpdatePrefs();
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  if (friend) return <FriendSound friendId={friend} />;
  if (!prefs) return <Screen back title="Sounds"><Text tone="muted">Loading…</Text></Screen>;
  return (
    <Screen back title="Sounds" subtitle="All ZYNK sounds are original. Tap the speaker to preview.">
      <Section footer="Sounds respect your phone's silent mode, volume and Focus settings.">
        <ToggleRow title="Zynk sounds" value={prefs.soundsEnabled} onChange={(v) => update.mutate({ soundsEnabled: v })} />
        <Divider />
        <ToggleRow
          title="Play friends' chosen sounds"
          subtitle="Off: every Zynk uses your own sound"
          value={prefs.allowSenderSounds}
          disabled={!prefs.soundsEnabled}
          onChange={(v) => update.mutate({ allowSenderSounds: v })}
        />
      </Section>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="What I hear" selected={tab === 'incoming'} onPress={() => setTab('incoming')} />
        <Chip label="What friends hear" selected={tab === 'outgoing'} onPress={() => setTab('outgoing')} />
      </View>
      <Text variant="caption" tone="muted">
        {tab === 'incoming'
          ? 'Your default sound for incoming Zynks. Per-friend sounds can be set from a friend’s profile.'
          : 'Sent along with your Zynks. Friends hear it only if their settings allow.'}
      </Text>
      <SoundList
        value={tab === 'incoming' ? prefs.incomingSoundId : prefs.outgoingSoundId}
        onSelect={(id) => update.mutate(tab === 'incoming' ? { incomingSoundId: id ?? DEFAULTS.soundId } : { outgoingSoundId: id ?? DEFAULTS.soundId })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 60 },
});
