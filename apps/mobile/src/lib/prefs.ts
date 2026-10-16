import { useMutation } from '@tanstack/react-query';
import type { PreferencesPatch, PreferencesResponse } from '@zynk/shared';
import { useToast } from '../components/ui';
import { translate } from '../i18n';
import { api, ApiError, errorMessage } from './api';
import { keys, queryClient } from './query';

/** Optimistically updates preferences; the server validates entitlements and returns the truth. */
export function useUpdatePrefs() {
  const toast = useToast();
  return useMutation({
    mutationFn: (patch: PreferencesPatch) => api.updatePreferences(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: keys.prefs });
      const prev = queryClient.getQueryData<PreferencesResponse>(keys.prefs);
      if (prev) queryClient.setQueryData(keys.prefs, { ...prev, selected: { ...prev.selected, ...patch } });
      return { prev };
    },
    onError: (err, _patch, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(keys.prefs, ctx.prev);
      toast(err instanceof ApiError && err.code === 'feature_locked' ? translate('error.featureLocked') : errorMessage(err), 'error');
    },
    onSuccess: (res) => queryClient.setQueryData(keys.prefs, res),
  });
}
