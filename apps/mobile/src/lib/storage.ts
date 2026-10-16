import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Session token storage: Keychain (iOS) / Keystore-backed SecureStore (Android).
 * The web build (used only for development previews) falls back to localStorage.
 */
export const tokenStorage = {
  get: async (key: string): Promise<string | null> =>
    Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) ?? null : SecureStore.getItemAsync(key),
  set: async (key: string, value: string) =>
    Platform.OS === 'web'
      ? globalThis.localStorage?.setItem(key, value)
      : SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
  remove: async (key: string) => (Platform.OS === 'web' ? globalThis.localStorage?.removeItem(key) : SecureStore.deleteItemAsync(key)),
};
