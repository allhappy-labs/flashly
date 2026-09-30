import { afterEach, describe, expect, it, vi } from 'vitest';

import { getElevenLabsSettings } from './elevenlabs-settings';
import { getOpenRouterSettings } from './openrouter-settings';
import { getUnsplashSettings, saveUnsplashSettings, type SettingsStorage } from './unsplash-settings';

function createMemorySettingsStorage(initialValues: Readonly<Record<string, string>> = {}): SettingsStorage {
    const values = new Map(Object.entries(initialValues));

    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
            values.set(key, value);
        },
        removeItem: (key) => {
            values.delete(key);
        },
    };
}

describe('Unsplash settings', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('trims and stores an anonymous Unsplash access key', () => {
        const storage = createMemorySettingsStorage();

        saveUnsplashSettings({ accessKey: '  client-key  ' }, undefined, storage);

        expect(storage.getItem('flashly.unsplashAccessKey')).toBe('client-key');
    });

    it('removes the key when the saved value is empty', () => {
        const storage = createMemorySettingsStorage({
            'flashly.unsplashAccessKey': 'old-key',
        });

        saveUnsplashSettings({ accessKey: '   ' }, undefined, storage);

        expect(storage.getItem('flashly.unsplashAccessKey')).toBeNull();
    });

    it('does not resolve browser storage when an injected storage is provided', () => {
        const storage = createMemorySettingsStorage({
            'flashly.unsplashAccessKey': 'injected-key',
        });
        const windowDouble = {
            dispatchEvent: vi.fn(),
        };
        Object.defineProperty(windowDouble, 'localStorage', {
            get: () => {
                throw new Error('browser storage should not be resolved');
            },
        });
        vi.stubGlobal('window', windowDouble);

        expect(getUnsplashSettings(undefined, storage)).toEqual({ accessKey: 'injected-key' });
        expect(() => saveUnsplashSettings({ accessKey: 'updated-key' }, undefined, storage)).not.toThrow();
        expect(storage.getItem('flashly.unsplashAccessKey')).toBe('updated-key');
    });

    it('reads the anonymous fallback into a hosted user scope and removes it after save', () => {
        const storage = createMemorySettingsStorage({
            'flashly.unsplashAccessKey': 'anonymous-key',
        });

        expect(getUnsplashSettings('user-7', storage)).toEqual({ accessKey: 'anonymous-key' });

        saveUnsplashSettings({ accessKey: 'user-key' }, 'user-7', storage);

        expect(storage.getItem('flashly.user-7.unsplashAccessKey')).toBe('user-key');
        expect(storage.getItem('flashly.unsplashAccessKey')).toBeNull();
    });

    it('preserves anonymous OpenRouter and ElevenLabs settings without a hosted user', () => {
        const storage = createMemorySettingsStorage({
            'flashly.openrouterApiKey': 'openrouter-key',
            'flashly.openrouterModel': 'openai/test-model',
            'flashly.elevenlabsApiKey': 'elevenlabs-key',
            'flashly.elevenlabsVoiceName': 'Alice',
            'flashly.elevenlabsModelId': 'eleven_v3',
        });
        vi.stubGlobal('window', {
            localStorage: storage,
            dispatchEvent: vi.fn(),
        });

        expect(getOpenRouterSettings()).toEqual({
            apiKey: 'openrouter-key',
            model: 'openai/test-model',
        });
        expect(getElevenLabsSettings()).toEqual({
            apiKey: 'elevenlabs-key',
            voiceName: 'Alice',
            modelId: 'eleven_v3',
        });
    });
});
