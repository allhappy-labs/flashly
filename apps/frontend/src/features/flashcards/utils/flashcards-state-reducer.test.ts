import { describe, expect, it } from 'vitest';

import { flashcardsReducer, initialFlashcardsState, type FlashcardsState } from './flashcards-state-reducer';

function createCard(front: string, back: string, extras?: Record<string, unknown>) {
    return {
        front,
        back,
        ...extras,
    };
}

function createState(): FlashcardsState {
    return {
        flashcards: {
            flashcards: [
                createCard('A', '1', { audioUrl: null, imageUrl: null }),
                createCard('B', '2', { audioUrl: 'old-audio', imageUrl: null }),
            ],
        },
        streamedCards: [
            createCard('A', '1', { audioUrl: null, imageUrl: null }),
            createCard('B', '2', { audioUrl: 'old-audio', imageUrl: null }),
        ],
        generatedDecks: [
            {
                locale: 'eng',
                flashcards: {
                    flashcards: [
                        createCard('A', '1', { audioUrl: null, imageUrl: null }),
                        createCard('B', '2', { audioUrl: 'old-audio', imageUrl: null }),
                    ],
                },
            },
        ],
    };
}

describe('flashcards-state-reducer', () => {
    it('resets to initial state', () => {
        const next = flashcardsReducer(createState(), { type: 'RESET' });
        expect(next).toEqual(initialFlashcardsState);
    });

    it('updates audio while preserving image fields', () => {
        const next = flashcardsReducer(createState(), {
            type: 'UPDATE_WITH_AUDIO',
            payload: [
                createCard('A', '1', { audioUrl: 'new-a', imageUrl: 'img-a' }),
                createCard('B', '2', { audioUrl: 'new-b', imageUrl: 'img-b' }),
            ],
        });

        expect(next.flashcards?.flashcards[0]).toMatchObject({ front: 'A', audioUrl: 'new-a', imageUrl: null });
        expect(next.flashcards?.flashcards[1]).toMatchObject({ front: 'B', audioUrl: 'new-b', imageUrl: null });
        expect(next.streamedCards[0]).toMatchObject({ audioUrl: 'new-a', imageUrl: null });
        expect(next.generatedDecks[0]?.flashcards.flashcards[1]).toMatchObject({ audioUrl: 'new-b', imageUrl: null });
    });

    it('updates images while preserving audio fields', () => {
        const next = flashcardsReducer(createState(), {
            type: 'UPDATE_WITH_IMAGES',
            payload: [
                createCard('A', '1', { imageUrl: 'img-a', audioUrl: 'ignore-a' }),
                createCard('B', '2', { imageUrl: 'img-b', audioUrl: 'ignore-b' }),
            ],
        });

        expect(next.flashcards?.flashcards[0]).toMatchObject({ front: 'A', imageUrl: 'img-a', audioUrl: null });
        expect(next.flashcards?.flashcards[1]).toMatchObject({ front: 'B', imageUrl: 'img-b', audioUrl: 'old-audio' });
    });

    it('updates card front at index across flashcards, streamed cards, and generated decks', () => {
        const next = flashcardsReducer(createState(), {
            type: 'UPDATE_CARD_FRONT_AT_INDEX',
            payload: {
                index: 1,
                front: 'Updated B',
            },
        });

        expect(next.flashcards?.flashcards[0]?.front).toBe('A');
        expect(next.flashcards?.flashcards[1]?.front).toBe('Updated B');
        expect(next.streamedCards[1]?.front).toBe('Updated B');
        expect(next.generatedDecks[0]?.flashcards.flashcards[1]?.front).toBe('Updated B');
    });

    it('updates only the selected card quiz across generated card state', () => {
        const next = flashcardsReducer(createState(), {
            type: 'UPDATE_CARD_QUIZ_AT_INDEX',
            payload: {
                index: 1,
                quiz: {
                    prompt: 'Which value belongs to B?',
                    options: ['1', '2'],
                    correctAnswer: '2',
                    explanation: 'B maps to 2.',
                },
            },
        });

        expect(next.flashcards?.flashcards[0]?.quiz).toBeUndefined();
        expect(next.flashcards?.flashcards[1]?.quiz).toEqual({
            prompt: 'Which value belongs to B?',
            options: ['1', '2'],
            correctAnswer: '2',
            explanation: 'B maps to 2.',
        });
        expect(next.flashcards?.flashcards[1]?.front).toBe('B');
        expect(next.streamedCards[1]?.quiz?.correctAnswer).toBe('2');
        expect(next.generatedDecks[0]?.flashcards.flashcards[1]?.quiz?.explanation).toBe('B maps to 2.');
    });

    it('removes card at index across flashcards, streamed cards, and generated decks', () => {
        const next = flashcardsReducer(createState(), {
            type: 'REMOVE_CARD_AT_INDEX',
            payload: {
                index: 0,
            },
        });

        expect(next.flashcards?.flashcards).toHaveLength(1);
        expect(next.flashcards?.flashcards[0]?.front).toBe('B');
        expect(next.streamedCards).toHaveLength(1);
        expect(next.streamedCards[0]?.front).toBe('B');
        expect(next.generatedDecks[0]?.flashcards.flashcards).toHaveLength(1);
        expect(next.generatedDecks[0]?.flashcards.flashcards[0]?.front).toBe('B');
    });
});
