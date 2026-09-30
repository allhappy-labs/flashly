export type AppMode = 'local' | 'hosted';

export type FrontendCapabilities = Readonly<{
    appMode: AppMode;
    flashlyApi: boolean;
    authentication: boolean;
    hostedNavigation: boolean;
    hostedDecks: boolean;
    commercialUi: boolean;
    remoteFeatureFlags: boolean;
    directProviders: boolean;
    bulkGeneration: boolean;
}>;

export function resolveAppMode(value: unknown): AppMode {
    return value === 'hosted' ? 'hosted' : 'local';
}

export function getFrontendCapabilities(mode: AppMode): FrontendCapabilities {
    const hosted = mode === 'hosted';
    return Object.freeze({
        appMode: mode,
        flashlyApi: hosted,
        authentication: hosted,
        hostedNavigation: hosted,
        hostedDecks: hosted,
        commercialUi: hosted,
        remoteFeatureFlags: hosted,
        directProviders: !hosted,
        bulkGeneration: !hosted,
    });
}

export const APP_MODE = resolveAppMode(import.meta.env.VITE_APP_MODE);
export const isHostedMode = APP_MODE === 'hosted';
export const frontendCapabilities = getFrontendCapabilities(APP_MODE);
