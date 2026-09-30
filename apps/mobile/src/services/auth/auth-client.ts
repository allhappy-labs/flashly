import Constants from 'expo-constants';
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import { magicLinkClient, oneTimeTokenClient } from 'better-auth/client/plugins';
import { authStorage, AUTH_STORAGE_PREFIX } from './auth-storage';
import { API_BASE_URL, getApiBaseUrlInfo } from '../../constants';
import { logger } from '../../utils/logger';

const AUTH_PATH = '/api/auth';
const DEFAULT_SCHEME = 'flashly';

let sessionToken: string | null = null;

function getExpoScheme(): string {
  const scheme = Constants.expoConfig?.scheme;
  return typeof scheme === 'string' && scheme.length > 0 ? scheme : DEFAULT_SCHEME;
}

function getObjectProperty(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  return Reflect.get(value, key);
}

function getCallable(value: unknown, key: string): ((...args: unknown[]) => unknown) | null {
  const candidate = getObjectProperty(value, key);
  if (typeof candidate !== 'function') {
    return null;
  }
  return (...args: unknown[]) => Reflect.apply(candidate, value, args);
}

export function getAuthBaseUrl(): string {
  const normalized = API_BASE_URL.replace(/\/$/, '');
  return `${normalized}${AUTH_PATH}`;
}

export const authClient = createAuthClient({
  baseURL: getAuthBaseUrl(),
  plugins: [
    expoClient({
      scheme: getExpoScheme(),
      storagePrefix: AUTH_STORAGE_PREFIX,
      storage: authStorage,
    }),
    magicLinkClient(),
    oneTimeTokenClient(),
  ],
});

const apiInfo = getApiBaseUrlInfo();
logger.debug('[AuthClient] API baseUrl:', apiInfo.baseUrl, 'source:', apiInfo.source);

export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

export function getSessionToken(): string | null {
  return sessionToken;
}

export function getSessionCookie(): string | null {
  const getCookie = getCallable(authClient, 'getCookie');
  if (!getCookie) {
    return null;
  }

  const cookie = getCookie();
  if (typeof cookie !== 'string' || !cookie) {
    return null;
  }

  const trimmed = cookie.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function signOutSession(): Promise<void> {
  const signOut = getCallable(authClient, 'signOut');
  if (!signOut) {
    throw new Error('Sign out is not available');
  }

  const result = await Promise.resolve(signOut());
  const error = getObjectProperty(result, 'error');
  if (error) {
    throw error;
  }
}
