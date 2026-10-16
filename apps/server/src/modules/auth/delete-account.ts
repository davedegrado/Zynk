import type { AppContext } from '../../context';
import { withTransaction } from '../../db/pool';

/**
 * Hard-deletes a user. Foreign keys cascade to sessions, device tokens,
 * friendships, requests, blocks, mutes, Speows (sent and received), preferences,
 * subscriptions and grants. Reports keep a username snapshot with user ids
 * nulled out, so moderation history survives without retaining the account.
 *
 * Store subscriptions are NOT cancelled by this (Apple/Google own billing);
 * the app tells users to cancel in the store first.
 */
export async function deleteAccount(ctx: AppContext, userId: string): Promise<void> {
  await withTransaction(ctx.db, async (tx) => {
    await tx.query(
      `update reports r set reported_username = coalesce(r.reported_username, u.username::text)
         from users u where u.id = r.reported_user_id and r.reported_user_id = $1`,
      [userId],
    );
    await tx.query('delete from users where id = $1', [userId]);
  });
  if (ctx.billing) {
    // Best effort: remove the purchase-provider customer record (GDPR). Failure is logged by caller.
    await ctx.billing.deleteCustomer(userId).catch(() => undefined);
  }
}
