import type { SubscriptionInfo, SubscriptionStatus } from '@zynk/shared';
import type { BillingProvider, CustomerSnapshot } from './provider';

const API = 'https://api.revenuecat.com/v1';

interface RcSubscription {
  expires_date: string | null;
  purchase_date?: string | null;
  original_purchase_date?: string | null;
  store?: string;
  is_sandbox?: boolean;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  grace_period_expires_date?: string | null;
  refunded_at?: string | null;
  auto_resume_date?: string | null;
}
interface RcEntitlement {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
  product_identifier: string;
  purchase_date: string;
}
export interface RcSubscriberResponse {
  subscriber: {
    entitlements?: Record<string, RcEntitlement>;
    subscriptions?: Record<string, RcSubscription>;
    management_url?: string | null;
  };
}

const d = (s: string | null | undefined) => (s ? new Date(s) : null);
const STORES: Record<string, SubscriptionInfo['store']> = {
  app_store: 'app_store', mac_app_store: 'app_store', play_store: 'play_store', stripe: 'stripe', promotional: 'promotional',
};

function statusOf(s: RcSubscription, now: Date): SubscriptionStatus {
  const t = now.getTime();
  const expires = d(s.expires_date)?.getTime() ?? Infinity;
  const grace = d(s.grace_period_expires_date)?.getTime() ?? -Infinity;
  if (s.refunded_at) return 'refunded';
  if (expires <= t) {
    if (grace > t) return 'in_grace';
    if (s.auto_resume_date) return 'paused';
    return s.billing_issues_detected_at ? 'billing_issue' : 'expired';
  }
  if (s.billing_issues_detected_at) return 'in_grace';
  if (s.unsubscribe_detected_at) return 'cancelled';
  return 'active';
}

/** Pure mapping from RevenueCat's subscriber object to our normalized snapshot. */
export function mapRevenueCatSubscriber(json: RcSubscriberResponse, entitlementId: string, now: Date): CustomerSnapshot {
  const sub = json.subscriber ?? {};
  const subscriptions = Object.entries(sub.subscriptions ?? {}).map(([productId, s]) => {
    const status = statusOf(s, now);
    return {
      productId,
      store: STORES[s.store ?? ''] ?? 'unknown',
      status,
      purchasedAt: d(s.original_purchase_date ?? s.purchase_date),
      expiresAt: d(s.expires_date),
      willRenew: (status === 'active' || status === 'in_grace') && !s.unsubscribe_detected_at,
      isSandbox: !!s.is_sandbox,
    };
  });
  const e = sub.entitlements?.[entitlementId];
  let entitlement: CustomerSnapshot['entitlement'] = null;
  if (e) {
    const expires = d(e.expires_date);
    const grace = d(e.grace_period_expires_date);
    const effectiveExpiry = expires && grace && grace > expires ? grace : expires;
    const backing = sub.subscriptions?.[e.product_identifier];
    entitlement = {
      productId: e.product_identifier,
      startsAt: d(e.purchase_date) ?? now,
      expiresAt: effectiveExpiry,
      revoked: !!backing?.refunded_at,
    };
  }
  return { subscriptions, entitlement, managementUrl: sub.management_url ?? null };
}

export class RevenueCatProvider implements BillingProvider {
  readonly name = 'revenuecat' as const;
  constructor(
    private readonly secretKey: string,
    private readonly entitlementId: string,
    private readonly now: () => Date,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private headers() {
    return { authorization: `Bearer ${this.secretKey}`, accept: 'application/json', 'content-type': 'application/json' };
  }

  async getCustomer(userId: string): Promise<CustomerSnapshot> {
    const res = await this.fetchImpl(`${API}/subscribers/${encodeURIComponent(userId)}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`RevenueCat responded ${res.status}`);
    return mapRevenueCatSubscriber((await res.json()) as RcSubscriberResponse, this.entitlementId, this.now());
  }

  async deleteCustomer(userId: string): Promise<void> {
    const res = await this.fetchImpl(`${API}/subscribers/${encodeURIComponent(userId)}`, { method: 'DELETE', headers: this.headers() });
    if (!res.ok && res.status !== 404) throw new Error(`RevenueCat responded ${res.status}`);
  }
}
