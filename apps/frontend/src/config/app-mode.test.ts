import { describe, expect, it } from 'vitest';
import { getFrontendCapabilities, resolveAppMode } from './app-mode';

describe('frontend app mode', () => {
    it.each([
        [undefined, 'local'],
        [null, 'local'],
        ['', 'local'],
        ['local', 'local'],
        ['HOSTED', 'local'],
        ['hosted ', 'local'],
        ['typo', 'local'],
        ['hosted', 'hosted'],
    ])('resolves %j to %s', (input, expected) => {
        expect(resolveAppMode(input)).toBe(expected);
    });

    it('disables every Flashly-hosted capability in local mode', () => {
        expect(getFrontendCapabilities('local')).toEqual({
            appMode: 'local',
            flashlyApi: false,
            authentication: false,
            hostedNavigation: false,
            hostedDecks: false,
            commercialUi: false,
            remoteFeatureFlags: false,
            directProviders: true,
            bulkGeneration: true,
        });
    });

    it('restores the hosted capability bundle together', () => {
        expect(getFrontendCapabilities('hosted')).toEqual({
            appMode: 'hosted',
            flashlyApi: true,
            authentication: true,
            hostedNavigation: true,
            hostedDecks: true,
            commercialUi: true,
            remoteFeatureFlags: true,
            directProviders: false,
            bulkGeneration: false,
        });
    });
});
