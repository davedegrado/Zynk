import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { tokenStorage } from './storage';

function devApiUrl(): string {
  // In development, talk to the API on the same machine that serves Metro.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:4000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

const BUILT_IN_API_URL = (process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? devApiUrl() : '')).replace(/\/$/, '');

/**
 * Test builds (and development) let the tester type the server address on the
 * welcome screen, e.g. their computer's LAN IP. Store builds never allow it.
 */
export const ALLOW_SERVER_OVERRIDE = __DEV__ || process.env.EXPO_PUBLIC_ALLOW_SERVER_OVERRIDE === '1';

let serverOverride: string | null = null;
const SERVER_KEY = 'speow.server';

export const getApiUrl = () => (ALLOW_SERVER_OVERRIDE && serverOverride) || BUILT_IN_API_URL;
export const getInviteBaseUrl = () => (process.env.EXPO_PUBLIC_INVITE_BASE_URL || getApiUrl()).replace(/\/$/, '');

/** "192.168.1.20" → "http://192.168.1.20:4000"; keeps explicit schemes/ports. */
export function normalizeServerUrl(input: string): string | null {
  let s = input.trim().replace(/\/+$/, '');
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  try {
    const u = new URL(s);
    if (!u.hostname) return null;
    if (!u.port && u.protocol === 'http:' && /^[\d.]+$|^localhost$/.test(u.hostname)) u.port = '4000';
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

export async function loadServerOverride() {
  if (!ALLOW_SERVER_OVERRIDE) return;
  serverOverride = (await tokenStorage.get(SERVER_KEY).catch(() => null)) || null;
}

export async function saveServerOverride(url: string | null) {
  serverOverride = url;
  if (url) await tokenStorage.set(SERVER_KEY, url);
  else await tokenStorage.remove(SERVER_KEY).catch(() => undefined);
}

export const REVENUECAT_KEYS = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '',
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '',
};

export const EAS_PROJECT_ID: string | undefined =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;

/** Required by the App Store for subscriptions; shown on the Plus screen when set. */
export const LEGAL_URLS = {
  terms: process.env.EXPO_PUBLIC_TERMS_URL || '',
  privacy: process.env.EXPO_PUBLIC_PRIVACY_URL || '',
};
