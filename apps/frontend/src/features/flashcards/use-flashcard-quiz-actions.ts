import { useCallback, useState } from 'react';
import { QuizEnrichmentSchema, type QuizEnrichment } from '@flashly/shared/src';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';

import { bulkUpdateCardQuizzes } from '@/lib/api/deck-service';

export type QuizReview = Readonly<{ cardId: string; quiz: QuizEnrichment | null }>;

export function toQuizReviewUpdates(
    reviews: readonly QuizReview[],
): Array<{ cardId: string; quiz: QuizEnrichment | null }> {
    return reviews.map((review) => ({ cardId: review.cardId, quiz: review.quiz }));
}

type UseFlashcardQuizActionsParams = Readonly<{
    deckId: string | null;
    reviews: readonly QuizReview[];
    navigateToDeckEditor: (deckId: string) => void;
    t: TFunction;
}>;

export function useFlashcardQuizActions(params: UseFlashcardQuizActionsParams) {
    const [isSavingQuizEnrichments, setIsSavingQuizEnrichments] = useState(false);

    const handleSaveQuizEnrichments = useCallback(async () => {
        if (!params.deckId || isSavingQuizEnrichments) {
            return;
        }

        const invalidCount = params.reviews.filter(
            (review) => review.quiz !== null && !QuizEnrichmentSchema.safeParse(review.quiz).success,
        ).length;
        if (invalidCount > 0) {
            toast.error(params.t('web.flashcards.quizEnrichmentSaveInvalid', { count: invalidCount }));
            return;
        }
        if (params.reviews.length === 0) {
            return;
        }

        setIsSavingQuizEnrichments(true);
        try {
            const result = await bulkUpdateCardQuizzes(params.deckId, toQuizReviewUpdates(params.reviews));
            result.match(
                (data) => {
                    toast.success(params.t('web.flashcards.quizEnrichmentSaveSuccess', { count: data.count }));
                    params.navigateToDeckEditor(params.deckId ?? '');
                },
                (error) => toast.error(error.message || params.t('web.flashcards.quizEnrichmentSaveFailed')),
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : params.t('web.flashcards.quizEnrichmentSaveFailed');
            toast.error(message);
        } finally {
            setIsSavingQuizEnrichments(false);
        }
    }, [isSavingQuizEnrichments, params]);

    return { handleSaveQuizEnrichments, isSavingQuizEnrichments };
}
