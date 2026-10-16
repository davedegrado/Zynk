import type {
  ActivityResponse,
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
import { API_URL } from './config';

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
export const absoluteUrl = (path: string) => `${API_URL}${path}`;

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
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'network', "Can't reach Speow! right now. Check your connection.");
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
  register: (b: { username: string; displayName: string; password: string }) => request<AuthResponse>('POST', '/auth/register', b),
  login: (b: { username: string; password: string }) => request<AuthResponse>('POST', '/auth/login', b),
  logout: () => request<void>('POST', '/auth/logout'),
  changePassword: (b: { currentPassword: string; newPassword: string }) => request<void>('POST', '/me/password', b),
  deleteAccount: (password: string) => request<void>('DELETE', '/me', { password }),

  me: () => request<Me>('GET', '/me'),
  updateMe: (b: { displayName?: string; username?: string }) => request<Me>('PATCH', '/me', b),
  uploadAvatar: (data: Blob, type: string) => request<Me>('PUT', '/me/avatar', undefined, { raw: { data, type } }),
  removeAvatar: () => request<Me>('DELETE', '/me/avatar'),
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

  sendZynk: (b: { recipientId: string; clientNonce: string; reactionId?: string | null; effectId?: string | null }) =>
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

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
