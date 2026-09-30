import Constants from 'expo-constants';

export type AppMode = 'local' | 'hosted';

export type AppCapabilities = Readonly<{
  authentication: boolean;
  sync: boolean;
  marketplace: boolean;
  remoteAnalytics: boolean;
  externalProductLinks: boolean;
  remoteMedia: boolean;
}>;

export function resolveAppMode(value: unknown): AppMode {
  return value === 'hosted' ? 'hosted' : 'local';
}

export function capabilitiesForMode(mode: AppMode): AppCapabilities {
  const hosted = mode === 'hosted';
  return Object.freeze({
    authentication: hosted,
    sync: hosted,
    marketplace: hosted,
    remoteAnalytics: hosted,
    externalProductLinks: hosted,
    remoteMedia: hosted,
  });
}

export const APP_MODE = resolveAppMode(Constants.expoConfig?.extra?.appMode);
export const isHostedMode = APP_MODE === 'hosted';
export const APP_CAPABILITIES = capabilitiesForMode(APP_MODE);
