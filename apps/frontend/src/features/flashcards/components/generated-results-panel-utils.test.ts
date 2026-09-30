import { describe, expect, it } from 'vitest';

import { createFailureLookupMap } from './generated-results-panel-utils';

describe('generated-results-panel-utils', () => {
    it('creates lookup map keyed by card id', () => {
        const lookup = createFailureLookupMap([
            {
                cardId: 'card-1',
                cardIndex: 0,
                card: { front: 'Q1', back: 'A1' },
                errorType: 'audio',
                errorMessage: 'Audio failed',
                timestamp: 1,
            },
            {
                cardId: 'card-2',
                cardIndex: 1,
                card: { front: 'Q2', back: 'A2' },
                errorType: 'image',
                errorMessage: 'Image failed',
                timestamp: 2,
            },
        ]);

        expect(lookup.get('card-1')?.errorMessage).toBe('Audio failed');
        expect(lookup.get('card-2')?.errorMessage).toBe('Image failed');
    });

    it('keeps the first failure entry for duplicate card ids', () => {
        const lookup = createFailureLookupMap([
            {
                cardId: 'card-1',
                cardIndex: 0,
                card: { front: 'Q1', back: 'A1' },
                errorType: 'audio',
                errorMessage: 'First',
                timestamp: 1,
            },
            {
                cardId: 'card-1',
                cardIndex: 0,
                card: { front: 'Q1', back: 'A1' },
                errorType: 'audio',
                errorMessage: 'Second',
                timestamp: 2,
            },
        ]);

        expect(lookup.get('card-1')?.errorMessage).toBe('First');
    });
});
