import { useMutation, useQuery } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Avatar, Button, ErrorState, Loading, Screen, Text, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { pendingInvite } from '../../lib/pending-invite';
import { keys, queryClient } from '../../lib/query';
import { useSession } from '../../lib/session';
import { space } from '../../theme/tokens';

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { status } = useSession();
  const toast = useToast();
  const invite = useQuery({ queryKey: ['invite', code], queryFn: () => api.resolveInvite(code), enabled: status === 'signedIn' && !!code });
  const add = useMutation({
    mutationFn: () => api.sendFriendRequest({ inviteCode: code }),
    onSuccess: (p) => {
      void queryClient.invalidateQueries({ queryKey: keys.friends });
      void queryClient.invalidateQueries({ queryKey: keys.requests });
      toast(p.relationship === 'friend' ? `You and ${p.displayName} are friends!` : 'Friend request sent', 'success');
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
    <Screen back title="You're invited">
      {invite.isLoading ? (
        <Loading />
      ) : invite.error || !invite.data ? (
        <ErrorState message={invite.error ? errorMessage(invite.error) : 'Invite not found'} />
      ) : (
        <View style={{ alignItems: 'center', gap: space.md }}>
          <Avatar user={invite.data} size={104} />
          <Text variant="title" center>{invite.data.displayName}</Text>
          <Text tone="muted">@{invite.data.username} wants to be friends on ZYNK</Text>
          {invite.data.relationship === 'self' ? (
            <Text tone="muted">This is your own invite link.</Text>
          ) : invite.data.relationship === 'friend' ? (
            <Button title="You're already friends — Zynk them" icon="bolt" onPress={() => router.replace(`/user/${invite.data!.id}`)} />
          ) : (
            <Button title="Add friend" icon="add" onPress={() => add.mutate()} loading={add.isPending} />
          )}
        </View>
      )}
    </Screen>
  );
}
