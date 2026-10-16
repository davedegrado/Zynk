import type { AppContext } from '../../context';
import { withTransaction } from '../../db/pool';
import { ApiError } from '../../lib/errors';
import type { CustomerSnapshot } from './provider';

const STORE_GRANT_REF = 'revenuecat';

/** Writes a verified provider snapshot into subscriptions + entitlement_grants. */
export async function applySnapshot(ctx: AppContext, userId: string, snap: CustomerSnapshot): Promise<void> {
  const entitlementId = ctx.config.billing.entitlementId;
  const now = ctx.now();
  await withTransaction(ctx.db, async (tx) => {
    const { rowCount } = await tx.query('select 1 from users where id = $1 for update', [userId]);
    if (!rowCount) return; // account deleted meanwhile
    for (const s of snap.subscriptions) {
      await tx.query(
        `insert into subscriptions (user_id, provider, product_id, store, status, entitlement, purchased_at, expires_at, will_renew, is_sandbox, management_url, updated_at)
         values ($1, 'revenuecat', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         on conflict (user_id, provider, product_id) do update set
           store = excluded.store, status = excluded.status, purchased_at = excluded.purchased_at,
           expires_at = excluded.expires_at, will_renew = excluded.will_renew, is_sandbox = excluded.is_sandbox,
           management_url = excluded.management_url, updated_at = excluded.updated_at`,
        [userId, s.productId, s.store, s.status, entitlementId, s.purchasedAt, s.expiresAt, s.willRenew, s.isSandbox, snap.managementUrl, now],
      );
    }
    if (snap.entitlement) {
      const e = snap.entitlement;
      await tx.query(
        `insert into entitlement_grants (user_id, entitlement, source, source_ref, starts_at, expires_at, revoked_at, updated_at)
         values ($1, $2, 'store', $3, $4, $5, $6, $7)
         on conflict (user_id, source, source_ref) do update set
           starts_at = excluded.starts_at, expires_at = excluded.expires_at, revoked_at = excluded.revoked_at, updated_at = excluded.updated_at`,
        [userId, entitlementId, STORE_GRANT_REF, e.startsAt, e.expiresAt, e.revoked ? now : null, now],
      );
    } else {
      // Provider no longer reports the entitlement at all (e.g. transferred away): end it now.
      await tx.query(
        `update entitlement_grants set expires_at = least(coalesce(expires_at, $3), $3), updated_at = $3
          where user_id = $1 and source = 'store' and source_ref = $2`,
        [userId, STORE_GRANT_REF, now],
      );
    }
  });
}

export async function syncUser(ctx: AppContext, userId: string): Promise<void> {
  if (!ctx.billing) throw new ApiError('purchases_unavailable', 'Purchases are not configured on this server');
  const snap = await ctx.billing.getCustomer(userId);
  await applySnapshot(ctx, userId, snap);
}
