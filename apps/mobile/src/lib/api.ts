import type {
  ActivityResponse,
  Avatar,
  Language,
  ApiErrorBody,
  ApiErrorCode,
  AuthResponse,
  EntitlementsResponse,
  FeatureId,
  FriendRequestsResponse,
  FriendSummary,
  Me,
  PlansResponse,
  PreferencesPatch,
  PreferencesResponse,
  PublicUser,
  ReportReason,
  SendZynkResponse,
  UserProfile,
  ZynkEvent,
} from '@zynk/shared';
import { translate, type MessageKey } from '../i18n';
import { getApiUrl } from './config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'network',
    message: string,
    readonly retryAfterMs?: number,
    readonly feature?: FeatureId,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setApiToken = (t: string | null) => {
  token = t;
};
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};
export const authHeaders = (): Record<string, string> => (token ? { authorization: `Bearer ${token}` } : {});
export const absoluteUrl = (path: string) => `${getApiUrl()}${path}`;

async function request<T>(method: string, path: string, body?: unknown, opts: { raw?: { data: Blob | ArrayBuffer; type: string } } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json', ...authHeaders() };
  let payload: BodyInit | undefined;
  if (opts.raw) {
    headers['content-type'] = opts.raw.type;
    payload = opts.raw.data as BodyInit;
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const base = getApiUrl();
  if (!base) throw new ApiError(0, 'network', translate('error.noServer'));
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'network', translate('error.network'));
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    const e = json?.error;
    if (res.status === 401 && token && path !== '/auth/login') onUnauthorized?.();
    throw new ApiError(res.status, e?.code ?? 'internal', e?.message ?? 'Something went wrong', e?.retryAfterMs, e?.feature, e?.fields);
  }
  return json as T;
}

const q = (params: Record<string, string | number | undefined>) => {
  const s = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return s ? `?${s}` : '';
};

export const api = {
  register: (b: { username: string; displayName: string; password: string; avatar?: Avatar; language?: Language }) => request<AuthResponse>('POST', '/auth/register', b),
  login: (b: { username: string; password: string }) => request<AuthResponse>('POST', '/auth/login', b),
  logout: () => request<void>('POST', '/auth/logout'),
  changePassword: (b: { currentPassword: string; newPassword: string }) => request<void>('POST', '/me/password', b),
  deleteAccount: (password: string) => request<void>('DELETE', '/me', { password }),

  me: () => request<Me>('GET', '/me'),
  updateMe: (b: { displayName?: string; username?: string; avatar?: Avatar }) => request<Me>('PATCH', '/me', b),
  invite: () => request<{ code: string; url: string }>('GET', '/me/invite'),
  rotateInvite: () => request<{ code: string; url: string }>('POST', '/me/invite/rotate'),
  resolveInvite: (code: string) => request<UserProfile>('GET', `/invites/${encodeURIComponent(code)}`),

  search: (term: string) => request<{ users: UserProfile[] }>('GET', `/users/search${q({ q: term })}`),
  user: (id: string) => request<UserProfile>('GET', `/users/${id}`),

  friends: () => request<{ friends: FriendSummary[] }>('GET', '/friends'),
  removeFriend: (id: string) => request<void>('DELETE', `/friends/${id}`),
  friendRequests: () => request<FriendRequestsResponse>('GET', '/friend-requests'),
  sendFriendRequest: (b: { userId: string } | { inviteCode: string }) => request<UserProfile>('POST', '/friend-requests', b),
  acceptRequest: (id: string) => request<UserProfile>('POST', `/friend-requests/${id}/accept`),
  rejectRequest: (id: string) => request<void>('POST', `/friend-requests/${id}/reject`),
  cancelRequest: (id: string) => request<void>('DELETE', `/friend-requests/${id}`),

  blocks: () => request<{ users: (PublicUser & { blockedAt: string })[] }>('GET', '/blocks'),
  block: (userId: string) => request<void>('POST', '/blocks', { userId }),
  unblock: (userId: string) => request<void>('DELETE', `/blocks/${userId}`),
  mute: (userId: string) => request<void>('PUT', `/mutes/${userId}`),
  unmute: (userId: string) => request<void>('DELETE', `/mutes/${userId}`),
  report: (b: { userId: string; zynkId?: string; reason: ReportReason; details?: string; alsoBlock?: boolean }) =>
    request<{ ok: true }>('POST', '/reports', b),

  sendZynk: (b: { recipientId: string; clientNonce: string; reactionId?: string | null; effectId?: string | null; bubbleColorId?: string | null }) =>
    request<SendZynkResponse>('POST', '/zynks', b),
  activity: (p: { direction?: 'all' | 'received' | 'sent'; before?: string; limit?: number } = {}) =>
    request<ActivityResponse>('GET', `/activity${q(p)}`),
  zynk: (id: string) => request<ZynkEvent>('GET', `/zynks/${id}`),
  markSeen: (ids: string[]) => request<{ updated: number }>('POST', '/activity/seen', { ids }),
  markAllSeen: () => request<{ updated: number }>('POST', '/activity/seen-all'),
  reactToZynk: (id: string, reactionId: string | null) => request<ZynkEvent>('PUT', `/zynks/${id}/reaction`, { reactionId }),

  preferences: () => request<PreferencesResponse>('GET', '/me/preferences'),
  updatePreferences: (patch: PreferencesPatch) => request<PreferencesResponse>('PATCH', '/me/preferences', patch),
  setFriendSound: (friendId: string, soundId: string | null) => request<void>('PUT', `/friends/${friendId}/sound`, { soundId }),
  entitlements: () => request<EntitlementsResponse>('GET', '/me/entitlements'),

  registerDevice: (b: { token: string; platform: 'ios' | 'android' }) => request<void>('POST', '/devices', b),
  unregisterDevice: (t: string) => request<void>('DELETE', '/devices', { token: t }),

  plans: () => request<PlansResponse>('GET', '/billing/plans'),
  syncPurchases: () => request<EntitlementsResponse>('POST', '/billing/sync'),
};

const ERROR_KEYS: Partial<Record<ApiErrorCode | 'network', MessageKey>> = {
  network: 'error.network',
  invalid_credentials: 'error.invalidCredentials',
  username_taken: 'error.usernameTaken',
  account_suspended: 'error.suspended',
  unauthorized: 'error.unauthorized',
  not_friends: 'error.notFriends',
  cooldown: 'error.cooldown',
  rate_limited: 'error.rateLimited',
  feature_locked: 'error.featureLocked',
  unknown_item: 'error.unknownItem',
  not_found: 'error.notFound',
  purchases_unavailable: 'error.purchasesUnavailable',
  payload_too_large: 'error.tooLarge',
  internal: 'error.internal',
};

/** User-facing, localized message for any error. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'network' && !getApiUrl()) return translate('error.noServer');
    const key = ERROR_KEYS[err.code];
    return key ? translate(key) : err.message;
  }
  if (err instanceof Error) return err.message;
  return translate('error.internal');
}

/** Localized message for a field error returned by the server. */
export function fieldMessage(err: ApiError, field: string): string {
  if (err.code === 'username_taken') return translate('error.usernameTaken');
  if (field === 'password' && err.code === 'invalid_credentials') return translate('error.wrongPassword');
  if (field === 'currentPassword') return translate('error.wrongPassword');
  return translate('error.invalidField');
}
