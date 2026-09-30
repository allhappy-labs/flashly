import { describe, expect, it } from 'vitest';

import {
    getStableCardId,
    isFlashcardFormatValue,
    isFlashcardMaterialTypeValue,
    normalizeFrontKey,
    sanitizeDownloadFileName,
    toAppendDeckCardInput,
    toAppendDeckCardInputs,
    serializeGeneratedExample,
    serializeGeneratedTags,
} from './flashcard-generator-utils';

describe('flashcard-generator-utils', () => {
    it('normalizes front keys for duplicate checks', () => {
        expect(normalizeFrontKey('  Hello World  ')).toBe('hello world');
        expect(normalizeFrontKey(null)).toBe('');
    });

    it('generates stable ids from explicit numeric ids when present', () => {
        expect(getStableCardId({ id: 42, front: 'A', back: 'B' })).toBe('card-42');
    });

    it('generates deterministic stable ids from card content', () => {
        const first = getStableCardId({ front: 'Hola', back: 'Hello' });
        const second = getStableCardId({ front: 'Hola', back: 'Hello' });
        const different = getStableCardId({ front: 'Adios', back: 'Goodbye' });

        expect(first).toBe(second);
        expect(first).not.toBe(different);
    });

    it('sanitizes download file names', () => {
        expect(sanitizeDownloadFileName('Español / A1: Basics')).toBe('Espanol-A1-Basics');
        expect(sanitizeDownloadFileName('')).toBe('deck');
    });

    it('serializes generated examples from string and structured values', () => {
        expect(serializeGeneratedExample('  simple example  ')).toBe('simple example');
        expect(
            serializeGeneratedExample({
                target: 'Hola',
                english: 'Hello',
                romanization: '',
            }),
        ).toBe('Hola | Hello');
    });

    it('serializes tags as semicolon-delimited string', () => {
        expect(serializeGeneratedTags([' verbs ', '', 'greetings'])).toBe('verbs; greetings');
        expect(serializeGeneratedTags(undefined)).toBeUndefined();
    });

    it('validates flashcard format/material values', () => {
        expect(isFlashcardFormatValue('QA')).toBe(true);
        expect(isFlashcardFormatValue('Invalid')).toBe(false);
        expect(isFlashcardMaterialTypeValue('Language')).toBe(true);
        expect(isFlashcardMaterialTypeValue('Unknown')).toBe(false);
    });

    it('maps generated cards into append payload input', () => {
        expect(
            toAppendDeckCardInput({
                front: '  hola  ',
                back: '  hello  ',
                imageUrl: '  https://example.com/img.jpg  ',
                audioUrl: '  https://example.com/audio.mp3  ',
                category: '  greetings  ',
                pos: '  noun ',
                gender: ' feminine ',
                example: {
                    target: 'Hola',
                    english: 'Hello',
                    romanization: '',
                },
                tags: [' common ', ''],
            }),
        ).toEqual({
            front: 'hola',
            back: 'hello',
            imageUrl: 'https://example.com/img.jpg',
            audioUrl: 'https://example.com/audio.mp3',
            category: 'greetings',
            pos: 'noun',
            gender: 'feminine',
            example: 'Hola | Hello',
            tags: 'common',
        });
    });

    it('preserves valid quiz enrichment when mapping generated cards into append payload input', () => {
        const source = {
            front: 'Water',
            back: 'H2O',
            quiz: {
                prompt: 'Which state change is evaporation?',
                options: ['liquid to gas', 'gas to liquid'],
                correctAnswer: 'liquid to gas',
                explanation: 'Evaporation changes a liquid into a gas.',
            },
        };

        const mapped = toAppendDeckCardInput(source);

        expect(mapped?.quiz).toEqual(source.quiz);
    });

    it('filters invalid append cards and keeps valid entries', () => {
        expect(
            toAppendDeckCardInputs([
                { front: 'Q1', back: 'A1' },
                { front: '   ', back: 'A2' },
                { front: 'Q3', back: '' },
            ]),
        ).toEqual([
            { front: 'Q1', back: 'A1' },
        ]);
    });
});
