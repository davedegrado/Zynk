import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Divider, PlusBadge, Row, Screen, Section, Text, useConfirm } from '../../../components/ui';
import { LANGUAGE_NAMES, useI18n } from '../../../i18n';
import { formatDate } from '../../../lib/format';
import { useEntitlements, useIsPlus } from '../../../lib/hooks';
import { useSession } from '../../../lib/session';
import { space } from '../../../theme/tokens';
import { useAppTheme } from '../../../theme/ThemeProvider';

function PlusCard() {
  const theme = useAppTheme();
  const { t } = useI18n();
  const isPlus = useIsPlus();
  const sub = useEntitlements().data?.subscription;
  if (isPlus) {
    return (
      <Card onPress={() => router.push('/plus')} style={{ gap: space.xs, borderColor: theme.colors.accent, borderWidth: 2 }}>
        <View style={styles.rowCenter}>
          <Text variant="heading">Speow Plus</Text>
          <PlusBadge />
        </View>
        <Text tone="muted">
          {sub?.status === 'cancelled' && sub.expiresAt
            ? t('profile.plusEnds', { date: formatDate(sub.expiresAt) })
            : sub?.status === 'in_grace'
              ? t('profile.plusBilling')
              : t('profile.plusThanks')}
        </Text>
      </Card>
    );
  }
  return (
    <Card onPress={() => router.push('/plus')} style={{ gap: space.sm, backgroundColor: theme.colors.accent, borderColor: theme.colors.accent }}>
      <Text variant="heading" style={{ color: theme.colors.onAccent }}>{t('profile.plusTitle')}</Text>
      <Text style={{ color: theme.colors.onAccent }}>{t('profile.plusBody')}</Text>
    </Card>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useSession();
  const { t, lang, choice } = useI18n();
  const confirm = useConfirm();
  if (!user) return null;
  return (
    <Screen edges={['top']} title={t('tabs.profile')}>
      <View style={styles.me}>
        <Avatar user={user} size={84} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading" numberOfLines={1}>{user.displayName}</Text>
          <Text tone="muted">@{user.username}</Text>
          <Button title={t('profile.edit')} size="sm" variant="secondary" onPress={() => router.push('/settings/account')} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />
        </View>
      </View>

      <PlusCard />

      <Section title={t('profile.personalize')}>
        <Row icon="sound" title={t('profile.sounds')} subtitle={t('profile.soundsSub')} chevron onPress={() => router.push('/settings/sounds')} />
        <Divider />
        <Row icon="palette" title={t('profile.look')} subtitle={t('profile.lookSub')} chevron onPress={() => router.push('/settings/appearance')} />
      </Section>

      <Section title={t('profile.settings')}>
        <Row
          icon="link"
          title={t('language.title')}
          subtitle={choice === 'system' ? t('language.systemValue', { lang: LANGUAGE_NAMES[lang] }) : LANGUAGE_NAMES[lang]}
          chevron
          onPress={() => router.push('/settings/language')}
        />
        <Divider />
        <Row icon="bolt" title={t('profile.notifications')} chevron onPress={() => router.push('/settings/notifications')} />
        <Divider />
        <Row icon="shield" title={t('profile.blocked')} chevron onPress={() => router.push('/settings/blocked')} />
        <Divider />
        <Row icon="profile" title={t('profile.account')} subtitle={t('profile.accountSub')} chevron onPress={() => router.push('/settings/account')} />
      </Section>

      <Button
        title={t('profile.logout')}
        variant="ghost"
        onPress={async () => {
          if (await confirm({ title: t('profile.logoutTitle'), body: t('profile.logoutBody'), confirm: t('profile.logout'), cancel: t('common.cancel') })) await signOut();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
