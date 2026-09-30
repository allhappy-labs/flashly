import { describe, expect, it } from 'vitest';

import { parseFlashcardsJsonl, type FlashcardsResponse } from '@flashly/shared/src';

import type { DeckZipParseResult, ImportConfirmOptions } from '../../../utils/deck-zip';
import { processDeckImport } from './deck-import-processing';

function createCard(front: string, back: string, extras?: Record<string, unknown>): FlashcardsResponse['flashcards'][number] {
    return {
        front,
        back,
        ...extras,
    };
}

function createUploadedDeck(overrides?: Partial<DeckZipParseResult>): DeckZipParseResult {
    return {
        cards: [
            createCard('Alpha', 'A', { audioUrl: 'audio-a' }),
            createCard('Beta', 'B'),
        ],
        config: {
            version: 1,
            deck: {
                name: 'Imported Deck',
                locale: 'eng',
                materialType: 'Language',
            },
        },
        fileName: 'sample.flashly',
        locale: 'eng',
        ...overrides,
    };
}

function createOptions(overrides?: Partial<ImportConfirmOptions>): ImportConfirmOptions {
    return {
        mode: 'create',
        regenerate: {
            audio: false,
            images: false,
            regenerateExisting: false,
        },
        useAsBaseDeck: false,
        ...overrides,
    };
}

describe('deck-import-processing', () => {
    it('merges imported cards in update mode and preserves deck name', () => {
        const existing = [createCard('Alpha', 'Existing A'), createCard('Gamma', 'G')];
        const result = processDeckImport({
            uploadedDeck: createUploadedDeck(),
            options: createOptions({ mode: 'update' }),
            currentFlashcards: existing,
            generatedDecks: [],
            materialType: 'General',
            selectedLanguageLocale: null,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }
        expect(result.cards.map((card) => card.front)).toEqual(['Alpha', 'Gamma', 'Beta']);
        expect(result.deckName).toBe('Imported Deck');
    });

    it('rejects base-deck import when detected locale conflicts with generated deck locale', () => {
        const result = processDeckImport({
            uploadedDeck: createUploadedDeck({ locale: 'spa' }),
            options: createOptions({ useAsBaseDeck: true }),
            currentFlashcards: [],
            generatedDecks: [
                {
                    locale: 'eng',
                    flashcards: { flashcards: [] },
                },
            ],
            materialType: 'Language',
            selectedLanguageLocale: 'eng',
        });

        expect(result).toEqual({
            ok: false,
            reason: 'LOCALE_MISMATCH',
            detectedLocale: 'spa',
        });
    });

    it('uses selected language locale when no generated decks exist', () => {
        const result = processDeckImport({
            uploadedDeck: createUploadedDeck({ locale: 'eng' }),
            options: createOptions({ useAsBaseDeck: true }),
            currentFlashcards: [],
            generatedDecks: [],
            materialType: 'Language',
            selectedLanguageLocale: 'eng',
        });

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }
        expect(result.enableDeckBasedTranslation).toBe(true);
    });

    it('computes regeneration counts based on missing assets and regenerateExisting flag', () => {
        const uploadedDeck = createUploadedDeck({
            cards: [
                createCard('A', '1', { audioUrl: 'audio-a', imageUrl: 'img-a' }),
                createCard('B', '2', { audioUrl: '', imageUrl: null }),
                createCard('C', '3', { audioUrl: undefined, imageUrl: 'img-c' }),
            ],
        });

        const result = processDeckImport({
            uploadedDeck,
            options: createOptions({
                regenerate: {
                    audio: true,
                    images: true,
                    regenerateExisting: false,
                },
            }),
            currentFlashcards: [],
            generatedDecks: [],
            materialType: 'General',
            selectedLanguageLocale: null,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }
        expect(result.missingAudioToRegenerate).toBe(2);
        expect(result.missingImagesToRegenerate).toBe(1);
    });

    it('keeps legacy cards and drops invalid optional quiz enrichment during import', () => {
        const parsed = parseFlashcardsJsonl([
            JSON.stringify({ front: 'Legacy', back: 'Card' }),
            JSON.stringify({
                front: 'Invalid quiz',
                back: 'Still a card',
                quiz: {
                    prompt: 'Choose one',
                    options: ['same', 'same'],
                    correctAnswer: 'same',
                    explanation: 'Duplicate options are invalid.',
                },
            }),
        ].join('\n'));
        const result = processDeckImport({
            uploadedDeck: createUploadedDeck({ cards: parsed.flashcards }),
            options: createOptions(),
            currentFlashcards: [],
            generatedDecks: [],
            materialType: 'General',
            selectedLanguageLocale: null,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.cards).toHaveLength(2);
        expect(result.cards[0]?.quiz).toBeUndefined();
        expect(result.cards[1]?.quiz).toBeUndefined();
    });
});
