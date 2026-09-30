import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { FlashcardsResponse } from '@flashly/shared/src';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';

import { bulkCreateCards } from '@/lib/api/deck-service';
import { toAppendDeckCardInputs } from './utils/flashcard-generator-utils';

type UseFlashcardAppendActionsParams = Readonly<{
    appendDeckId: string | null;
    appendDeckName: string | null;
    appendableGeneratedCards: readonly FlashcardsResponse['flashcards'][number][];
    isAppendingToDeck: boolean;
    setIsAppendingToDeck: Dispatch<SetStateAction<boolean>>;
    clearAppendPrefilledDeckId: () => void;
    navigateToGenerate: () => void;
    navigateToDeckEditor: (deckId: string) => void;
    t: TFunction;
}>;

export function useFlashcardAppendActions(params: UseFlashcardAppendActionsParams) {
    const handleExitAppendMode = useCallback(() => {
        params.clearAppendPrefilledDeckId();
        params.navigateToGenerate();
    }, [params.clearAppendPrefilledDeckId, params.navigateToGenerate]);

    const handleAppendToDeck = useCallback(async () => {
        if (!params.appendDeckId || !params.appendDeckName || params.isAppendingToDeck) {
            return;
        }
        const appendDeckId = params.appendDeckId;

        const cardsToAppend = toAppendDeckCardInputs(params.appendableGeneratedCards);

        if (cardsToAppend.length === 0) {
            toast.error(params.t('web.flashcards.append.noNewCards'));
            return;
        }

        params.setIsAppendingToDeck(true);
        try {
            const result = await bulkCreateCards(appendDeckId, cardsToAppend);
            result.match(
                (data) => {
                    toast.success(
                        params.t('web.flashcards.append.success', {
                            created: data.count,
                            skipped: data.skippedDuplicates,
                            deck: params.appendDeckName,
                        }),
                    );
                    params.navigateToDeckEditor(appendDeckId);
                },
                (apiError) => {
                    toast.error(apiError.message || params.t('web.flashcards.append.error'));
                },
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : params.t('web.flashcards.append.error');
            toast.error(message);
        } finally {
            params.setIsAppendingToDeck(false);
        }
    }, [
        params.appendDeckId,
        params.appendDeckName,
        params.appendableGeneratedCards,
        params.isAppendingToDeck,
        params.navigateToDeckEditor,
        params.setIsAppendingToDeck,
        params.t,
    ]);

    return {
        handleAppendToDeck,
        handleExitAppendMode,
    };
}
