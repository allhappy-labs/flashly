import { FlashcardSchema, parseFlashcardsResponse, type FlashcardsResponse } from '@flashly/shared/src';

export type ParsedFlashcardStreamLine =
    | { kind: 'empty' }
    | { kind: 'parsed'; card: FlashcardsResponse['flashcards'][number] }
    | { kind: 'invalid-schema'; formattedError: unknown }
    | { kind: 'invalid-json'; error: unknown; preview: string };

export function splitStreamTextChunk(buffer: string, chunk: string): { lines: string[]; buffer: string } {
    const next = `${buffer}${chunk}`;
    const parts = next.split(/\r?\n/);
    return {
        lines: parts.slice(0, -1),
        buffer: parts.at(-1) ?? '',
    };
}

export function parseFlashcardStreamLine(line: string): ParsedFlashcardStreamLine {
    const trimmed = line.trim();
    if (!trimmed) {
        return { kind: 'empty' };
    }

    try {
        const parsed = JSON.parse(trimmed);
        const result = FlashcardSchema.safeParse(parsed);

        if (result.success) {
            return { kind: 'parsed', card: result.data };
        }

        return {
            kind: 'invalid-schema',
            formattedError: result.error.format(),
        };
    } catch (error) {
        return {
            kind: 'invalid-json',
            error,
            preview: trimmed.substring(0, 200),
        };
    }
}

export function resolveStreamedFlashcards(
    cards: FlashcardsResponse['flashcards'],
    text: string,
): FlashcardsResponse {
    return cards.length > 0 ? { flashcards: cards } : parseFlashcardsResponse(text);
}
