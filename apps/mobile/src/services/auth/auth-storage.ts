import * as SecureStore from 'expo-secure-store';
import { logger } from '../../utils/logger';

export const AUTH_STORAGE_PREFIX = 'flashly';

const memoryStore = new Map<string, string>();
const storageKeys = [
  `${AUTH_STORAGE_PREFIX}_cookie`,
  `${AUTH_STORAGE_PREFIX}_session_data`,
];

export async function hydrateAuthStorage(): Promise<void> {
  await Promise.all(
    storageKeys.map(async (key) => {
      try {
        const value = await SecureStore.getItemAsync(key);
        if (value !== null) {
          memoryStore.set(key, value);
        }
      } catch (error) {
        logger.warn('[AuthStorage] Failed to hydrate key', key, error);
      }
    })
  );
}

export async function clearAuthStorage(): Promise<void> {
  await Promise.all(
    storageKeys.map(async (key) => {
      memoryStore.delete(key);
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        logger.warn('[AuthStorage] Failed to clear key', key, error);
      }
    })
  );
}

export const authStorage = {
  getItem: (key: string): string | null => {
    return memoryStore.get(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    memoryStore.set(key, value);
    void SecureStore.setItemAsync(key, value);
  },
};
