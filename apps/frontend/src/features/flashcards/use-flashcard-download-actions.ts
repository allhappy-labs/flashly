import { useCallback } from 'react';
import {
    getDeckTransferFormatAdapter,
    type DeckTransferFormatId,
    type FlashcardFormat,
    type FlashcardMaterialType,
    type FlashcardsResponse,
    type SupportedLocale,
} from '@flashly/shared/src';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';

import { downloadDeckAsFlashly } from '@/services/deck-download-service';
import { sanitizeDownloadFileName } from './utils/flashcard-generator-utils';
import { toDeckTransferPayload, triggerBrowserDownload } from './utils/flashcard-generator-io-utils';

type GeneratedDeckEntry = Readonly<{
    locale: SupportedLocale;
    flashcards: FlashcardsResponse;
}>;

type UseFlashcardDownloadActionsParams = Readonly<{
    deckName: string;
    flashcards: FlashcardsResponse | null;
    generatedDecks: readonly GeneratedDeckEntry[];
    materialType: FlashcardMaterialType;
    format: FlashcardFormat;
    baseLocale: SupportedLocale;
    t: TFunction;
}>;

export function useFlashcardDownloadActions(params: UseFlashcardDownloadActionsParams) {
    const handleDownloadZip = useCallback(
        async (deck: FlashcardsResponse, locale: SupportedLocale) => {
            if (!deck.flashcards.length) {
                toast.error(params.t('web.flashcards.noDownloadYet'));
                return;
            }
            try {
                await downloadDeckAsFlashly({
                    deckName: params.deckName.trim() || 'Generated deck',
                    cards: deck.flashcards,
                    locale,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : params.t('web.flashcards.downloadFailed');
                toast.error(message);
            }
        },
        [params.deckName, params.t],
    );

    const handleDownloadTransfer = useCallback((formatId: DeckTransferFormatId) => {
        if (!params.flashcards || params.flashcards.flashcards.length === 0) {
            toast.error(params.t('web.flashcards.noDownloadYet'));
            return;
        }

        try {
            const adapter = getDeckTransferFormatAdapter(formatId);
            const payload = toDeckTransferPayload(
                params.deckName.trim() || 'Generated deck',
                params.generatedDecks[0]?.locale ?? params.baseLocale,
                params.materialType,
                params.format,
                params.flashcards.flashcards,
            );
            const content = adapter.exportToText(payload);
            const filename = `${sanitizeDownloadFileName(payload.deck.name)}.${adapter.extension}`;
            triggerBrowserDownload(filename, content, adapter.mimeType);
            toast.success(params.t('decks.transfer.export.success'));
        } catch (error) {
            const message = error instanceof Error ? error.message : params.t('decks.transfer.export.error');
            toast.error(message);
        }
    }, [params.baseLocale, params.deckName, params.flashcards, params.format, params.generatedDecks, params.materialType, params.t]);

    return {
        handleDownloadZip,
        handleDownloadTransfer,
    };
}
