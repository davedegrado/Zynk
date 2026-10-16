import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { UserProfile } from '@zynk/shared';
import { useI18n } from '../i18n';
import { api, errorMessage } from '../lib/api';
import { keys, queryClient } from '../lib/query';
import { Button, useToast } from './ui';

export const refreshSocial = () => {
  void queryClient.invalidateQueries({ queryKey: keys.requests });
  void queryClient.invalidateQueries({ queryKey: keys.friends });
  void queryClient.invalidateQueries({ queryKey: ['search'] });
};


export function RelationshipAction({ profile }: { profile: UserProfile }) {
  const toast = useToast();
  const { t } = useI18n();
  const add = useMutation({
    mutationFn: () => api.sendFriendRequest({ userId: profile.id }),
    onSuccess: (p) => {
      queryClient.setQueryData(keys.user(p.id), p);
      toast(p.relationship === 'friend' ? t('requests.nowFriends', { name: p.displayName }) : t('requests.sent'), 'success');
      refreshSocial();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const accept = useMutation({
    mutationFn: () => api.acceptRequest(profile.pendingRequestId!),
    onSuccess: (p) => {
      queryClient.setQueryData(keys.user(p.id), p);
      toast(t('requests.nowFriends', { name: p.displayName }), 'success');
      refreshSocial();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  switch (profile.relationship) {
    case 'friend':
      return <Button title={t('requests.speow')} icon="bolt" size="sm" onPress={() => router.push(`/user/${profile.id}`)} />;
    case 'request_sent':
      return <Button title={t('requests.requested')} size="sm" variant="secondary" disabled />;
    case 'request_received':
      return <Button title={t('requests.accept')} size="sm" onPress={() => accept.mutate()} loading={accept.isPending} />;
    case 'none':
      return <Button title={t('requests.add')} size="sm" icon="add" onPress={() => add.mutate()} loading={add.isPending} />;
    default:
      return null;
  }
}

