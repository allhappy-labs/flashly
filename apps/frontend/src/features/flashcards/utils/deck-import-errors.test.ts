import { describe, expect, it } from 'vitest';

import { DeckZipError } from '../../../utils/deck-zip';
import { getDeckImportMessageDescriptor } from './deck-import-errors';

describe('deck-import-errors', () => {
    it('maps unsupported format to message and hint keys', () => {
        expect(getDeckImportMessageDescriptor(DeckZipError.UNSUPPORTED_FORMAT)).toEqual({
            key: 'web.flashcards.deckImport.unsupportedFormat',
            hintKey: 'web.flashcards.deckImport.unsupportedFormatHint',
        });
    });

    it('maps parse error to parse-error translation key', () => {
        expect(getDeckImportMessageDescriptor(DeckZipError.PARSE_ERROR)).toEqual({
            key: 'web.flashcards.deckImport.parseError',
        });
    });
});
