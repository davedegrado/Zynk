import { ENTITLEMENT_FEATURES, isEntitlementId, type EntitlementId, type FeatureId } from './features';

/** A grant as stored by the backend. Dates are ISO strings or Date objects. */
export interface EntitlementGrantLike {
  entitlement: string;
  startsAt: Date | string;
  expiresAt: Date | string | null;
  revokedAt: Date | string | null;
}

const toTime = (d: Date | string) => (d instanceof Date ? d.getTime() : Date.parse(d));

/** A grant is active if it has started, has not expired and has not been revoked. */
export function isGrantActive(grant: EntitlementGrantLike, now: Date = new Date()): boolean {
  const t = now.getTime();
  if (grant.revokedAt != null) return false;
  if (toTime(grant.startsAt) > t) return false;
  if (grant.expiresAt != null && toTime(grant.expiresAt) <= t) return false;
  return true;
}

export function activeEntitlements(
  grants: readonly EntitlementGrantLike[],
  now: Date = new Date(),
): EntitlementId[] {
  const out = new Set<EntitlementId>();
  for (const g of grants) {
    if (isEntitlementId(g.entitlement) && isGrantActive(g, now)) out.add(g.entitlement);
  }
  return [...out];
}

/** The single function that decides which features a user can use. */
export function resolveFeatures(
  grants: readonly EntitlementGrantLike[],
  now: Date = new Date(),
): FeatureId[] {
  const out = new Set<FeatureId>();
  for (const e of activeEntitlements(grants, now)) {
    for (const f of ENTITLEMENT_FEATURES[e]) out.add(f);
  }
  return [...out].sort();
}

export type FeatureSet = ReadonlySet<FeatureId> | readonly FeatureId[];

export function hasFeature(features: FeatureSet, feature: FeatureId | null | undefined): boolean {
  if (feature == null) return true;
  return 'has' in features ? features.has(feature) : features.includes(feature);
}
