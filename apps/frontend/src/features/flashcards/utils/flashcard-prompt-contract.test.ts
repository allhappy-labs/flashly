import { describe, expect, it } from 'vitest';
import {
    FLASHCARD_FORMATS,
    FLASHCARD_MATERIAL_TYPES,
    FLASHCARD_PROMPT_TEMPLATE,
    buildFlashcardPrompt,
    buildQuizEnrichmentPrompt,
} from '@flashly/shared/src';

const promptConfig = {
    template: FLASHCARD_PROMPT_TEMPLATE,
    formats: [...FLASHCARD_FORMATS],
    materialTypes: [...FLASHCARD_MATERIAL_TYPES],
    defaultFormat: FLASHCARD_FORMATS[0],
    defaultMaterialType: FLASHCARD_MATERIAL_TYPES[0],
};

describe('flashcard prompt contract', () => {
    it('uses custom instruction as source when document text is empty', () => {
        const { prompt } = buildFlashcardPrompt(
            {
                documentText: '',
                customInstruction: 'Generate beginner cards for common Spanish greetings.',
                format: 'QA',
                materialType: 'General',
                count: 10,
            },
            promptConfig,
        );

        expect(prompt).toContain('Source');
        expect(prompt).toContain('Generate beginner cards for common Spanish greetings.');
        expect(prompt).toContain('INSUFFICIENT_SOURCE');
    });

    it('keeps document text as source when material is provided', () => {
        const { prompt } = buildFlashcardPrompt(
            {
                documentText: 'The mitochondrion is the powerhouse of the cell.',
                customInstruction: 'Use short answers.',
                format: 'QA',
                materialType: 'General',
                count: 5,
            },
            promptConfig,
        );

        expect(prompt).toContain('The mitochondrion is the powerhouse of the cell.');
        expect(prompt).toContain('Additional user instruction:\nUse short answers.');
    });

    it('requires valid optional quiz enrichment when requested', () => {
        const { prompt } = buildFlashcardPrompt(
            {
                documentText: 'Vater is a masculine German noun.',
                includeQuiz: true,
            },
            promptConfig,
        );

        expect(prompt).toContain('two to four deliberate options');
        expect(prompt).toContain('exactly one option matching "correctAnswer"');
        expect(prompt).toContain('concise explanation');
        expect(prompt).toContain('may omit "quiz"');
    });

    it('does not request quiz enrichment when it is disabled', () => {
        const { prompt } = buildFlashcardPrompt(
            {
                documentText: 'Vater is a masculine German noun.',
                includeQuiz: false,
            },
            promptConfig,
        );

        expect(prompt).not.toContain('two to four deliberate options');
    });

    it('appends quiz requirements when a custom template omits the placeholder', () => {
        const { prompt } = buildFlashcardPrompt(
            {
                documentText: 'Vater is a masculine German noun.',
                includeQuiz: true,
            },
            {
                ...promptConfig,
                template: 'Generate {{format}} cards from {{sourceMaterial}}.',
            },
        );

        expect(prompt).toContain('two to four deliberate options');
    });

    it('builds an immutable JSONL enrichment prompt for existing cards', () => {
        const prompt = buildQuizEnrichmentPrompt(
            [{ id: 'card-1', front: 'Vater', back: 'father' }],
            'Focus on grammatical gender.',
        );

        expect(prompt).toContain('Do not change "front" or "back" content.');
        expect(prompt).toContain('{"id":"card-1","front":"Vater","back":"father"}');
        expect(prompt).toContain('Focus on grammatical gender.');
    });
});
