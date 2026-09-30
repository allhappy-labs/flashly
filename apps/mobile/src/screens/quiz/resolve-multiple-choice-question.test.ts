import { describe, expect, it } from 'vitest';

import { resolveMultipleChoiceQuestion } from './resolve-multiple-choice-question';

const noShuffle = () => 0.999999;

describe('resolveMultipleChoiceQuestion', () => {
    it('uses valid curated enrichment instead of deck-derived choices', () => {
        const question = resolveMultipleChoiceQuestion(
            {
                prompt: 'Which city is the capital of France?',
                answer: 'Paris',
                distractors: ['Lyon', 'Marseille'],
                quiz: {
                    prompt: 'Which city contains the Eiffel Tower?',
                    options: ['Paris', 'Berlin', 'Rome'],
                    correctAnswer: 'Paris',
                    explanation: 'The Eiffel Tower is in Paris.',
                },
            },
            noShuffle,
        );

        expect(question).toEqual({
            kind: 'multiple_choice',
            prompt: 'Which city contains the Eiffel Tower?',
            answer: 'Paris',
            options: ['Paris', 'Berlin', 'Rome'],
            explanation: 'The Eiffel Tower is in Paris.',
            source: 'curated',
        });
    });

    it('shuffles curated options while retaining the curated answer', () => {
        const question = resolveMultipleChoiceQuestion(
            {
                prompt: 'Capital?',
                answer: 'Paris',
                distractors: ['Lyon', 'Marseille'],
                quiz: {
                    prompt: 'Curated capital?',
                    options: ['Paris', 'Berlin', 'Rome'],
                    correctAnswer: 'Paris',
                    explanation: 'Paris is the capital of France.',
                },
            },
            () => 0,
        );

        expect(question).toMatchObject({
            kind: 'multiple_choice',
            answer: 'Paris',
            options: ['Berlin', 'Rome', 'Paris'],
            source: 'curated',
        });
    });

    it('uses generic choices when enrichment is invalid', () => {
        const question = resolveMultipleChoiceQuestion(
            {
                prompt: 'Capital?',
                answer: 'Paris',
                distractors: ['Lyon', 'Marseille'],
                quiz: {
                    prompt: 'Invalid',
                    options: ['Paris', 'Paris'],
                    correctAnswer: 'Paris',
                    explanation: 'Duplicate options are invalid.',
                },
            },
            noShuffle,
        );

        expect(question).toEqual({
            kind: 'multiple_choice',
            prompt: 'Capital?',
            answer: 'Paris',
            options: ['Paris', 'Lyon', 'Marseille'],
            source: 'generic',
        });
    });

    it('uses generic choices when enrichment is absent', () => {
        const question = resolveMultipleChoiceQuestion(
            {
                prompt: 'Capital?',
                answer: 'Paris',
                distractors: ['Lyon', 'Marseille'],
            },
            noShuffle,
        );

        expect(question).toEqual({
            kind: 'multiple_choice',
            prompt: 'Capital?',
            answer: 'Paris',
            options: ['Paris', 'Lyon', 'Marseille'],
            source: 'generic',
        });
    });

    it('deduplicates repeated generic answers', () => {
        const question = resolveMultipleChoiceQuestion(
            {
                prompt: 'Capital?',
                answer: 'Paris',
                distractors: ['Paris', 'Lyon', 'Lyon', 'Marseille'],
            },
            noShuffle,
        );

        expect(question).toMatchObject({
            kind: 'multiple_choice',
            options: ['Paris', 'Lyon', 'Marseille'],
            source: 'generic',
        });
    });

    it('falls back to written recall when generic choices do not contain two unique answers', () => {
        const question = resolveMultipleChoiceQuestion(
            {
                prompt: 'Capital?',
                answer: 'Paris',
                distractors: ['Paris', 'Paris'],
            },
            noShuffle,
        );

        expect(question).toEqual({
            kind: 'written_fallback',
            prompt: 'Capital?',
            answer: 'Paris',
        });
    });

    it('only includes explanations for curated questions', () => {
        const question = resolveMultipleChoiceQuestion(
            {
                prompt: 'Capital?',
                answer: 'Paris',
                distractors: ['Lyon', 'Marseille'],
            },
            noShuffle,
        );

        expect(question).not.toHaveProperty('explanation');
    });
});
