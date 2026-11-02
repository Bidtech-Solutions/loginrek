import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Penyimpanan token API di Keychain (iOS) / Keystore (Android)
 * dan fallback localStorage jika dibuka di browser web.
 */
const KEY = 'loginrek.accessToken';

export const tokenStorage = {
  get: async (): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    }
    return SecureStore.getItemAsync(KEY);
  },
  set: async (token: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(KEY, token);
      }
      return;
    }
    return SecureStore.setItemAsync(KEY, token);
  },
  clear: async (): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(KEY);
      }
      return;
    }
    return SecureStore.deleteItemAsync(KEY);
  },
};

