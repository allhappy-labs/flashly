import { describe, expect, it } from 'vitest';
import type { QuizEnrichment } from '@flashly/shared/src';

import { claimQuizReviewRevision, mergeGeneratedQuizReviews } from './quiz-enrichment-review-state';

const generatedQuiz: QuizEnrichment = {
    prompt: 'Which article belongs to Vater?',
    options: ['der', 'die', 'das'],
    correctAnswer: 'der',
    explanation: 'Vater is masculine.',
};

const editedQuiz: QuizEnrichment = {
    prompt: 'Which article belongs to Mutter?',
    options: ['der', 'die', 'das'],
    correctAnswer: 'die',
    explanation: 'Mutter is feminine.',
};

describe('mergeGeneratedQuizReviews', () => {
    it('preserves edits and removals made while generation is in flight', () => {
        const current = new Map<string, QuizEnrichment | null>([
            ['edited-card', editedQuiz],
            ['removed-card', null],
        ]);
        const proposals = new Map<string, QuizEnrichment>([
            ['edited-card', generatedQuiz],
            ['removed-card', generatedQuiz],
            ['new-card', generatedQuiz],
        ]);
        const requestRevisions = new Map<string, number>([
            ['edited-card', 0],
            ['removed-card', 0],
            ['new-card', 0],
        ]);
        const currentRevisions = new Map<string, number>([
            ['edited-card', 1],
            ['removed-card', 1],
        ]);

        const merged = mergeGeneratedQuizReviews(current, proposals, requestRevisions, currentRevisions);

        expect(merged.get('edited-card')).toEqual(editedQuiz);
        expect(merged.get('removed-card')).toBeNull();
        expect(merged.get('new-card')).toEqual(generatedQuiz);
    });

    it('prevents an older initial stream from overwriting a claimed regeneration', () => {
        const revisions = new Map<string, number>();
        const initialRequestRevisions = new Map<string, number>([['card-1', 0]]);
        const regenerationRevision = claimQuizReviewRevision(revisions, 'card-1');
        const regenerationRequestRevisions = new Map<string, number>([['card-1', regenerationRevision]]);

        const afterOlderInitialProposal = mergeGeneratedQuizReviews(
            new Map<string, QuizEnrichment | null>(),
            new Map([['card-1', generatedQuiz]]),
            initialRequestRevisions,
            revisions,
        );
        const regeneratedQuiz = {
            ...editedQuiz,
            prompt: 'Regenerated question',
        };
        const afterRegeneration = mergeGeneratedQuizReviews(
            afterOlderInitialProposal,
            new Map([['card-1', regeneratedQuiz]]),
            regenerationRequestRevisions,
            revisions,
        );

        expect(afterOlderInitialProposal.has('card-1')).toBe(false);
        expect(afterRegeneration.get('card-1')).toEqual(regeneratedQuiz);
    });
});
