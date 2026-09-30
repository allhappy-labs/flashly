import { describe, expect, it } from 'vitest';

import { DeckZipError } from '../../../utils/deck-zip';

import { getDeckZipErrorCode, normalizeAppendDeckId, toDeckTransferPayload } from './flashcard-generator-io-utils';

describe('flashcard-generator-io-utils', () => {
    it('builds deck transfer payload with normalized fields', () => {
        const payload = toDeckTransferPayload('  My Deck  ', 'eng', 'Language', 'QA', [
            {
                front: ' Hola ',
                back: ' Hello ',
                imageUrl: 'https://example.com/image.png',
                audioUrl: undefined,
                category: ' greetings ',
                pos: undefined,
                gender: undefined,
                example: {
                    target: 'Hola',
                    english: 'Hello',
                    romanization: '',
                },
                tags: [' basics ', ' greeting '],
            },
        ]);

        expect(payload.deck.name).toBe('My Deck');
        expect(payload.cards[0]).toMatchObject({
            front: 'Hola',
            back: 'Hello',
            category: ' greetings ',
            example: 'Hola | Hello',
            tags: 'basics; greeting',
        });
    });

    it('falls back to default deck name when empty', () => {
        const payload = toDeckTransferPayload('', 'eng', 'Language', 'QA', []);
        expect(payload.deck.name).toBe('Generated deck');
    });

    it('preserves valid quiz enrichment in deck transfer payloads', () => {
        const source = {
            front: 'Water',
            back: 'H2O',
            quiz: {
                prompt: 'Which state change is evaporation?',
                options: ['liquid to gas', 'gas to liquid'],
                correctAnswer: 'liquid to gas',
                explanation: 'Evaporation changes a liquid into a gas.',
            },
        };

        const payload = toDeckTransferPayload('Science', 'eng', 'General', 'QA', [source]);

        expect(payload.cards[0]?.quiz).toEqual(source.quiz);
    });

    it('extracts known deck zip error codes from Error objects', () => {
        const error = new Error('bad zip') as Error & { code?: string };
        error.code = DeckZipError.MISSING_CONFIG;

        expect(getDeckZipErrorCode(error)).toBe(DeckZipError.MISSING_CONFIG);
        expect(getDeckZipErrorCode(new Error('other'))).toBeNull();
        expect(getDeckZipErrorCode({ code: DeckZipError.MISSING_CONFIG })).toBeNull();
    });

    it('normalizes append deck id values', () => {
        expect(normalizeAppendDeckId(' deck_123 ')).toBe('deck_123');
        expect(normalizeAppendDeckId('')).toBeNull();
        expect(normalizeAppendDeckId('   ')).toBeNull();
        expect(normalizeAppendDeckId(undefined)).toBeNull();
    });
});
