import { useMutation } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { Avatar, Button, EmptyState, Loading, Screen, Text, useToast } from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { useBlocks } from '../../../lib/hooks';
import { keys, queryClient } from '../../../lib/query';
import { radius, space } from '../../../theme/tokens';
import { useAppTheme } from '../../../theme/ThemeProvider';

export default function BlockedUsers() {
  const t = useAppTheme();
  const toast = useToast();
  const blocks = useBlocks();
  const unblock = useMutation({
    mutationFn: api.unblock,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.blocks });
      toast('Unblocked');
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <Screen back title="Blocked users" subtitle="Blocked people can't find you, add you or send you a Speow. They aren't notified.">
      {blocks.isLoading ? (
        <Loading />
      ) : !blocks.data?.length ? (
        <EmptyState title="No one blocked" body="You can block anyone from their profile." />
      ) : (
        blocks.data.map((u) => (
          <View key={u.id} style={[styles.row, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
            <Avatar user={u} size={40} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{u.displayName}</Text>
              <Text variant="caption" tone="muted">@{u.username}</Text>
            </View>
            <Button title="Unblock" size="sm" variant="secondary" onPress={() => unblock.mutate(u.id)} />
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
});
