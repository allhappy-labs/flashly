import { describe, expect, it } from 'vitest';
import type { QuizEnrichment } from '@flashly/shared/src';

import { toQuizReviewUpdates } from './use-flashcard-quiz-actions';

const quiz: QuizEnrichment = {
    prompt: 'Which article belongs to Vater?',
    options: ['der', 'die', 'das'],
    correctAnswer: 'der',
    explanation: 'Vater is masculine.',
};

describe('toQuizReviewUpdates', () => {
    it('builds a quiz-only bulk save payload keyed by canonical card ID', () => {
        const reviews = [
            { cardId: 'card-1', quiz, ignored: 'not persisted' },
            { cardId: 'card-2', quiz: null, ignored: 'not persisted' },
        ];

        const updates = toQuizReviewUpdates(reviews);

        expect(updates).toEqual([
            { cardId: 'card-1', quiz },
            { cardId: 'card-2', quiz: null },
        ]);
    });
});
