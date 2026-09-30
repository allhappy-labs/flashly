import {
    normalizeQuizEnrichment,
    type DeckTransferPayload,
    type FlashcardsResponse,
    type SupportedLocale,
} from '@flashly/shared/src';

import { DeckZipError } from '../../../utils/deck-zip';

import { serializeGeneratedExample, serializeGeneratedTags } from './flashcard-generator-utils';

const DECK_ZIP_ERROR_CODES = new Set<string>(Object.values(DeckZipError));

function getObjectProperty(value: unknown, key: string): unknown {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    return Reflect.get(value, key);
}

export function normalizeAppendDeckId(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function toDeckTransferPayload(
    deckName: string,
    locale: SupportedLocale | string | null,
    materialType: string,
    deckType: string,
    cards: FlashcardsResponse['flashcards'],
): DeckTransferPayload {
    return {
        deck: {
            name: deckName.trim() || 'Generated deck',
            locale,
            materialType,
            deckType,
        },
        cards: cards.map((card) => ({
            front: (card.front ?? '').trim(),
            back: (card.back ?? '').trim(),
            imageUrl: typeof card.imageUrl === 'string' ? card.imageUrl : null,
            audioUrl: typeof card.audioUrl === 'string' ? card.audioUrl : null,
            category: typeof card.category === 'string' ? card.category : null,
            pos: typeof card.pos === 'string' ? card.pos : null,
            gender: typeof card.gender === 'string' ? card.gender : null,
            example: serializeGeneratedExample(card.example) ?? null,
            tags: serializeGeneratedTags(card.tags) ?? null,
            quiz: normalizeQuizEnrichment(card.quiz),
        })),
    };
}

export function triggerBrowserDownload(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function isDeckZipErrorCode(value: unknown): value is DeckZipError {
    return typeof value === 'string' && DECK_ZIP_ERROR_CODES.has(value);
}

export function getDeckZipErrorCode(error: unknown): DeckZipError | null {
    if (!(error instanceof Error)) {
        return null;
    }
    const code = getObjectProperty(error, 'code');
    return isDeckZipErrorCode(code) ? code : null;
}
