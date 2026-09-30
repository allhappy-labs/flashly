import { z } from 'zod';
import { NullableQuizEnrichmentSchema, QuizEnrichmentSchema } from '@flashly/shared';

const romanizationPreferenceSchema = z.enum([
    'native_only',
    'with_romanization',
    'romanized_only',
]);

const marketplaceLicenseSchema = z.object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(120),
    url: z.string().url().optional(),
});

export const MarketplaceMetadataSchema = z.object({
    level: z.string().max(50).optional().nullable(),
    skills: z.array(z.string().max(50)).max(20).optional().nullable(),
    regionalVariant: z.string().max(50).optional().nullable(),
    script: z.string().max(50).optional().nullable(),
    romanization: romanizationPreferenceSchema.optional().nullable(),
    license: marketplaceLicenseSchema.optional().nullable(),
});

const marketplaceHasAudioSchema = z.preprocess((value) => {
    if (value === true || value === 'true') {
        return true;
    }
    if (value === false || value === 'false') {
        return false;
    }
    return value;
}, z.boolean());

// ============================================================================
// DECK SCHEMAS
// ============================================================================

export const CreateDeckSchema = z.object({
    name: z.string().min(1, 'Deck name is required').max(200, 'Deck name must be 200 characters or less'),
    description: z.string().max(1000, 'Description must be 1000 characters or less').optional().nullable(),
    accentKey: z.string().max(50, 'Accent key must be 50 characters or less').optional(),
    materialType: z.string().max(50, 'Material type must be 50 characters or less').optional(),
    deckType: z.string().max(50, 'Deck type must be 50 characters or less').optional(),
    locale: z.string().max(10, 'Locale must be 10 characters or less').optional(),
    marketplaceMetadata: MarketplaceMetadataSchema.optional().nullable(),
    visibility: z.enum(['private', 'public']).default('private'),
});

export const UpdateDeckSchema = z.object({
    name: z.string().min(1, 'Deck name is required').max(200, 'Deck name must be 200 characters or less').optional(),
    description: z.string().max(1000, 'Description must be 1000 characters or less').optional().nullable(),
    accentKey: z.string().max(50, 'Accent key must be 50 characters or less').optional(),
    materialType: z.string().max(50, 'Material type must be 50 characters or less').optional(),
    deckType: z.string().max(50, 'Deck type must be 50 characters or less').optional(),
    locale: z.string().max(10, 'Locale must be 10 characters or less').optional(),
    marketplaceMetadata: MarketplaceMetadataSchema.optional().nullable(),
    visibility: z.enum(['private', 'public']).optional(),
});

export const SetVisibilitySchema = z.object({
    visibility: z.enum(['private', 'public']),
});

// ============================================================================
// CARD SCHEMAS
// ============================================================================

export const CreateCardSchema = z.object({
    front: z.string().min(1, 'Card front is required').max(1000, 'Card front must be 1000 characters or less'),
    back: z.string().min(1, 'Card back is required').max(1000, 'Card back must be 1000 characters or less'),
    imageUrl: z.string().url('Image URL must be valid').optional().nullable(),
    audioUrl: z.string().url('Audio URL must be valid').optional().nullable(),
    category: z.string().max(100, 'Category must be 100 characters or less').optional().nullable(),
    pos: z.string().max(50, 'Part of speech must be 50 characters or less').optional().nullable(),
    gender: z.string().max(20, 'Gender must be 20 characters or less').optional().nullable(),
    example: z.string().max(500, 'Example must be 500 characters or less').optional().nullable(),
    tags: z.array(z.string().max(50, 'Tag must be 50 characters or less')).max(20, 'Maximum 20 tags allowed').optional(),
    quiz: NullableQuizEnrichmentSchema,
});

export const UpdateCardSchema = z.object({
    front: z.string().min(1, 'Card front is required').max(1000, 'Card front must be 1000 characters or less').optional(),
    back: z.string().min(1, 'Card back is required').max(1000, 'Card back must be 1000 characters or less').optional(),
    imageUrl: z.string().url('Image URL must be valid').optional().nullable(),
    audioUrl: z.string().url('Audio URL must be valid').optional().nullable(),
    category: z.string().max(100, 'Category must be 100 characters or less').optional().nullable(),
    pos: z.string().max(50, 'Part of speech must be 50 characters or less').optional().nullable(),
    gender: z.string().max(20, 'Gender must be 20 characters or less').optional().nullable(),
    example: z.string().max(500, 'Example must be 500 characters or less').optional().nullable(),
    tags: z.array(z.string().max(50, 'Tag must be 50 characters or less')).max(20, 'Maximum 20 tags allowed').optional(),
    quiz: NullableQuizEnrichmentSchema,
});

// ============================================================================
// MARKETPLACE SCHEMAS
// ============================================================================

export const MarketplaceQuerySchema = z.object({
    materialType: z.string().optional(),
    deckType: z.string().optional(),
    locale: z.string().optional(),
    level: z.string().max(50).optional(),
    skill: z.string().max(50).optional(),
    regionalVariant: z.string().max(50).optional(),
    hasAudio: marketplaceHasAudioSchema.optional(),
    script: z.string().max(50).optional(),
    romanization: romanizationPreferenceSchema.optional(),
    licenseCode: z.string().max(50).optional(),
    search: z.string().max(200, 'Search term must be 200 characters or less').optional(),
    sortBy: z.enum([
        'newest',
        'most_downloaded',
        'most_viewed',
        'created',
        'updated',
        'name',
        'downloadCount',
        'viewCount',
    ]).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

export const FeaturedDecksSchema = z.object({
    limit: z.coerce.number().int().positive().max(50).default(10),
});

// ============================================================================
// SYNC SCHEMAS
// ============================================================================

export const FullSyncQuizSchema = z.preprocess(
    (value) => {
        if (value === undefined || value === null) {
            return value;
        }

        const result = QuizEnrichmentSchema.safeParse(value);
        return result.success ? result.data : null;
    },
    QuizEnrichmentSchema.nullable().optional(),
);

export const FullSyncSchema = z.object({
    clientDecks: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable().optional(),
        accentKey: z.string().nullable().optional(),
        materialType: z.string().nullable().optional(),
        deckType: z.string().nullable().optional(),
        locale: z.string().nullable().optional(),
        marketplaceMetadata: MarketplaceMetadataSchema.optional().nullable(),
        visibility: z.enum(['private', 'public']).optional(),
        createdAt: z.coerce.date().optional(),
        updatedAt: z.coerce.date().optional(),
        lastStudiedAt: z.coerce.date().nullable().optional(),
        cards: z.array(z.object({
            id: z.string(),
            front: z.string(),
            back: z.string(),
            imageUrl: z.string().nullable().optional(),
            audioUrl: z.string().nullable().optional(),
            category: z.string().nullable().optional(),
            pos: z.string().nullable().optional(),
            gender: z.string().nullable().optional(),
            example: z.string().nullable().optional(),
            tags: z.array(z.string()).optional(),
            quiz: FullSyncQuizSchema,
            isStarred: z.boolean().optional(),
            learnState: z.enum(['not_studied', 'learning', 'mastered']).optional(),
            learnCorrectStreak: z.number().optional(),
            learnCorrectTotal: z.number().optional(),
            learnIncorrectTotal: z.number().optional(),
            learnLastAnsweredAt: z.coerce.date().nullable().optional(),
            createdAt: z.coerce.date().optional(),
            updatedAt: z.coerce.date().optional(),
            lastReviewedAt: z.coerce.date().nullable().optional(),
            due: z.coerce.date().nullable().optional(),
            stability: z.number().optional(),
            difficulty: z.number().optional(),
            elapsed_days: z.number().optional(),
            scheduled_days: z.number().optional(),
            learning_steps: z.number().optional(),
            reps: z.number().optional(),
            lapses: z.number().optional(),
            state: z.enum(['new', 'learning', 'review', 'relearning']).optional(),
        })).optional(),
    })).optional(),
    lastSyncAt: z.coerce.date().optional(),
});

export const IncrementalSyncSchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(500).default(100),
    changes: z.array(z.object({
        entityType: z.enum(['deck', 'card']),
        entityId: z.string(),
        operation: z.enum(['create', 'update', 'delete']),
        data: z.any().optional(), // Will be validated based on entity type
        clientUpdatedAt: z.string().optional(),
    })).optional(),
});

// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================

export const PaginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

export const PaginatedResponseSchema = <T>(itemSchema: z.ZodType<T>) => z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
    hasMore: z.boolean(),
});

// ============================================================================
// TYPES
// ============================================================================

export type CreateDeckInput = z.infer<typeof CreateDeckSchema>;
export type UpdateDeckInput = z.infer<typeof UpdateDeckSchema>;
export type SetVisibilityInput = z.infer<typeof SetVisibilitySchema>;
export type CreateCardInput = z.infer<typeof CreateCardSchema>;
export type UpdateCardInput = z.infer<typeof UpdateCardSchema>;
export type MarketplaceQuery = z.infer<typeof MarketplaceQuerySchema>;
export type FeaturedDecksQuery = z.infer<typeof FeaturedDecksSchema>;
export type FullSyncInput = z.infer<typeof FullSyncSchema>;
export type IncrementalSyncInput = z.infer<typeof IncrementalSyncSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
