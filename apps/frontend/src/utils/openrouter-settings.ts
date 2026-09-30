import { DEFAULT_OPENROUTER_MODEL } from '@flashly/shared/src';

export { DEFAULT_OPENROUTER_MODEL };
const FALLBACK_API_KEY_STORAGE_KEY = 'flashly.openrouterApiKey';
const FALLBACK_MODEL_STORAGE_KEY = 'flashly.openrouterModel';

export type OpenRouterSettings = {
    apiKey: string;
    model: string;
};

const getStorageKeys = (userId?: string | null) => {
    if (userId) {
        return {
            apiKey: `flashly.${userId}.openrouterApiKey`,
            model: `flashly.${userId}.openrouterModel`,
        };
    }
    return {
        apiKey: FALLBACK_API_KEY_STORAGE_KEY,
        model: FALLBACK_MODEL_STORAGE_KEY,
    };
};

export const getOpenRouterSettings = (userId?: string | null): OpenRouterSettings => {
    if (typeof window === 'undefined') {
        return { apiKey: '', model: DEFAULT_OPENROUTER_MODEL };
    }

    const keys = getStorageKeys(userId);
    const storedApiKey =
        window.localStorage.getItem(keys.apiKey) ?? window.localStorage.getItem(FALLBACK_API_KEY_STORAGE_KEY) ?? '';
    const storedModel =
        window.localStorage.getItem(keys.model) ?? window.localStorage.getItem(FALLBACK_MODEL_STORAGE_KEY) ?? '';

    return {
        apiKey: storedApiKey,
        model: storedModel.trim() || DEFAULT_OPENROUTER_MODEL,
    };
};

export const saveOpenRouterSettings = (settings: OpenRouterSettings, userId?: string | null) => {
    if (typeof window === 'undefined') return;

    const keys = getStorageKeys(userId);
    const apiKey = settings.apiKey.trim();
    const model = settings.model.trim() || DEFAULT_OPENROUTER_MODEL;

    if (apiKey) {
        window.localStorage.setItem(keys.apiKey, apiKey);
    } else {
        window.localStorage.removeItem(keys.apiKey);
    }

    window.localStorage.setItem(keys.model, model);

    if (userId) {
        window.localStorage.removeItem(FALLBACK_API_KEY_STORAGE_KEY);
        window.localStorage.removeItem(FALLBACK_MODEL_STORAGE_KEY);
    }

    window.dispatchEvent(new Event('flashly:settings-updated'));
};
