import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
    mutations: { retry: false },
  },
});

export const keys = {
  me: ['me'] as const,
  friends: ['friends'] as const,
  requests: ['friend-requests'] as const,
  activity: (dir: string) => ['activity', dir] as const,
  activityAll: ['activity'] as const,
  user: (id: string) => ['user', id] as const,
  search: (q: string) => ['search', q] as const,
  prefs: ['preferences'] as const,
  entitlements: ['entitlements'] as const,
  plans: ['plans'] as const,
  blocks: ['blocks'] as const,
  invite: ['invite'] as const,
};
