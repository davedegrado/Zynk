import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { REPORT_REASONS, type ReportReason } from '@zynk/shared';
import { Button, Chip, Input, Screen, Text, ToggleRow, Section, useToast } from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { api, errorMessage } from '../../../lib/api';
import { useUser } from '../../../lib/hooks';
import { keys, queryClient } from '../../../lib/query';
import { space } from '../../../theme/tokens';

export default function ReportScreen() {
  const { id, zynk } = useLocalSearchParams<{ id: string; zynk?: string }>();
  const user = useUser(id);
  const { t, td } = useI18n();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const submit = useMutation({
    mutationFn: () => api.report({ userId: id, zynkId: zynk, reason: reason!, details: details.trim() || undefined, alsoBlock }),
    onSuccess: () => {
      toast(t('report.thanks'), 'success');
      void queryClient.invalidateQueries({ queryKey: keys.user(id) });
      void queryClient.invalidateQueries({ queryKey: keys.friends });
      router.back();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <Screen back title={t('report.title', { name: user.data?.displayName ?? '' })} subtitle={t('report.subtitle')}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {REPORT_REASONS.map((r) => (
          <Chip key={r} label={td(`report.reason.${r}`, r)} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      <Input label={t('report.details')} value={details} onChangeText={setDetails} multiline maxLength={500} style={{ minHeight: 90, textAlignVertical: 'top' }} />
      <Section>
        <ToggleRow title={t('report.alsoBlock')} subtitle={t('report.alsoBlockSub')} value={alsoBlock} onChange={setAlsoBlock} />
      </Section>
      <Button title={t('report.send')} variant="danger" onPress={() => submit.mutate()} disabled={!reason} loading={submit.isPending} />
      <Text variant="caption" tone="muted" center>{t('report.danger')}</Text>
    </Screen>
  );
}
