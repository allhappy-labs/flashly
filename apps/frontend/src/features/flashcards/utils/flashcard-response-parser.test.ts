import { describe, expect, it } from 'vitest';
import { FlashcardResponseError, parseFlashcardsResponse } from '@flashly/shared/src';

describe('flashcard response parser contract', () => {
    it('parses valid JSONL flashcards', () => {
        const parsed = parseFlashcardsResponse('{"front":"Hola","back":"Hello"}\n{"front":"Adiós","back":"Goodbye"}');
        expect(parsed.flashcards).toEqual([
            { front: 'Hola', back: 'Hello' },
            { front: 'Adiós', back: 'Goodbye' },
        ]);
    });

    it('keeps valid quiz enrichment on a generated card', () => {
        const parsed = parseFlashcardsResponse(
            '{"front":"Vater","back":"father","quiz":{"prompt":"Which article?","options":["der","die","das"],"correctAnswer":"der","explanation":"Vater is masculine."}}',
        );

        expect(parsed.flashcards[0]?.quiz).toEqual({
            prompt: 'Which article?',
            options: ['der', 'die', 'das'],
            correctAnswer: 'der',
            explanation: 'Vater is masculine.',
        });
    });

    it('drops invalid optional quiz data without dropping the card', () => {
        const parsed = parseFlashcardsResponse(
            '{"front":"Vater","back":"father","quiz":{"prompt":"Which article?","options":["der","der"],"correctAnswer":"der","explanation":"Rule."}}',
        );

        expect(parsed.flashcards).toHaveLength(1);
        expect(parsed.flashcards[0]?.quiz).toBeUndefined();
    });

    it('drops quiz enrichment with undeclared fields without dropping the card', () => {
        const parsed = parseFlashcardsResponse(
            '{"front":"Vater","back":"father","quiz":{"prompt":"Which article?","options":["der","die","das"],"correctAnswer":"der","explanation":"Rule.","unexpected":"value"}}',
        );

        expect(parsed.flashcards).toHaveLength(1);
        expect(parsed.flashcards[0]?.quiz).toBeUndefined();
    });

    it('maps structured model error envelope to a safe error code', () => {
        expect(() => parseFlashcardsResponse(
            '{"error":{"code":"INSUFFICIENT_SOURCE","message":"No source text available"}}',
        )).toThrowError(FlashcardResponseError);

        try {
            parseFlashcardsResponse('{"error":{"code":"INSUFFICIENT_SOURCE","message":"No source text available"}}');
        } catch (error) {
            expect(error).toBeInstanceOf(FlashcardResponseError);
            if (error instanceof FlashcardResponseError) {
                expect(error.code).toBe('INSUFFICIENT_SOURCE');
                expect(error.message).toBe(
                    'Not enough information to generate flashcards. Add source material or a clearer instruction.',
                );
            }
        }
    });

    it('maps raw prose to a generic parse-safe error', () => {
        expect(() => parseFlashcardsResponse('I cannot generate flashcards without study material.')).toThrowError(
            FlashcardResponseError,
        );
        try {
            parseFlashcardsResponse('I cannot generate flashcards without study material.');
        } catch (error) {
            expect(error).toBeInstanceOf(FlashcardResponseError);
            if (error instanceof FlashcardResponseError) {
                expect(error.code).toBe('PARSE_ERROR');
                expect(error.message).toBe('Unable to generate flashcards from the model response. Please try again.');
            }
        }
    });
});
