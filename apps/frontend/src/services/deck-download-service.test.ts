import { describe, expect, it } from 'vitest';

import { buildDeckJsonl } from './deck-download-service';

describe('deck-download-service', () => {
    it('serializes valid quiz enrichment in deck JSONL', () => {
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

        const jsonlLine = buildDeckJsonl([source], new Map(), new Map());

        expect(JSON.parse(jsonlLine).quiz).toEqual(source.quiz);
    });

    it('omits invalid optional quiz enrichment without changing the card JSONL', () => {
        const jsonlLine = buildDeckJsonl([
            {
                front: 'Water',
                back: 'H2O',
                quiz: {
                    prompt: 'Choose one',
                    options: ['same', 'same'],
                    correctAnswer: 'same',
                    explanation: 'Duplicate options are invalid.',
                },
            },
        ], new Map(), new Map());

        const parsed: unknown = JSON.parse(jsonlLine);
        expect(parsed).toMatchObject({ front: 'Water', back: 'H2O' });
        expect(parsed).not.toHaveProperty('quiz');
    });
});
