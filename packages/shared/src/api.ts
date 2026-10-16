/**
 * API contract shared by the server (request validation) and the mobile app
 * (typed client). Request bodies are zod schemas; responses are plain types.
 */
import { z } from 'zod';
import type { EntitlementId, FeatureId } from './features';

// ------------------------------------------------------------------ primitives

export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_.]{1,18}[a-z0-9])$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Usernames are at least 3 characters')
  .max(20, 'Usernames are at most 20 characters')
  .regex(USERNAME_RE, 'Use letters, numbers, dots and underscores (no dot/underscore at the ends)')
  .refine((u) => !/[._]{2}/.test(u), 'No consecutive dots or underscores');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Display name is required')
  .max(40, 'Display name is at most 40 characters')
  // No control characters / zero-width tricks.
  .refine((s) => !/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/.test(s), 'Invalid characters');

export const passwordSchema = z
  .string()
  .min(8, 'Passwords are at least 8 characters')
  .max(128, 'Passwords are at most 128 characters');

const catalogId = z.string().regex(/^[a-z0-9_]{1,40}$/);
function catalogIdShort() {
  return z.string().regex(/^[a-z0-9_]{1,32}$/);
}
export const reactionRefSchema = z.string().regex(/^[a-z0-9_]{1,32}:[a-z0-9_]{1,32}$/);

// ------------------------------------------------------------------ auth

/** Avatars are drawn characters + a background color from the catalog (no photo uploads). */
export const avatarSchema = z.object({ id: catalogIdShort(), color: catalogIdShort() });

export const LANGUAGES = ['en', 'it'] as const;
export type Language = (typeof LANGUAGES)[number];
export const languageSchema = z.enum(LANGUAGES);

export const registerSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
  avatar: avatarSchema.optional(),
  language: languageSchema.optional(),
});
export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(128),
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export const deleteAccountSchema = z.object({ password: z.string().min(1).max(128) });
export const updateProfileSchema = z
  .object({ displayName: displayNameSchema.optional(), username: usernameSchema.optional(), avatar: avatarSchema.optional() })
  .refine((v) => v.displayName !== undefined || v.username !== undefined || v.avatar !== undefined, 'Nothing to update');

// ------------------------------------------------------------------ social

export const userIdParam = z.object({ id: z.uuid() });
export const searchQuerySchema = z.object({ q: z.string().trim().toLowerCase().min(1).max(20) });
export const friendRequestCreateSchema = z.union([
  z.object({ userId: z.uuid() }),
  z.object({ inviteCode: z.string().regex(/^[A-Za-z0-9]{6,16}$/) }),
]);

export const REPORT_REASONS = ['spam', 'harassment', 'impersonation', 'inappropriate_profile', 'underage', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const reportCreateSchema = z.object({
  userId: z.uuid(),
  zynkId: z.uuid().optional(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(500).optional(),
  alsoBlock: z.boolean().optional(),
});

// ------------------------------------------------------------------ zynks

export const sendZynkSchema = z.object({
  recipientId: z.uuid(),
  /** Client-generated idempotency key: retries with the same nonce never double-send. */
  clientNonce: z.uuid(),
  reactionId: reactionRefSchema.nullish(),
  /** Optional per-send effect; defaults to the sender's selected effect. */
  effectId: catalogId.nullish(),
  /** Optional per-send Speow color (free); defaults to the sender's default color. */
  bubbleColorId: catalogId.nullish(),
});
export const activityQuerySchema = z.object({
  direction: z.enum(['all', 'received', 'sent']).default('all'),
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export const markSeenSchema = z.object({ ids: z.array(z.uuid()).min(1).max(200) });
export const zynkReactionSchema = z.object({ reactionId: reactionRefSchema.nullable() });

// ------------------------------------------------------------------ preferences

export const preferencesPatchSchema = z
  .object({
    pushEnabled: z.boolean(),
    zynkPush: z.boolean(),
    friendRequestPush: z.boolean(),
    haptics: z.boolean(),
    soundsEnabled: z.boolean(),
    allowSenderSounds: z.boolean(),
    showSenderStyle: z.boolean(),
    reduceMotion: z.boolean(),
    appearance: z.enum(['theme', 'system']),
    language: languageSchema,
    incomingSoundId: catalogId,
    outgoingSoundId: catalogId,
    themeId: catalogId,
    accentId: catalogId,
    bubbleColorId: catalogId,
    effectId: catalogId,
  })
  .partial()
  .strict();
export type PreferencesPatch = z.infer<typeof preferencesPatchSchema>;
export const friendSoundSchema = z.object({ soundId: catalogId.nullable() });

// ------------------------------------------------------------------ devices & billing

export const registerDeviceSchema = z.object({
  token: z.string().min(10).max(512),
  platform: z.enum(['ios', 'android']),
  provider: z.enum(['expo']).default('expo'),
});

// ------------------------------------------------------------------ responses

export interface Avatar {
  /** Character id from AVATARS. */
  id: string;
  /** Background color id from AVATAR_COLORS. */
  color: string;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatar: Avatar;
}

export interface Me extends PublicUser {
  createdAt: string;
  inviteCode: string;
}

export interface AuthResponse {
  token: string;
  user: Me;
}

export type Relationship = 'self' | 'friend' | 'request_sent' | 'request_received' | 'none' | 'blocked';

export interface UserProfile extends PublicUser {
  relationship: Relationship;
  friendSince: string | null;
  muted: boolean;
  /** Recipient-side sound assigned to this friend (only for you). */
  friendSoundId: string | null;
  pendingRequestId: string | null;
}

export interface FriendSummary extends PublicUser {
  friendSince: string;
  muted: boolean;
  friendSoundId: string | null;
  lastZynkAt: string | null;
  unseenFromThem: number;
}

export interface FriendRequestItem {
  id: string;
  user: PublicUser;
  createdAt: string;
}

export interface FriendRequestsResponse {
  incoming: FriendRequestItem[];
  outgoing: FriendRequestItem[];
}

export interface ZynkEvent {
  id: string;
  direction: 'sent' | 'received';
  counterpart: PublicUser;
  createdAt: string;
  seenAt: string | null;
  soundId: string | null;
  effectId: string;
  bubbleColorId: string;
  reactionId: string | null;
  reactionFallback: string | null;
  /** Reaction the recipient attached in response. */
  responseReactionId: string | null;
  responseReactionFallback: string | null;
}

export interface SendZynkResponse {
  zynk: ZynkEvent;
  /** True if this was a retried request that matched an existing Speow. */
  duplicate: boolean;
}

export interface ActivityResponse {
  items: ZynkEvent[];
  nextBefore: string | null;
  unseenCount: number;
}

export interface Preferences {
  pushEnabled: boolean;
  zynkPush: boolean;
  friendRequestPush: boolean;
  haptics: boolean;
  soundsEnabled: boolean;
  allowSenderSounds: boolean;
  showSenderStyle: boolean;
  reduceMotion: boolean;
  appearance: 'theme' | 'system';
  /** UI + notification language. */
  language: Language;
  incomingSoundId: string;
  outgoingSoundId: string;
  themeId: string;
  accentId: string;
  bubbleColorId: string;
  effectId: string;
}

export interface PreferencesResponse {
  /** What the user selected (kept even if a subscription lapses). */
  selected: Preferences;
  /** What is actually in effect given current entitlements. */
  effective: Preferences;
}

export type SubscriptionStatus =
  | 'active'
  | 'cancelled' // will not renew, still active until expiry
  | 'in_grace' // billing issue, still active during store grace period
  | 'billing_issue'
  | 'expired'
  | 'refunded'
  | 'paused';

export interface SubscriptionInfo {
  productId: string;
  store: 'app_store' | 'play_store' | 'stripe' | 'promotional' | 'unknown';
  status: SubscriptionStatus;
  expiresAt: string | null;
  willRenew: boolean;
  isSandbox: boolean;
  managementUrl: string | null;
}

export interface EntitlementsResponse {
  features: FeatureId[];
  entitlements: { id: EntitlementId; source: 'store' | 'promo' | 'admin'; expiresAt: string | null }[];
  subscription: SubscriptionInfo | null;
}

export interface PlanConfig {
  id: string;
  /** Store product identifiers (may differ per platform). */
  productIds: { ios: string; android: string };
  period: 'P1M' | 'P1Y';
  entitlement: EntitlementId;
  /** Shown only when the store's localized price is unavailable. */
  fallbackPrice: { amount: number; currency: string; display: string };
  badge?: string;
}

export interface PlansResponse {
  purchasesEnabled: boolean;
  plans: PlanConfig[];
  promoMessage: string | null;
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Milliseconds until a rate-limited action may be retried. */
    retryAfterMs?: number;
    feature?: FeatureId;
    fields?: Record<string, string>;
  };
}

export type ApiErrorCode =
  | 'bad_request'
  | 'validation_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'username_taken'
  | 'invalid_credentials'
  | 'account_suspended'
  | 'not_friends'
  | 'blocked'
  | 'rate_limited'
  | 'cooldown'
  | 'feature_locked'
  | 'unknown_item'
  | 'purchases_unavailable'
  | 'payload_too_large'
  | 'internal';

/** Data payload carried by push notifications (also used for deep links). */
export type PushData =
  | { type: 'zynk'; zynkId: string; senderId: string; url: string }
  | { type: 'friend_request'; requestId: string; fromUserId: string; url: string }
  | { type: 'friend_accepted'; userId: string; url: string };
