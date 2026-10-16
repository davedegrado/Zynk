import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { REPORT_REASONS, type ReportReason } from '@zynk/shared';
import { Button, Chip, Input, Screen, Text, ToggleRow, Section, useToast } from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { useUser } from '../../../lib/hooks';
import { keys, queryClient } from '../../../lib/query';
import { space } from '../../../theme/tokens';

const LABELS: Record<ReportReason, string> = {
  spam: 'Spam or flooding',
  harassment: 'Harassment or bullying',
  impersonation: 'Pretending to be someone',
  inappropriate_profile: 'Inappropriate name or photo',
  underage: 'May be under age',
  other: 'Something else',
};

export default function ReportScreen() {
  const { id, zynk } = useLocalSearchParams<{ id: string; zynk?: string }>();
  const user = useUser(id);
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const submit = useMutation({
    mutationFn: () => api.report({ userId: id, zynkId: zynk, reason: reason!, details: details.trim() || undefined, alsoBlock }),
    onSuccess: () => {
      toast('Thanks — our team will review this.', 'success');
      void queryClient.invalidateQueries({ queryKey: keys.user(id) });
      void queryClient.invalidateQueries({ queryKey: keys.friends });
      router.back();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <Screen back title={`Report ${user.data?.displayName ?? 'user'}`} subtitle="Reports are confidential. The person is not told who reported them.">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {REPORT_REASONS.map((r) => (
          <Chip key={r} label={LABELS[r]} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      <Input label="Anything else? (optional)" value={details} onChangeText={setDetails} multiline maxLength={500} style={{ minHeight: 90, textAlignVertical: 'top' }} />
      <Section>
        <ToggleRow title="Also block them" subtitle="They won't be able to find or Zynk you." value={alsoBlock} onChange={setAlsoBlock} />
      </Section>
      <Button title="Send report" variant="danger" onPress={() => submit.mutate()} disabled={!reason} loading={submit.isPending} />
      <Text variant="caption" tone="muted" center>If someone is in immediate danger, contact local emergency services.</Text>
    </Screen>
  );
}
