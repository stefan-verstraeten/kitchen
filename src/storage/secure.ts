import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Secrets (Dropbox refresh token, Claude API key) go to the iOS Keychain /
 * Android Keystore. The web build (used for development only) has no secure
 * store, so it falls back to local storage.
 */
const web = Platform.OS === 'web';

export const secure = {
  get: (key: string): Promise<string | null> => (web ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key)),
  set: (key: string, value: string): Promise<void> => (web ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value)),
  remove: (key: string): Promise<void> => (web ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key)),
};
