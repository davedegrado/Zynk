import type { SubscriptionInfo, SubscriptionStatus } from '@zynk/shared';

/** Normalized purchase state for one user, as verified server-side with the provider. */
export interface CustomerSnapshot {
  subscriptions: {
    productId: string;
    store: SubscriptionInfo['store'];
    status: SubscriptionStatus;
    purchasedAt: Date | null;
    expiresAt: Date | null;
    willRenew: boolean;
    isSandbox: boolean;
  }[];
  /** The entitlement as computed by the provider, or null if the user has never had it. */
  entitlement: {
    productId: string;
    startsAt: Date;
    /** null = non-expiring (lifetime/promotional). */
    expiresAt: Date | null;
    revoked: boolean;
  } | null;
  managementUrl: string | null;
}

export interface BillingProvider {
  readonly name: 'revenuecat';
  getCustomer(userId: string): Promise<CustomerSnapshot>;
  deleteCustomer(userId: string): Promise<void>;
}
