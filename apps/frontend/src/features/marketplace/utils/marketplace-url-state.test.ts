import { describe, expect, it } from 'vitest';

import {
    DEFAULT_MARKETPLACE_SORT,
    getMarketplaceStateFromSearch,
    isMarketplaceSortValue,
} from './marketplace-url-state';

describe('marketplace-url-state', () => {
    it('parses valid search params from object search state', () => {
        const state = getMarketplaceStateFromSearch({
            q: 'spanish verbs',
            materialType: 'Language',
            deckType: 'QA',
            locale: 'spa',
            level: 'A1',
            skill: 'listening',
            regionalVariant: 'es-MX',
            hasAudio: 'true',
            script: 'Latin',
            romanization: 'with_romanization',
            sort: 'most_downloaded',
            page: '3',
        });

        expect(state).toEqual({
            search: 'spanish verbs',
            materialType: 'Language',
            deckType: 'QA',
            locale: 'spa',
            level: 'A1',
            skill: 'listening',
            regionalVariant: 'es-MX',
            hasAudio: true,
            script: 'Latin',
            romanization: 'with_romanization',
            sortBy: 'most_downloaded',
            page: 3,
        });
    });

    it('falls back on invalid sort/page values', () => {
        const state = getMarketplaceStateFromSearch({
            q: '',
            sort: 'invalid',
            page: '-4',
        });

        expect(state.sortBy).toBe(DEFAULT_MARKETPLACE_SORT);
        expect(state.page).toBe(1);
        expect(state.search).toBe('');
    });

    it('returns defaults for non-object search state', () => {
        expect(getMarketplaceStateFromSearch(null)).toEqual({
            search: '',
            materialType: undefined,
            deckType: undefined,
            locale: undefined,
            level: undefined,
            skill: undefined,
            regionalVariant: undefined,
            hasAudio: undefined,
            script: undefined,
            romanization: undefined,
            sortBy: DEFAULT_MARKETPLACE_SORT,
            page: 1,
        });
    });

    it('validates sort values', () => {
        expect(isMarketplaceSortValue('newest')).toBe(true);
        expect(isMarketplaceSortValue('most_viewed')).toBe(true);
        expect(isMarketplaceSortValue('random')).toBe(false);
        expect(isMarketplaceSortValue(null)).toBe(false);
    });
});
