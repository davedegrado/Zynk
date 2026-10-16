import { useMutation, useQuery } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Avatar, Button, ErrorState, Loading, Screen, Text, useToast } from '../../components/ui';
import { useI18n } from '../../i18n';
import { api, errorMessage } from '../../lib/api';
import { pendingInvite } from '../../lib/pending-invite';
import { keys, queryClient } from '../../lib/query';
import { useSession } from '../../lib/session';
import { space } from '../../theme/tokens';

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { status } = useSession();
  const { t } = useI18n();
  const toast = useToast();
  const invite = useQuery({ queryKey: ['invite', code], queryFn: () => api.resolveInvite(code), enabled: status === 'signedIn' && !!code });
  const add = useMutation({
    mutationFn: () => api.sendFriendRequest({ inviteCode: code }),
    onSuccess: (p) => {
      void queryClient.invalidateQueries({ queryKey: keys.friends });
      void queryClient.invalidateQueries({ queryKey: keys.requests });
      toast(p.relationship === 'friend' ? t('requests.nowFriends', { name: p.displayName }) : t('requests.sent'), 'success');
      router.replace(`/user/${p.id}`);
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  if (status === 'loading') return <Loading />;
  if (status === 'signedOut') {
    pendingInvite.set(code);
    return <Redirect href="/welcome" />;
  }
  return (
    <Screen back title={t('inviteScreen.title')}>
      {invite.isLoading ? (
        <Loading />
      ) : invite.error || !invite.data ? (
        <ErrorState message={invite.error ? errorMessage(invite.error) : t('inviteScreen.notFound')} />
      ) : (
        <View style={{ alignItems: 'center', gap: space.md }}>
          <Avatar user={invite.data} size={104} />
          <Text variant="title" center>{invite.data.displayName}</Text>
          <Text tone="muted">{t('inviteScreen.wants', { username: invite.data.username })}</Text>
          {invite.data.relationship === 'self' ? (
            <Text tone="muted">{t('inviteScreen.self')}</Text>
          ) : invite.data.relationship === 'friend' ? (
            <Button title={t('inviteScreen.already')} icon="bolt" onPress={() => router.replace(`/user/${invite.data!.id}`)} />
          ) : (
            <Button title={t('requests.add')} icon="add" onPress={() => add.mutate()} loading={add.isPending} />
          )}
        </View>
      )}
    </Screen>
  );
}
