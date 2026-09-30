import { z } from 'zod';

export const QuizEnrichmentSchema = z.object({
    prompt: z.string().trim().min(1).max(1000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(4),
    correctAnswer: z.string().trim().min(1).max(500),
    explanation: z.string().trim().min(1).max(1000),
}).strict().superRefine((quiz, context) => {
    const unique = new Set(quiz.options);
    if (unique.size !== quiz.options.length) {
        context.addIssue({ code: 'custom', path: ['options'], message: 'Quiz options must be unique' });
    }
    if (quiz.options.filter((option) => option === quiz.correctAnswer).length !== 1) {
        context.addIssue({ code: 'custom', path: ['correctAnswer'], message: 'Correct answer must match exactly one option' });
    }
});

export type QuizEnrichment = z.infer<typeof QuizEnrichmentSchema>;

export function normalizeQuizEnrichment(value: unknown): QuizEnrichment | undefined {
    const result = QuizEnrichmentSchema.safeParse(value);
    return result.success ? result.data : undefined;
}

export const OptionalQuizEnrichmentSchema = z.preprocess(
    (value) => normalizeQuizEnrichment(value),
    QuizEnrichmentSchema.optional(),
);

export const NullableQuizEnrichmentSchema = z.preprocess(
    (value) => value === null ? null : normalizeQuizEnrichment(value),
    QuizEnrichmentSchema.nullable().optional(),
);

export type QuizEnrichmentSourceCard = {
    id: string;
    front: string;
    back: string;
};

export const QuizEnrichmentProposalSchema = z.object({
    cardId: z.string().trim().min(1),
    quiz: QuizEnrichmentSchema,
}).strict();

export type QuizEnrichmentProposal = z.infer<typeof QuizEnrichmentProposalSchema>;

export function buildQuizEnrichmentPrompt(
    cards: readonly QuizEnrichmentSourceCard[],
    instruction?: string,
): string {
    const sourceJsonl = cards.map((card) => JSON.stringify(card)).join('\n');
    const additionalInstruction = instruction?.trim();

    return [
        'You are adding optional quiz enrichment to existing flashcards.',
        '',
        'Rules:',
        '- Do not change "front" or "back" content.',
        '- Return valid JSONL only, with at most one object for each source card.',
        '- Each proposal must include "cardId" and a "quiz" object.',
        '- Each quiz needs a concise prompt, two to four deliberate options, exactly one option matching "correctAnswer", and a concise explanation.',
        '- Omit a proposal when a useful quiz cannot be created from the source card.',
        '',
        'Source JSONL:',
        sourceJsonl,
        ...(additionalInstruction ? ['', `Additional instruction:\n${additionalInstruction}`] : []),
    ].join('\n');
}
