import { DeckZipError } from '../../../utils/deck-zip';

export type DeckImportMessageDescriptor = Readonly<{
    key: string;
    hintKey?: string;
}>;

export function getDeckImportMessageDescriptor(errorCode: DeckZipError): DeckImportMessageDescriptor {
    switch (errorCode) {
        case DeckZipError.UNSUPPORTED_FORMAT:
            return {
                key: 'web.flashcards.deckImport.unsupportedFormat',
                hintKey: 'web.flashcards.deckImport.unsupportedFormatHint',
            };
        case DeckZipError.MISSING_DECK_JSONL:
            return { key: 'web.flashcards.deckImport.missingDeckJsonl' };
        case DeckZipError.MISSING_CONFIG:
            return { key: 'web.flashcards.deckImport.missingConfig' };
        case DeckZipError.INVALID_LOCALE:
            return { key: 'web.flashcards.deckImport.missingLocale' };
        case DeckZipError.NO_CARDS:
            return { key: 'web.flashcards.deckImport.noCardsFound' };
        case DeckZipError.PARSE_ERROR:
            return { key: 'web.flashcards.deckImport.parseError' };
    }
}
