import { describe, expect, it } from 'vitest';

import {
    parseFlashcardStreamLine,
    resolveStreamedFlashcards,
    splitStreamTextChunk,
} from './flashcard-stream-parser';

describe('flashcard-stream-parser', () => {
    it('splits buffered chunks into complete lines and remainder', () => {
        const first = splitStreamTextChunk('', '{"front":"A","back":"B"}\n{"front":"C"');
        expect(first.lines).toEqual(['{"front":"A","back":"B"}']);
        expect(first.buffer).toBe('{"front":"C"');

        const second = splitStreamTextChunk(first.buffer, ',"back":"D"}\n');
        expect(second.lines).toEqual(['{"front":"C","back":"D"}']);
        expect(second.buffer).toBe('');
    });

    it('parses valid flashcard JSONL lines', () => {
        const result = parseFlashcardStreamLine('{"front":"Hola","back":"Hello"}');
        expect(result.kind).toBe('parsed');
        if (result.kind === 'parsed') {
            expect(result.card.front).toBe('Hola');
            expect(result.card.back).toBe('Hello');
        }
    });

    it('returns invalid-json for malformed JSON', () => {
        const result = parseFlashcardStreamLine('{"front":"Hola",');
        expect(result.kind).toBe('invalid-json');
    });

    it('returns invalid-schema for schema-invalid JSON', () => {
        const result = parseFlashcardStreamLine('{"front":"Hola"}');
        expect(result.kind).toBe('invalid-schema');
    });

    it('returns empty for blank lines', () => {
        expect(parseFlashcardStreamLine('   ')).toEqual({ kind: 'empty' });
    });

    it('prefers streamed cards over fallback text parsing', () => {
        const cards = [{ front: 'A', back: 'B' }];
        const result = resolveStreamedFlashcards(cards, '{"flashcards":[{"front":"X","back":"Y"}]}');
        expect(result.flashcards).toEqual(cards);
    });

    it('falls back to parsing text when no streamed cards were collected', () => {
        const result = resolveStreamedFlashcards([], '{"flashcards":[{"front":"X","back":"Y"}]}');
        expect(result.flashcards).toEqual([{ front: 'X', back: 'Y' }]);
    });
});
