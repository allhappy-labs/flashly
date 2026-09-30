import { z } from 'zod';
import { NullableQuizEnrichmentSchema, QuizEnrichmentSchema } from '@flashly/shared';
import { CreateDeckSchema } from './deck-schema.ts';
import { config } from '../../config/app.ts';

type SerializedError = {
    name: string;
    message: string;
    code?: string;
    statusCode?: number;
    stack?: string;
    cause?: SerializedError;
};

function getObjectProperty(value: unknown, key: string): unknown {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }

    return Reflect.get(value, key);
}

function getStringProperty(value: unknown, key: string): string | undefined {
    const candidate = getObjectProperty(value, key);
    return typeof candidate === 'string' ? candidate : undefined;
}

function getNumberProperty(value: unknown, key: string): number | undefined {
    const candidate = getObjectProperty(value, key);
    return typeof candidate === 'number' ? candidate : undefined;
}

export function toSerializableError(error: unknown, includeStack: boolean, depth: number = 0): SerializedError {
    const maxDepth = 4;
    if (depth >= maxDepth) {
        return {
            name: 'Error',
            message: 'Maximum error cause depth reached',
        };
    }

    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            code: getStringProperty(error, 'code'),
            statusCode: getNumberProperty(error, 'statusCode'),
            stack: includeStack ? error.stack : undefined,
            cause: getObjectProperty(error, 'cause')
                ? toSerializableError(getObjectProperty(error, 'cause'), includeStack, depth + 1)
                : undefined,
        };
    }

    if (typeof error === 'object' && error !== null) {
        return {
            name: getStringProperty(error, 'name') ?? 'Error',
            message: getStringProperty(error, 'message') ?? JSON.stringify(error),
            code: getStringProperty(error, 'code'),
            statusCode: getNumberProperty(error, 'statusCode'),
        };
    }

    return {
        name: 'Error',
        message: typeof error === 'string' ? error : String(error),
    };
}

export function isDeckDebugEnabled(): boolean {
    return config.LOG_LEVEL === 'debug';
}

const deckVisibilitySchema = z.enum(['private', 'public']);
const romanizationPreferenceSchema = z.enum([
    'native_only',
    'with_romanization',
    'romanized_only',
]);
const marketplaceLicenseSchema = z.object({
    code: z.string(),
    name: z.string(),
    url: z.string().optional(),
});
const marketplaceMetadataSchema = z.object({
    level: z.string().nullable().optional(),
    skills: z.array(z.string()).nullable().optional(),
    regionalVariant: z.string().nullable().optional(),
    script: z.string().nullable().optional(),
    romanization: romanizationPreferenceSchema.nullable().optional(),
    license: marketplaceLicenseSchema.nullable().optional(),
});

export const deckSchema = z.object({
    id: z.string(),
    userId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    accentKey: z.string().nullable(),
    materialType: z.string().nullable(),
    deckType: z.string().nullable(),
    locale: z.string().nullable(),
    marketplaceMetadata: marketplaceMetadataSchema.nullable().optional(),
    visibility: deckVisibilitySchema,
    isFeatured: z.boolean(),
    downloadCount: z.number(),
    viewCount: z.number(),
    lastSyncedAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    lastStudiedAt: z.date().nullable(),
});

export const cardSchema = z.object({
    id: z.string(),
    deckId: z.string(),
    front: z.string(),
    back: z.string(),
    imageUrl: z.string().nullable(),
    audioUrl: z.string().nullable(),
    category: z.string().nullable(),
    pos: z.string().nullable(),
    gender: z.string().nullable(),
    example: z.string().nullable(),
    tags: z.string().nullable(),
    quiz: QuizEnrichmentSchema.nullable(),
    isStarred: z.boolean(),
    learnState: z.enum(['not_studied', 'learning', 'mastered']).nullable(),
    learnCorrectStreak: z.number().nullable(),
    learnCorrectTotal: z.number().nullable(),
    learnIncorrectTotal: z.number().nullable(),
    learnLastAnsweredAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    lastReviewedAt: z.date().nullable(),
    due: z.date().nullable(),
    stability: z.number().nullable(),
    difficulty: z.number().nullable(),
    elapsed_days: z.number().nullable(),
    scheduled_days: z.number().nullable(),
    learning_steps: z.number().nullable(),
    reps: z.number().nullable(),
    lapses: z.number().nullable(),
    state: z.enum(['new', 'learning', 'review', 'relearning']).nullable(),
});

export const deckWithCardsSchema = deckSchema.extend({
    cards: z.array(cardSchema),
});

export const userDeckListItemSchema = deckSchema.extend({
    cardCount: z.number(),
});

export const paginatedDeckListSchema = z.object({
    items: z.array(userDeckListItemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
    hasMore: z.boolean(),
});

export const deckIdParamsSchema = z.object({
    id: z.string(),
});

export const deckCardParamsSchema = z.object({
    id: z.string(),
    cardId: z.string(),
});

export const listDecksQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

export const createDeckBodySchema = CreateDeckSchema.partial({ visibility: true });

const singleCardCreateBodySchema = z.object({
    front: z.string().min(1),
    back: z.string().min(1),
    imageUrl: z.string().optional(),
    audioUrl: z.string().optional(),
    category: z.string().optional(),
    pos: z.string().optional(),
    gender: z.string().optional(),
    example: z.string().optional(),
    tags: z.string().optional(),
    quiz: NullableQuizEnrichmentSchema,
});

const bulkCardCreateBodySchema = z.object({
    cards: z.array(singleCardCreateBodySchema).min(1),
});

export const createCardBodySchema = z.union([
    singleCardCreateBodySchema,
    bulkCardCreateBodySchema,
]);

export type BulkCardCreateBody = z.infer<typeof bulkCardCreateBodySchema>;
export type CreateCardBody = z.infer<typeof createCardBodySchema>;

export function isBulkCardCreateBody(body: CreateCardBody): body is BulkCardCreateBody {
    return 'cards' in body && Array.isArray(body.cards);
}

export const updateCardBodySchema = z.object({
    front: z.string().optional(),
    back: z.string().optional(),
    imageUrl: z.string().optional(),
    audioUrl: z.string().optional(),
    category: z.string().optional(),
    pos: z.string().optional(),
    gender: z.string().optional(),
    example: z.string().optional(),
    tags: z.string().optional(),
    quiz: NullableQuizEnrichmentSchema,
});

export const bulkDeleteCardsBodySchema = z.object({
    cardIds: z.array(z.string()),
});

export const bulkUpdateCardsBodySchema = z.object({
    cardIds: z.array(z.string()),
    category: z.string().optional(),
    tags: z.string().optional(),
});

export const bulkUpdateCardQuizzesBodySchema = z.object({
    updates: z.array(z.object({
        cardId: z.string().min(1),
        quiz: QuizEnrichmentSchema.nullable(),
    }).strict()).min(1),
}).strict();

export const countResponseSchema = z.object({
    count: z.number(),
});

export const bulkCreateCardsResponseSchema = z.object({
    count: z.number(),
    skippedDuplicates: z.number(),
});

export const setVisibilityBodySchema = z.object({
    visibility: deckVisibilitySchema,
});

export const emptyResponseSchema = z.object({}).strict();
