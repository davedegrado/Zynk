import Constants from 'expo-constants';
import { Platform } from 'react-native';

function devApiUrl(): string {
  // In development, talk to the API on the same machine that serves Metro.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:4000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? devApiUrl() : '')).replace(/\/$/, '');
export const INVITE_BASE_URL = (process.env.EXPO_PUBLIC_INVITE_BASE_URL || API_URL).replace(/\/$/, '');

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
