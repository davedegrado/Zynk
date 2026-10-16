import {
  resolveFeatures,
  type EntitlementId,
  type EntitlementsResponse,
  type FeatureId,
  type SubscriptionInfo,
} from '@zynk/shared';
import type { Queryable } from '../../db/pool';

interface GrantRow {
  entitlement: string;
  source: 'store' | 'promo' | 'admin';
  starts_at: Date;
  expires_at: Date | null;
  revoked_at: Date | null;
}

async function loadGrants(db: Queryable, userId: string): Promise<GrantRow[]> {
  const { rows } = await db.query<GrantRow>(
    'select entitlement, source, starts_at, expires_at, revoked_at from entitlement_grants where user_id = $1',
    [userId],
  );
  return rows;
}

const toLike = (g: GrantRow) => ({ entitlement: g.entitlement, startsAt: g.starts_at, expiresAt: g.expires_at, revokedAt: g.revoked_at });

/** Server-side source of truth for "which premium features may this user use right now". */
export async function getFeatures(db: Queryable, userId: string, now: Date): Promise<FeatureId[]> {
  return resolveFeatures((await loadGrants(db, userId)).map(toLike), now);
}

export async function getEntitlements(db: Queryable, userId: string, now: Date): Promise<EntitlementsResponse> {
  const grants = await loadGrants(db, userId);
  const features = resolveFeatures(grants.map(toLike), now);
  const active = grants.filter((g) => resolveFeatures([toLike(g)], now).length > 0);
  const { rows } = await db.query<{
    product_id: string; store: SubscriptionInfo['store']; status: SubscriptionInfo['status'];
    expires_at: Date | null; will_renew: boolean; is_sandbox: boolean; management_url: string | null;
  }>(
    `select product_id, store, status, expires_at, will_renew, is_sandbox, management_url
       from subscriptions where user_id = $1
      order by (status in ('active', 'cancelled', 'in_grace')) desc, expires_at desc nulls last limit 1`,
    [userId],
  );
  const s = rows[0];
  return {
    features,
    entitlements: active.map((g) => ({
      id: g.entitlement as EntitlementId,
      source: g.source,
      expiresAt: g.expires_at?.toISOString() ?? null,
    })),
    subscription: s
      ? {
          productId: s.product_id,
          store: s.store,
          status: s.status,
          expiresAt: s.expires_at?.toISOString() ?? null,
          willRenew: s.will_renew,
          isSandbox: s.is_sandbox,
          managementUrl: s.management_url,
        }
      : null,
  };
}
