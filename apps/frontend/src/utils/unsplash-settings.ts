const FALLBACK_ACCESS_KEY = 'flashly.unsplashAccessKey';

export type SettingsStorage = Readonly<{
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
}>;

export type UnsplashSettings = {
    accessKey: string;
};

function getStorageKey(userId?: string | null): string {
    return userId ? `flashly.${userId}.unsplashAccessKey` : FALLBACK_ACCESS_KEY;
}

function getBrowserStorage(): SettingsStorage | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    return window.localStorage;
}

export function getUnsplashSettings(userId?: string | null, storage?: SettingsStorage): UnsplashSettings {
    const settingsStorage = storage ?? getBrowserStorage();
    if (!settingsStorage) {
        return { accessKey: '' };
    }

    const accessKey =
        settingsStorage.getItem(getStorageKey(userId)) ?? settingsStorage.getItem(FALLBACK_ACCESS_KEY) ?? '';

    return { accessKey };
}

export function saveUnsplashSettings(
    settings: UnsplashSettings,
    userId?: string | null,
    storage?: SettingsStorage,
): void {
    const settingsStorage = storage ?? getBrowserStorage();
    if (!settingsStorage) {
        return;
    }

    const storageKey = getStorageKey(userId);
    const accessKey = settings.accessKey.trim();

    if (accessKey) {
        settingsStorage.setItem(storageKey, accessKey);
    } else {
        settingsStorage.removeItem(storageKey);
    }

    if (userId) {
        settingsStorage.removeItem(FALLBACK_ACCESS_KEY);
    }

    if (!storage) {
        window.dispatchEvent(new Event('flashly:settings-updated'));
    }
}
