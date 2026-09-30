import * as assert from 'node:assert';
import { test } from 'node:test';
import { FullSyncSchema } from '../lib/decks/deck-schema.ts';

test('full sync normalizes a malformed present quiz to null', () => {
    const parsed = FullSyncSchema.parse({
        clientDecks: [{
            id: 'deck-1',
            name: 'German nouns',
            cards: [{
                id: 'card-1',
                front: 'Vater',
                back: 'father',
                quiz: {
                    prompt: 'Which article belongs to Vater?',
                    options: ['der', 'der'],
                    correctAnswer: 'der',
                    explanation: 'Vater is masculine.',
                },
            }],
        }],
    });

    assert.strictEqual(parsed.clientDecks?.[0]?.cards?.[0]?.quiz, null);
});

test('full sync leaves an absent quiz undefined', () => {
    const parsed = FullSyncSchema.parse({
        clientDecks: [{
            id: 'deck-1',
            name: 'German nouns',
            cards: [{
                id: 'card-1',
                front: 'Vater',
                back: 'father',
            }],
        }],
    });

    assert.strictEqual(parsed.clientDecks?.[0]?.cards?.[0]?.quiz, undefined);
});
