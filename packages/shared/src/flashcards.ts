import { z } from 'zod';
import { getFlashcardMaterialTypeInstruction } from './prompts';
import { getLocaleName, type SupportedLocale } from './i18n/index';
import { FLASHCARD_MATERIAL_TYPES } from './material-types';
import type { FlashcardMaterialType } from './material-types';
import { normalizeQuizEnrichment, QuizEnrichmentSchema } from './quiz-enrichment';

export const FLASHCARD_FORMATS = ['QA', 'Cloze', 'Definition'] as const;
export type FlashcardFormat = (typeof FLASHCARD_FORMATS)[number];
export { FLASHCARD_MATERIAL_TYPES };
export type { FlashcardMaterialType };

// Define the structured example type for language learning
const LanguageExampleSchema = z.object({
    target: z.string(),           // Example in target language
    english: z.string(),          // English translation
    romanization: z.string()      // Romanized pronunciation
});

export type LanguageExample = z.infer<typeof LanguageExampleSchema>;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeFlashcardQuiz(value: Record<string, unknown>): Record<string, unknown> {
    if (!('quiz' in value)) {
        return value;
    }

    const normalizedQuiz = normalizeQuizEnrichment(value.quiz);
    const cardWithoutQuiz = { ...value };
    delete cardWithoutQuiz.quiz;

    return normalizedQuiz === undefined
        ? cardWithoutQuiz
        : { ...cardWithoutQuiz, quiz: normalizedQuiz };
}

export const FlashcardSchema = z.preprocess(
    (value) => {
        if (!isObjectRecord(value)) {
            return value;
        }
        if (typeof value.front === 'string' && typeof value.back === 'string') {
            return normalizeFlashcardQuiz(value);
        }
        if (typeof value.question === 'string' && typeof value.answer === 'string') {
            return normalizeFlashcardQuiz({ ...value, front: value.question, back: value.answer });
        }
        return value;
    },
    z
        .object({
            front: z.string().min(1),
            back: z.string().min(1),
            id: z.number().int().optional(),
            imageUrl: z.string().optional(),
            imagePath: z.string().optional(),
            imageQuery: z.string().optional(),
            audioUrl: z.string().optional(),
            audioPath: z.string().optional(),
            category: z.string().optional(),
            pos: z.string().optional(),
            gender: z.string().optional(),
            example: z.union([
                z.string(),                    // Simple string example
                LanguageExampleSchema          // Structured language example
            ]).optional(),
            tags: z.array(z.string()).optional(),
            quiz: QuizEnrichmentSchema.optional(),
        })
        .passthrough(),
);

export const DeckMetadataSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    materialType: z.string().optional(),
    deckType: z.string().optional(),  // The format (QA, Cloze, Definition)
    language: z.string().optional(),
});

export const FlashcardsResponseSchema = z.object({
    flashcards: z.array(FlashcardSchema).min(1),
    deckMetadata: DeckMetadataSchema.optional(),
});

const FlashcardErrorEnvelopeSchema = z.object({
    error: z.object({
        code: z.string().trim().min(1),
        message: z.string().trim().min(1),
    }),
});

export type FlashcardsResponse = z.infer<typeof FlashcardsResponseSchema>;

export interface OpenRouterUsage {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
}

export interface FlashcardGenerationResult {
    flashcards: FlashcardsResponse;
    model: string;
    usage?: OpenRouterUsage;
}

export type MediaFailureType = 'audio' | 'image';

export type MediaFailure = {
    cardId: string;
    cardIndex: number;
    card: FlashcardsResponse['flashcards'][number];
    errorType: MediaFailureType;
    errorMessage: string;
    timestamp: number;
};

export type GenerationFailures = {
    audio: MediaFailure[];
    image: MediaFailure[];
};

export class FlashcardInputError extends Error {
    readonly code: string;

    constructor(message: string, code: string) {
        super(message);
        this.code = code;
    }
}

export class FlashcardResponseError extends Error {
    readonly code: string;

    constructor(message: string, code: string) {
        super(message);
        this.code = code;
    }
}

export interface FlashcardPromptOptions {
    documentText: string;
    format?: string;
    materialType?: string;
    customInstruction?: string;
    count?: number;
    previousQuestions?: string[];
    includeImages?: boolean;
    includeQuiz?: boolean;
    languageId?: string;   // Language code (e.g., 'spa', 'fra')
    languageName?: string; // Human-readable name (e.g., 'Spanish')
}

export interface FlashcardPromptConfig {
    template: string;
    formats: string[];
    materialTypes: string[];
    defaultFormat: string;
    defaultMaterialType: string;
}

function normalizeOption(value: string): string {
    return value.trim().toLowerCase();
}

function resolveOption(value: string | undefined, allowed: string[], fallback: string, label: string): string {
    if (!value) {
        return fallback;
    }

    const normalized = normalizeOption(value);
    const match = allowed.find((option) => normalizeOption(option) === normalized);

    if (!match) {
        throw new FlashcardInputError(`Unsupported ${label}.`, `INVALID_${label.toUpperCase()}`);
    }

    return match;
}

export function buildFlashcardPrompt(
    options: FlashcardPromptOptions,
    config: FlashcardPromptConfig,
): { prompt: string; format: string; materialType: string } {
    if (config.formats.length === 0) {
        throw new FlashcardInputError('No flashcard formats are configured.', 'MISSING_FORMATS');
    }
    if (config.materialTypes.length === 0) {
        throw new FlashcardInputError('No material types are configured.', 'MISSING_MATERIAL_TYPES');
    }

    const fallbackFormat = config.formats.includes(config.defaultFormat) ? config.defaultFormat : config.formats[0];
    const fallbackMaterialType = config.materialTypes.includes(config.defaultMaterialType)
        ? config.defaultMaterialType
        : config.materialTypes[0];

    const format = resolveOption(options.format, config.formats, fallbackFormat, 'format');
    const materialType = resolveOption(
        options.materialType,
        config.materialTypes,
        fallbackMaterialType,
        'material type',
    );

    const countInstruction =
        options.count === 0
            ? `Generate as many ${format} flashcards as you see fit for ${materialType} study material.`
            : options.count
              ? `Generate exactly ${options.count} ${format} flashcards for ${materialType} study material.`
              : `Generate ${format} flashcards for ${materialType} study material.`;

    const trimmedDocument = options.documentText.trim();
    const instruction = options.customInstruction?.trim() ?? '';
    const hasDocumentText = trimmedDocument.length > 0;
    const hasInstruction = instruction.length > 0;
    const sourceMaterial = hasDocumentText ? trimmedDocument : instruction;
    const sourcePolicyInstruction = hasDocumentText
        ? '- Use the content from the Source section verbatim as the source of truth; do not invent facts.'
        : '- Instruction-only mode: treat Source as the user request and generate best-effort flashcards using your general knowledge. Return the structured JSON error envelope only if Source is empty after trimming.';
    const customInstructionSection = hasDocumentText && hasInstruction
        ? `Additional user instruction:\n${instruction}`
        : 'Additional user instruction: None';
    const previousQuestions = options.previousQuestions?.length
        ? options.previousQuestions.map((question) => `- ${question}`).join('\n')
        : 'None';
    const materialTypeInstruction = getFlashcardMaterialTypeInstruction(materialType);
    const hasMaterialTypeInstructionPlaceholder = config.template.includes('{{materialTypeInstruction}}');
    const hasQuizInstructionPlaceholder = config.template.includes('{{quizInstruction}}');
    const quizInstruction = options.includeQuiz
        ? [
            'Optional quiz enrichment',
            '- Add a "quiz" object only when it materially improves learning; otherwise you may omit "quiz".',
            '- Each quiz must contain a concise "prompt", two to four deliberate options, a "correctAnswer" with exactly one option matching "correctAnswer", and a concise explanation.',
        ].join('\n')
        : '';

    // Build language instruction if language is provided
    const languageInstruction = options.languageId && options.languageName
        ? `Language Information:\n- Target language: ${options.languageName} (${options.languageId}).\n- Apply language-specific rules (word stress, grammatical gender) appropriate for this language.\n`
        : '';

    const basePrompt = config.template
        .replaceAll('{{format}}', format)
        .replaceAll('{{materialType}}', materialType)
        .replaceAll('{{sourceMaterial}}', sourceMaterial)
        .replaceAll('{{documentText}}', sourceMaterial)
        .replaceAll('{{sourcePolicyInstruction}}', sourcePolicyInstruction)
        .replaceAll('{{customInstruction}}', customInstructionSection)
        .replaceAll('{{count}}', options.count ? String(options.count) : '')
        .replaceAll('{{countInstruction}}', countInstruction)
        .replaceAll('{{previousQuestions}}', previousQuestions)
        .replaceAll('{{materialTypeInstruction}}', materialTypeInstruction)
        .replaceAll('{{languageInstruction}}', languageInstruction)
        .replaceAll('{{quizInstruction}}', quizInstruction);

    const promptWithMaterialTypeInstruction = hasMaterialTypeInstructionPlaceholder
        ? basePrompt
        : `${basePrompt}\n\nMaterial type instructions\n${materialTypeInstruction}`;
    const prompt = options.includeQuiz && !hasQuizInstructionPlaceholder
        ? `${promptWithMaterialTypeInstruction}\n\n${quizInstruction}`
        : promptWithMaterialTypeInstruction;

    if (!options.includeImages) {
        return { format, materialType, prompt };
    }

    const imageInstruction = [
        'Image search query',
        '- For each card, add "imageQuery": a short English photo search query representing the meaning of the front.',
        '- Use 1-3 words, prefer a single core noun when possible.',
        '- Do not add extra descriptors (size, color, style, setting) unless essential for meaning.',
        '- Do not use symbols or separators like "+", ",", "/", or "-".',
        '- Keep it generic and not too specific; avoid proper nouns unless required.',
    ].join('\n');

    return { format, materialType, prompt: `${prompt}\n\n${imageInstruction}` };
}

/**
 * Builds translation prompt for deck-based translation
 * Handles both Language decks (preserve front) and other decks (translate front)
 */
export interface DeckTranslationPromptOptions {
    sourceJsonl: string;
    targetLocale: string;
    materialType: string;
    sourceLanguage: SupportedLocale;
}

export function buildDeckTranslationPrompt(
    options: DeckTranslationPromptOptions
): string {
    const isLanguageDeck = options.materialType === 'Language';
    const targetLanguageName = getLocaleName(options.targetLocale);
    const sourceLanguageName = getLocaleName(options.sourceLanguage);

    const frontInstruction = isLanguageDeck
        ? 'Keep the "front" text EXACTLY as provided (it is the target language word/phrase).'
        : `Translate the "front" text into ${targetLanguageName}.`;

    const exampleInstruction = isLanguageDeck
        ? 'Translate the "example" field to the target language if present (target field only, keep english).'
        : 'Translate the "example" field to the target language if present.';

    return [
        `You are translating flashcards from ${sourceLanguageName} to ${targetLanguageName}.`,
        '',
        'Rules:',
        `- ${frontInstruction}`,
        `- Translate the "back" text into ${targetLanguageName}.`,
        `- ${exampleInstruction}`,
        '- Preserve all markdown formatting.',
        '- Preserve grammatical gender information.',
        '- Return valid JSONL only, one JSON object per line.',
        '- Maintain the exact same order and count as input.',
        '',
        'Input JSONL:',
        options.sourceJsonl,
    ].join('\n');
}

/**
 * Validates that imported deck locale matches existing base deck locale
 */
export function validateBaseDeckLocale(
    existingDeckLocale: SupportedLocale | null | undefined,
    newDeckLocale: SupportedLocale | null | undefined
): { valid: boolean; reason?: string } {
    // If either is null/undefined, no conflict
    if (!existingDeckLocale || !newDeckLocale) {
        return { valid: true };
    }

    // Check if they match
    if (existingDeckLocale !== newDeckLocale) {
        return {
            valid: false,
            reason: `different_locales:${existingDeckLocale}:${newDeckLocale}`,
        };
    }

    return { valid: true };
}

function extractJsonPayload(content: string): string {
    const trimmed = content.trim();
    const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]+?)\s*```$/i);
    if (fencedMatch) {
        return fencedMatch[1].trim();
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return trimmed;
    }

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new FlashcardResponseError(
            'Unable to generate flashcards from the model response. Please try again.',
            'PARSE_ERROR',
        );
    }

    return trimmed.slice(start, end + 1);
}

function parseJsonlLines(content: string, strict: boolean): Array<z.infer<typeof FlashcardSchema>> {
    const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (!lines.length) return [];
    const results: Array<z.infer<typeof FlashcardSchema>> = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        try {
            const parsed = JSON.parse(line);
            const cardResult = FlashcardSchema.parse(parsed);
            results.push(cardResult);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            if (strict) {
                errors.push(errorMsg);
            }
        }
    }

    if (strict && errors.length) {
        throw new FlashcardResponseError(
            'Unable to parse model output as flashcard JSONL. Please try again.',
            'INVALID_JSONL',
        );
    }
    return results;
}

function mapModelErrorToUserError(code: string): FlashcardResponseError {
    if (code === 'INSUFFICIENT_SOURCE') {
        return new FlashcardResponseError(
            'Not enough information to generate flashcards. Add source material or a clearer instruction.',
            'INSUFFICIENT_SOURCE',
        );
    }

    return new FlashcardResponseError(
        'Unable to generate flashcards from the provided input. Please adjust your source and try again.',
        'MODEL_ERROR',
    );
}

export function parseFlashcardsResponse(content: string): FlashcardsResponse {
    const lines = content.split(/\r?\n/);
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);

    // Try to extract deck metadata from the first two lines if they look like JSON strings
    let deckMetadata: { name?: string; description?: string } | undefined;
    let flashcardStartIndex = 0;

    if (nonEmptyLines.length >= 2) {
        try {
            const firstLine = nonEmptyLines[0].trim();
            const secondLine = nonEmptyLines[1].trim();
            const thirdLine = nonEmptyLines[2]?.trim() || '';

            // Check if first two lines are valid JSON strings (deck name and description)
            const parsedName = JSON.parse(firstLine);
            const parsedDescription = JSON.parse(secondLine);

            // If both are strings and third line is empty (blank line separator), we have metadata
            if (typeof parsedName === 'string' && typeof parsedDescription === 'string' && thirdLine === '') {
                deckMetadata = { name: parsedName, description: parsedDescription };
                flashcardStartIndex = 3; // Skip metadata lines and blank line
            }
        } catch  {
            // First two lines are not deck metadata, continue with normal parsing
        }
    }

    // Extract flashcard JSONL content (skipping metadata if present)
    const flashcardLines = flashcardStartIndex > 0
        ? lines.slice(flashcardStartIndex).filter(Boolean)
        : lines.filter(Boolean);

    // Try parsing full JSONL content first.
    const jsonlContent = flashcardLines.join('\n');
    const jsonlCards = parseJsonlLines(jsonlContent, false);
    if (jsonlCards.length) {
        return { flashcards: jsonlCards, deckMetadata };
    }

    // Fallback: try to extract JSONL lines if the response contains non-JSON text wrappers.
    const jsonlMatch = jsonlContent.match(/(?:^|\n)(\s*\{["']front["'].*?\})(?:\n|$)/gs);
    if (jsonlMatch) {
        const cleanJsonl = jsonlMatch.map(m => m.trim()).join('\n');
        const cards = parseJsonlLines(cleanJsonl, false);
        if (cards.length > 0 && cards.length === jsonlMatch.length) {
            return { flashcards: cards, deckMetadata };
        }
    }

    try {
        const jsonPayload = extractJsonPayload(content);
        const parsed = JSON.parse(jsonPayload);
        if (Array.isArray(parsed)) {
            return { flashcards: z.array(FlashcardSchema).parse(parsed), deckMetadata };
        }

        const modelError = FlashcardErrorEnvelopeSchema.safeParse(parsed);
        if (modelError.success) {
            const normalizedCode = modelError.data.error.code.trim().toUpperCase();
            throw mapModelErrorToUserError(normalizedCode);
        }

        const result = FlashcardsResponseSchema.parse(parsed);
        return { flashcards: result.flashcards, deckMetadata: result.deckMetadata || deckMetadata };
    } catch (error) {
        if (error instanceof FlashcardResponseError) {
            throw error;
        }

        if (error instanceof z.ZodError) {
            throw new FlashcardResponseError(
                'Unable to generate flashcards from the model response. Please try again.',
                'PARSE_ERROR',
            );
        }

        if (error instanceof SyntaxError) {
            throw new FlashcardResponseError(
                'Unable to generate flashcards from the model response. Please try again.',
                'PARSE_ERROR',
            );
        }

        if (error instanceof Error && error.message.includes('model response')) {
            throw new FlashcardResponseError(
                'Unable to generate flashcards from the model response. Please try again.',
                'PARSE_ERROR',
            );
        }

        throw new FlashcardResponseError(
            'Unable to generate flashcards at this time. Please try again.',
            'GENERATION_FAILED',
        );
    }
}

export function parseFlashcardsJsonl(content: string): FlashcardsResponse {
    const cards = parseJsonlLines(content, true);
    return { flashcards: cards };
}
