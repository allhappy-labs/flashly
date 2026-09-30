const FALLBACK_API_KEY_STORAGE_KEY = 'flashly.elevenlabsApiKey';

export type ElevenLabsSettings = {
    apiKey: string;
    voiceName: string;
    modelId: string;
};

const getStorageKeys = (userId?: string | null) => {
    if (userId) {
        return {
            apiKey: `flashly.${userId}.elevenlabsApiKey`,
            voiceName: `flashly.${userId}.elevenlabsVoiceName`,
            modelId: `flashly.${userId}.elevenlabsModelId`,
        };
    }
    return {
        apiKey: FALLBACK_API_KEY_STORAGE_KEY,
        voiceName: 'flashly.elevenlabsVoiceName',
        modelId: 'flashly.elevenlabsModelId',
    };
};

export const getElevenLabsSettings = (userId?: string | null): ElevenLabsSettings => {
    if (typeof window === 'undefined') {
        return { apiKey: '', voiceName: '', modelId: '' };
    }

    const keys = getStorageKeys(userId);
    const storedApiKey = window.localStorage.getItem(keys.apiKey)
        ?? window.localStorage.getItem(FALLBACK_API_KEY_STORAGE_KEY)
        ?? '';
    const storedVoiceName = window.localStorage.getItem(keys.voiceName) ?? '';
    const storedModelId = window.localStorage.getItem(keys.modelId) ?? '';

    return {
        apiKey: storedApiKey,
        voiceName: storedVoiceName,
        modelId: storedModelId,
    };
};

export const saveElevenLabsSettings = (settings: ElevenLabsSettings, userId?: string | null) => {
    if (typeof window === 'undefined') return;

    const keys = getStorageKeys(userId);
    const apiKey = settings.apiKey.trim();
    const voiceName = settings.voiceName.trim();
    const modelId = settings.modelId.trim();

    if (apiKey) {
        window.localStorage.setItem(keys.apiKey, apiKey);
    } else {
        window.localStorage.removeItem(keys.apiKey);
    }

    if (voiceName) {
        window.localStorage.setItem(keys.voiceName, voiceName);
    } else {
        window.localStorage.removeItem(keys.voiceName);
    }

    if (modelId) {
        window.localStorage.setItem(keys.modelId, modelId);
    } else {
        window.localStorage.removeItem(keys.modelId);
    }

    if (userId) {
        window.localStorage.removeItem(FALLBACK_API_KEY_STORAGE_KEY);
    }

    window.dispatchEvent(new Event('flashly:settings-updated'));
};
