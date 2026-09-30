import { validateBaseDeckLocale, type FlashcardMaterialType, type FlashcardsResponse, type SupportedLocale } from '@flashly/shared/src';

import {
    filterCardsNeedingAsset,
    mergeCardsByFront,
    type DeckZipParseResult,
    type ImportConfirmOptions,
} from '../../../utils/deck-zip';

type GeneratedDeckSummary = Readonly<{
    locale: SupportedLocale;
    flashcards: FlashcardsResponse;
}>;

export type DeckImportProcessingInput = Readonly<{
    uploadedDeck: DeckZipParseResult;
    options: ImportConfirmOptions;
    currentFlashcards: FlashcardsResponse['flashcards'];
    generatedDecks: readonly GeneratedDeckSummary[];
    materialType: FlashcardMaterialType;
    selectedLanguageLocale: SupportedLocale | null;
}>;

export type DeckImportProcessingResult =
    | Readonly<{
          ok: false;
          reason: 'LOCALE_MISMATCH';
          detectedLocale: SupportedLocale | null;
      }>
    | Readonly<{
          ok: true;
          cards: FlashcardsResponse['flashcards'];
          detectedLocale: SupportedLocale | null;
          deckName: string | null;
          enableDeckBasedTranslation: boolean;
          missingAudioToRegenerate: number;
          missingImagesToRegenerate: number;
      }>;

export function processDeckImport(input: DeckImportProcessingInput): DeckImportProcessingResult {
    const detectedLocale = input.uploadedDeck.locale;
    let cards = input.uploadedDeck.cards;

    if (input.options.mode === 'update') {
        cards = mergeCardsByFront(input.currentFlashcards, cards);
    }

    if (input.options.useAsBaseDeck && detectedLocale) {
        const currentDeckLocale = input.generatedDecks.length > 0
            ? input.generatedDecks[0].locale
            : (input.materialType === 'Language' ? input.selectedLanguageLocale : null);

        const validation = validateBaseDeckLocale(currentDeckLocale, detectedLocale);
        if (!validation.valid) {
            return {
                ok: false,
                reason: 'LOCALE_MISMATCH',
                detectedLocale,
            };
        }
    }

    const missingAudioToRegenerate = input.options.regenerate.audio
        ? filterCardsNeedingAsset(cards, input.options.regenerate.regenerateExisting, 'audio').length
        : 0;
    const missingImagesToRegenerate = input.options.regenerate.images
        ? filterCardsNeedingAsset(cards, input.options.regenerate.regenerateExisting, 'image').length
        : 0;

    return {
        ok: true,
        cards,
        detectedLocale,
        deckName: input.uploadedDeck.config?.deck?.name ?? null,
        enableDeckBasedTranslation: Boolean(input.options.useAsBaseDeck && detectedLocale),
        missingAudioToRegenerate,
        missingImagesToRegenerate,
    };
}
