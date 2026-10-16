import { useMutation } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback, useRef, useState } from 'react';
import type { SendZynkResponse } from '@zynk/shared';
import { api, ApiError } from '../../lib/api';
import { haptic } from '../../lib/haptics';
import { useEffectivePrefs } from '../../lib/hooks';
import { keys, queryClient } from '../../lib/query';
import { playSound } from '../../lib/sounds';
import { useToast } from '../ui';

/**
 * Sends a Zynk with double-tap protection:
 *  - a ref lock ignores taps while a request is in flight,
 *  - every logical send has one idempotency nonce, reused on network retries,
 *  - the server additionally enforces cooldowns and dedupes by nonce.
 */
export function useSendZynk(recipientId: string, opts: { onSent?: (r: SendZynkResponse) => void } = {}) {
  const toast = useToast();
  const prefs = useEffectivePrefs();
  const inFlight = useRef(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const mutation = useMutation({
    mutationFn: async (v: { reactionId: string | null; effectId?: string | null }) => {
      const clientNonce = randomUUID();
      const body = { recipientId, clientNonce, reactionId: v.reactionId, effectId: v.effectId ?? null };
      try {
        return await api.sendZynk(body);
      } catch (err) {
        // One automatic retry on network failure — safe thanks to the nonce.
        if (err instanceof ApiError && err.code === 'network') return api.sendZynk(body);
        throw err;
      }
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: keys.activityAll });
      void queryClient.invalidateQueries({ queryKey: keys.friends });
      opts.onSent?.(res);
    },
    onError: (err) => {
      void haptic.warn();
      if (err instanceof ApiError && (err.code === 'cooldown' || err.code === 'rate_limited')) {
        setCooldownUntil(Date.now() + (err.retryAfterMs ?? 2000));
        toast(err.message, 'info');
      } else {
        toast(err instanceof ApiError ? err.message : 'Zynk failed to send', 'error');
      }
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  const send = useCallback(
    (reactionId: string | null = null, effectId?: string | null) => {
      if (inFlight.current || Date.now() < cooldownUntil) return false;
      inFlight.current = true;
      // Instant, optimistic feel for the sender; the server remains the source of truth.
      if (prefs?.haptics !== false) void haptic.zynk();
      if (prefs?.soundsEnabled !== false) void playSound(prefs?.outgoingSoundId ?? 'zynk_classic', 0.6);
      mutation.mutate({ reactionId, effectId });
      return true;
    },
    [cooldownUntil, mutation, prefs],
  );

  return { send, sending: mutation.isPending, cooldownUntil };
}
