/**
 * Store purchases via RevenueCat (StoreKit 2 on iOS, Google Play Billing on Android).
 *
 * Trust model: the device only *initiates* purchases. After every purchase or
 * restore we call POST /billing/sync; the server fetches the customer from
 * RevenueCat with its secret key and only then grants the entitlement. The UI
 * reads entitlements exclusively from the server.
 */
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import type { EntitlementsResponse, PlanConfig } from '@zynk/shared';
import { translate } from '../i18n';
import { api } from './api';
import { REVENUECAT_KEYS } from './config';
import { keys, queryClient } from './query';
import { onSignOut } from './session';

type PurchasesModule = typeof import('react-native-purchases').default;
type PurchasesPackage = import('react-native-purchases').PurchasesPackage;

let Purchases: PurchasesModule | null = null;
let errorCodes: typeof import('react-native-purchases').PURCHASES_ERROR_CODE | null = null;
let configuredFor: string | null = null;

function apiKey() {
  return Platform.OS === 'ios' ? REVENUECAT_KEYS.ios : Platform.OS === 'android' ? REVENUECAT_KEYS.android : '';
}

/** True if this build has store keys and the native module (i.e. not Expo Go/web). */
export function purchasesAvailableOnDevice(): boolean {
  return !!apiKey() && loadModule() !== null;
}

function loadModule(): PurchasesModule | null {
  if (Purchases) return Purchases;
  try {
    // Lazy so the app still runs where the native module is missing (e.g. web, tests).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases') as typeof import('react-native-purchases');
    Purchases = mod.default;
    errorCodes = mod.PURCHASES_ERROR_CODE;
    return Purchases;
  } catch {
    return null;
  }
}

export async function configurePurchases(userId: string) {
  const P = loadModule();
  const key = apiKey();
  if (!P || !key) return;
  try {
    if (!configuredFor) {
      // appUserID = our server user id, so webhooks and server lookups map 1:1.
      P.configure({ apiKey: key, appUserID: userId });
    } else if (configuredFor !== userId) {
      await P.logIn(userId);
    }
    configuredFor = userId;
  } catch {
    configuredFor = null;
  }
}

onSignOut(async () => {
  if (Purchases && configuredFor) {
    await Purchases.logOut().catch(() => undefined);
    configuredFor = null;
  }
});

export interface StorePlan extends PlanConfig {
  /** Localized price from the store, if loaded. */
  priceString: string | null;
  pkg: PurchasesPackage | null;
  introOffer: string | null;
}

/** Merges server-configured plans with the store's localized products. */
export async function loadStorePlans(plans: PlanConfig[]): Promise<StorePlan[]> {
  const P = loadModule();
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  let packages: PurchasesPackage[] = [];
  if (P && configuredFor) {
    try {
      const offerings = await P.getOfferings();
      packages = Object.values(offerings.all).flatMap((o) => o.availablePackages);
    } catch {
      packages = [];
    }
  }
  return plans.map((plan) => {
    const productId = plan.productIds[platform];
    const pkg = packages.find((p) => p.product.identifier === productId) ?? null;
    const intro = pkg?.product.introPrice;
    return {
      ...plan,
      pkg,
      priceString: pkg?.product.priceString ?? null,
      introOffer: intro ? `${intro.priceString} for ${intro.periodNumberOfUnits} ${intro.periodUnit.toLowerCase()}${intro.periodNumberOfUnits > 1 ? 's' : ''}` : null,
    };
  });
}

export type PurchaseOutcome =
  | { kind: 'success'; entitlements: EntitlementsResponse }
  | { kind: 'verifying' } // store says OK but our server couldn't confirm yet
  | { kind: 'cancelled' }
  | { kind: 'pending' } // e.g. Ask to Buy, slow card
  | { kind: 'error'; message: string };

async function verifyWithServer(): Promise<PurchaseOutcome> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const entitlements = await api.syncPurchases();
      queryClient.setQueryData(keys.entitlements, entitlements);
      void queryClient.invalidateQueries({ queryKey: keys.prefs });
      if (entitlements.features.length > 0) return { kind: 'success', entitlements };
    } catch {
      // retry below
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return { kind: 'verifying' };
}

export function mapError(err: unknown): PurchaseOutcome {
  loadModule();
  const e = err as { code?: string; userCancelled?: boolean; message?: string };
  if (e.userCancelled || e.code === errorCodes?.PURCHASE_CANCELLED_ERROR) return { kind: 'cancelled' };
  if (e.code === errorCodes?.PAYMENT_PENDING_ERROR) return { kind: 'pending' };
  if (e.code === errorCodes?.PRODUCT_ALREADY_PURCHASED_ERROR) {
    return { kind: 'error', message: translate('purchase.alreadyOwned') };
  }
  if (e.code === errorCodes?.NETWORK_ERROR) return { kind: 'error', message: "Couldn't reach the store. Check your connection." };
  if (e.code === errorCodes?.PURCHASE_NOT_ALLOWED_ERROR) return { kind: 'error', message: translate('purchase.notAllowed') };
  return { kind: 'error', message: e.message || translate('purchase.failed') };
}

export async function purchasePlan(plan: StorePlan): Promise<PurchaseOutcome> {
  const P = loadModule();
  if (!P || !plan.pkg) return { kind: 'error', message: translate('purchase.planUnavailable') };
  try {
    await P.purchasePackage(plan.pkg);
  } catch (err) {
    return mapError(err);
  }
  return verifyWithServer();
}

export async function restorePurchases(): Promise<PurchaseOutcome> {
  const P = loadModule();
  if (P && configuredFor) {
    try {
      await P.restorePurchases();
    } catch (err) {
      return mapError(err);
    }
  }
  const out = await verifyWithServer();
  return out.kind === 'verifying' ? { kind: 'error', message: translate('purchase.noneFound') } : out;
}

/** Opens the store's own subscription management screen. */
export async function openManageSubscription(managementUrl: string | null, productId?: string) {
  const fallback =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : `https://play.google.com/store/account/subscriptions${productId ? `?sku=${encodeURIComponent(productId.split(':')[0]!)}&package=${Constants.expoConfig?.android?.package ?? 'app.speow'}` : ''}`;
  await Linking.openURL(managementUrl || fallback).catch(() => Linking.openURL(fallback));
}
