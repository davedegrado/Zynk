import { z } from 'zod';
import type { PlanConfig } from '@zynk/shared';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');
const int = (def: number) => z.coerce.number().int().nonnegative().default(def);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: int(4000),
  DATABASE_URL: z.string().min(1),
  /** Public base URL used in invite links, e.g. https://zynk.app */
  PUBLIC_URL: z.url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default(''),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: bool.default(false),

  SESSION_TTL_DAYS: int(60),

  // Anti-abuse (NOT monetization): sensible defaults, all configurable.
  ZYNK_PAIR_COOLDOWN_MS: int(2000),
  ZYNK_PAIR_MAX_PER_MINUTE: int(12),
  ZYNK_SENDER_MAX_PER_MINUTE: int(60),
  ZYNK_SENDER_MAX_PER_HOUR: int(600),
  /** Collapse pushes from the same sender within this window (Zynks still land in Activity). */
  ZYNK_PUSH_COLLAPSE_MS: int(10_000),
  FRIEND_REQUESTS_MAX_PER_HOUR: int(40),
  REPORTS_MAX_PER_DAY: int(20),
  AUTH_MAX_PER_MINUTE: int(10),

  // Data retention.
  ZYNK_RETENTION_DAYS: int(180),
  RETENTION_INTERVAL_MINUTES: int(60),

  // Push (Expo push service → FCM / APNs).
  PUSH_PROVIDER: z.enum(['expo', 'log', 'none']).default('log'),
  EXPO_ACCESS_TOKEN: z.string().optional(),

  // Purchases (RevenueCat). Secret key stays on the server.
  REVENUECAT_SECRET_API_KEY: z.string().optional(),
  REVENUECAT_WEBHOOK_AUTH: z.string().optional(),
  REVENUECAT_ENTITLEMENT_ID: z.string().default('plus'),
  /** JSON array of PlanConfig to override the default plans/prices. */
  PLANS_JSON: z.string().optional(),
  PROMO_MESSAGE: z.string().optional(),

  // Moderation/admin API (disabled when unset).
  ADMIN_API_TOKEN: z.string().min(24).optional(),
});

export type Config = ReturnType<typeof loadConfig>;

export const DEFAULT_PLANS: PlanConfig[] = [
  {
    id: 'plus_monthly',
    productIds: { ios: 'zynk_plus_monthly', android: 'zynk_plus:monthly' },
    period: 'P1M',
    entitlement: 'plus',
    fallbackPrice: { amount: 1.99, currency: 'EUR', display: '€1.99' },
  },
  {
    id: 'plus_annual',
    productIds: { ios: 'zynk_plus_annual', android: 'zynk_plus:annual' },
    period: 'P1Y',
    entitlement: 'plus',
    fallbackPrice: { amount: 14.99, currency: 'EUR', display: '€14.99' },
    badge: 'Best value',
  },
];

const planSchema = z.object({
  id: z.string(),
  productIds: z.object({ ios: z.string(), android: z.string() }),
  period: z.enum(['P1M', 'P1Y']),
  entitlement: z.literal('plus'),
  fallbackPrice: z.object({ amount: z.number(), currency: z.string(), display: z.string() }),
  badge: z.string().optional(),
});

export function loadConfig(env: Record<string, string | undefined> = process.env) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${issues}`);
  }
  const e = parsed.data;
  const plans = e.PLANS_JSON ? z.array(planSchema).parse(JSON.parse(e.PLANS_JSON)) : DEFAULT_PLANS;
  return {
    env: e.NODE_ENV,
    host: e.HOST,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    publicUrl: e.PUBLIC_URL.replace(/\/$/, ''),
    corsOrigins: e.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    logLevel: e.LOG_LEVEL,
    trustProxy: e.TRUST_PROXY,
    sessionTtlMs: e.SESSION_TTL_DAYS * 24 * 3600 * 1000,
    limits: {
      pairCooldownMs: e.ZYNK_PAIR_COOLDOWN_MS,
      pairMaxPerMinute: e.ZYNK_PAIR_MAX_PER_MINUTE,
      senderMaxPerMinute: e.ZYNK_SENDER_MAX_PER_MINUTE,
      senderMaxPerHour: e.ZYNK_SENDER_MAX_PER_HOUR,
      pushCollapseMs: e.ZYNK_PUSH_COLLAPSE_MS,
      friendRequestsPerHour: e.FRIEND_REQUESTS_MAX_PER_HOUR,
      reportsPerDay: e.REPORTS_MAX_PER_DAY,
      authPerMinute: e.AUTH_MAX_PER_MINUTE,
    },
    retention: {
      zynkDays: e.ZYNK_RETENTION_DAYS,
      intervalMinutes: e.RETENTION_INTERVAL_MINUTES,
    },
    push: { provider: e.PUSH_PROVIDER, expoAccessToken: e.EXPO_ACCESS_TOKEN },
    billing: {
      revenuecatSecretKey: e.REVENUECAT_SECRET_API_KEY,
      webhookAuth: e.REVENUECAT_WEBHOOK_AUTH,
      entitlementId: e.REVENUECAT_ENTITLEMENT_ID,
      plans,
      promoMessage: e.PROMO_MESSAGE ?? null,
    },
    adminToken: e.ADMIN_API_TOKEN,
  };
}
