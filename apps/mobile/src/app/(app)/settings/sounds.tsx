import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DEFAULTS, hasFeature, SOUNDS } from '@zynk/shared';
import { Chip, Divider, Icon, IconButton, PlusBadge, Screen, Section, Text, ToggleRow, useToast } from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { api, errorMessage } from '../../../lib/api';
import { useFeatures, usePreferences, useUser } from '../../../lib/hooks';
import { useUpdatePrefs } from '../../../lib/prefs';
import { keys, queryClient } from '../../../lib/query';
import { playSound } from '../../../lib/sounds';
import { space } from '../../../theme/tokens';
import { useAppTheme } from '../../../theme/ThemeProvider';

function SoundList({ value, onSelect, defaultLabel }: { value: string | null; onSelect: (id: string | null) => void; defaultLabel?: string }) {
  const t = useAppTheme();
  const { t: tr, td } = useI18n();
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
              accessibilityLabel={`${td(`sound.${s.id}.name`, s.name)}${locked ? ', Speow Plus' : ''}`}
              onPress={() => (locked ? router.push('/plus') : onSelect(s.id))}
              style={styles.row}
            >
              <IconButton name="sound" label={tr('sounds.preview', { name: td(`sound.${s.id}.name`, s.name) })} onPress={() => void playSound(s.id)} color={t.colors.accentText} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{td(`sound.${s.id}.name`, s.name)}</Text>
                <Text variant="caption" tone="muted">{td(`sound.${s.id}.desc`, s.description)}</Text>
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
  const { t } = useI18n();
  const toast = useToast();
  const friend = useUser(friendId);
  const set = useMutation({
    mutationFn: (soundId: string | null) => api.setFriendSound(friendId, soundId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.user(friendId) });
      void queryClient.invalidateQueries({ queryKey: keys.friends });
      toast(t('common.saved'), 'success');
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const name = friend.data?.displayName ?? t('user.thisFriend');
  return (
    <Screen back title={t('sounds.friendTitle', { name })} subtitle={t('sounds.friendSubtitle')}>
      <SoundList value={friend.data?.friendSoundId ?? null} onSelect={(id) => set.mutate(id)} defaultLabel={t('sounds.useNormal')} />
    </Screen>
  );
}

export default function SoundSettings() {
  const { friend } = useLocalSearchParams<{ friend?: string }>();
  const { t } = useI18n();
  const prefs = usePreferences().data?.selected;
  const update = useUpdatePrefs();
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  if (friend) return <FriendSound friendId={friend} />;
  if (!prefs) return <Screen back title={t('sounds.title')}><Text tone="muted">{t('common.loading')}</Text></Screen>;
  return (
    <Screen back title={t('sounds.title')} subtitle={t('sounds.subtitle')}>
      <Section footer={t('sounds.footer')}>
        <ToggleRow title={t('sounds.enabled')} value={prefs.soundsEnabled} onChange={(v) => update.mutate({ soundsEnabled: v })} />
        <Divider />
        <ToggleRow
          title={t('sounds.allowSender')}
          subtitle={t('sounds.allowSenderSub')}
          value={prefs.allowSenderSounds}
          disabled={!prefs.soundsEnabled}
          onChange={(v) => update.mutate({ allowSenderSounds: v })}
        />
      </Section>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label={t('sounds.incoming')} selected={tab === 'incoming'} onPress={() => setTab('incoming')} />
        <Chip label={t('sounds.outgoing')} selected={tab === 'outgoing'} onPress={() => setTab('outgoing')} />
      </View>
      <Text variant="caption" tone="muted">
        {tab === 'incoming'
          ? t('sounds.incomingHint')
          : t('sounds.outgoingHint')}
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
