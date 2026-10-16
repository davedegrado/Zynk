import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Divider, PlusBadge, Row, Screen, Section, Text, useConfirm } from '../../../components/ui';
import { useEntitlements, useIsPlus } from '../../../lib/hooks';
import { useSession } from '../../../lib/session';
import { space } from '../../../theme/tokens';
import { useAppTheme } from '../../../theme/ThemeProvider';

function PlusCard() {
  const t = useAppTheme();
  const isPlus = useIsPlus();
  const sub = useEntitlements().data?.subscription;
  if (isPlus) {
    return (
      <Card onPress={() => router.push('/plus')} style={{ gap: space.xs, borderColor: t.colors.accent, borderWidth: 2 }}>
        <View style={styles.rowCenter}>
          <Text variant="heading">Speow Plus</Text>
          <PlusBadge />
        </View>
        <Text tone="muted">
          {sub?.status === 'cancelled' && sub.expiresAt
            ? `Ends ${new Date(sub.expiresAt).toLocaleDateString()}. Renew anytime.`
            : sub?.status === 'in_grace'
              ? 'There was a billing problem — update your payment method in the store to keep Plus.'
              : 'Thanks for supporting Speow! Manage your plan here.'}
        </Text>
      </Card>
    );
  }
  return (
    <Card onPress={() => router.push('/plus')} style={{ gap: space.sm, backgroundColor: t.colors.accent, borderColor: t.colors.accent }}>
      <Text variant="heading" style={{ color: t.colors.onAccent }}>Make it yours with Plus</Text>
      <Text style={{ color: t.colors.onAccent }}>Exclusive sounds, reaction packs, colors and effects. Sending Speows stays free, forever.</Text>
    </Card>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useSession();
  const confirm = useConfirm();
  if (!user) return null;
  return (
    <Screen edges={['top']} title="Profile">
      <View style={styles.me}>
        <Avatar user={user} size={84} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading" numberOfLines={1}>{user.displayName}</Text>
          <Text tone="muted">@{user.username}</Text>
          <Button title="Edit profile" size="sm" variant="secondary" onPress={() => router.push('/settings/account')} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />
        </View>
      </View>

      <PlusCard />

      <Section title="Personalize">
        <Row icon="sound" title="Sounds" subtitle="Incoming, outgoing and per-friend sounds" chevron onPress={() => router.push('/settings/sounds')} />
        <Divider />
        <Row icon="palette" title="Look & Effects" subtitle="Theme, colors, bubble and Speow effects" chevron onPress={() => router.push('/settings/appearance')} />
      </Section>

      <Section title="Settings">
        <Row icon="bolt" title="Notifications" chevron onPress={() => router.push('/settings/notifications')} />
        <Divider />
        <Row icon="shield" title="Blocked users" chevron onPress={() => router.push('/settings/blocked')} />
        <Divider />
        <Row icon="profile" title="Account" subtitle="Username, password, delete account" chevron onPress={() => router.push('/settings/account')} />
      </Section>

      <Button
        title="Log out"
        variant="ghost"
        onPress={async () => {
          if (await confirm({ title: 'Log out?', body: 'You will stop receiving Speow notifications on this device.', confirm: 'Log out' })) await signOut();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
