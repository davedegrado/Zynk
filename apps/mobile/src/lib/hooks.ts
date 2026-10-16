import { useQuery } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { useEffect, useState } from 'react';
import { hasFeature, type FeatureId, type Preferences } from '@zynk/shared';
import { api } from './api';
import { keys } from './query';
import { useSession } from './session';

export function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

const useSignedIn = () => useSession().status === 'signedIn';

export const useFriends = () => useQuery({ queryKey: keys.friends, queryFn: api.friends, enabled: useSignedIn(), select: (d) => d.friends });
export const useFriendRequests = () => {
  const active = useAppActive();
  return useQuery({ queryKey: keys.requests, queryFn: api.friendRequests, enabled: useSignedIn(), refetchInterval: active ? 30_000 : false });
};
export const useUser = (id: string) => useQuery({ queryKey: keys.user(id), queryFn: () => api.user(id), enabled: useSignedIn() && !!id });
export const useBlocks = () => useQuery({ queryKey: keys.blocks, queryFn: api.blocks, enabled: useSignedIn(), select: (d) => d.users });
export const useInvite = () => useQuery({ queryKey: keys.invite, queryFn: api.invite, enabled: useSignedIn(), staleTime: Infinity });
export const usePlans = () => useQuery({ queryKey: keys.plans, queryFn: api.plans, enabled: useSignedIn(), staleTime: 10 * 60_000 });

/** Activity polls while the app is in the foreground, so Zynks arrive even with push disabled. */
export function useActivity(direction: 'all' | 'received' | 'sent' = 'all') {
  const active = useAppActive();
  return useQuery({
    queryKey: keys.activity(direction),
    queryFn: () => api.activity({ direction, limit: 50 }),
    enabled: useSignedIn(),
    refetchInterval: active ? 8_000 : false,
  });
}

export const usePreferences = () =>
  useQuery({ queryKey: keys.prefs, queryFn: api.preferences, enabled: useSignedIn(), staleTime: 60_000 });

/** The effective (entitlement-checked) preferences as computed by the server. */
export function useEffectivePrefs(): Preferences | null {
  return usePreferences().data?.effective ?? null;
}

// ------------------------------------------------------------- entitlements

/**
 * The single client-side source of truth for premium access. It only mirrors
 * what the server verified (GET /me/entitlements); the server re-checks every
 * premium operation regardless.
 */
export function useEntitlements() {
  return useQuery({ queryKey: keys.entitlements, queryFn: api.entitlements, enabled: useSignedIn(), staleTime: 5 * 60_000 });
}

export function useFeatures(): readonly FeatureId[] {
  return useEntitlements().data?.features ?? [];
}

export function useHasFeature(feature: FeatureId | null | undefined): boolean {
  return hasFeature(useFeatures(), feature);
}

export function useIsPlus(): boolean {
  return (useEntitlements().data?.entitlements ?? []).some((e) => e.id === 'plus');
}
