import type { FastifyInstance, FastifyRequest } from 'fastify';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/db.ts';
import { deckClones, user } from '../auth/auth-schema.ts';

export const marketplaceAuthorSchema = z.object({
    id: z.string(),
    name: z.string(),
    username: z.string().nullable().optional(),
    displayName: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
});

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

export const marketplaceDeckSchema = z.object({
    id: z.string(),
    userId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    accentKey: z.string().nullable(),
    materialType: z.string().nullable(),
    deckType: z.string().nullable(),
    locale: z.string().nullable(),
    marketplaceMetadata: marketplaceMetadataSchema.nullable().optional(),
    visibility: z.enum(['private', 'public']),
    isFeatured: z.boolean(),
    downloadCount: z.number(),
    viewCount: z.number(),
    lastSyncedAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    lastStudiedAt: z.date().nullable(),
    cardCount: z.number(),
    isAdded: z.boolean(),
    user: marketplaceAuthorSchema.optional(),
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

function normalizeDisplayName(value?: string | null): string | null {
    const normalized = value?.trim() || null;
    if (!normalized) {
        return null;
    }

    const lowered = normalized.toLowerCase();
    if (lowered === 'anonymous' || lowered === 'anonym' || lowered === 'anon') {
        return null;
    }

    return normalized;
}

export async function attachAuthorsToDecks<T extends { userId: string }>(
    decks: T[]
): Promise<Array<T & {
    user?: {
        id: string;
        name: string;
        username: string | null;
        displayName: string | null;
        image: string | null;
    };
}>> {
    const userIds = Array.from(new Set(decks.map((deck) => deck.userId)));
    if (userIds.length === 0) {
        return decks;
    }

    const authors = await db
        .select({
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            image: user.image,
        })
        .from(user)
        .where(inArray(user.id, userIds));

    const authorById = new Map(authors.map((author) => [author.id, author]));
    return decks.map((deck) => ({
        ...deck,
        user: (() => {
            const author = authorById.get(deck.userId);
            if (!author) {
                return undefined;
            }

            const normalizedName = normalizeDisplayName(author.name);
            const normalizedUsername = normalizeDisplayName(author.username);
            const emailHandle = normalizeDisplayName(author.email?.split('@')[0] || null);
            const fallbackHandle = author.id.slice(0, 8);

            return {
                ...author,
                name: author.name,
                username: normalizedUsername,
                displayName: normalizedName || normalizedUsername || emailHandle || fallbackHandle,
            };
        })(),
    }));
}

export async function getOptionalSessionUserId(
    fastify: FastifyInstance,
    request: FastifyRequest,
): Promise<string | null> {
    const headers = request.headers;
    const hasAuthorizationHeader = typeof headers.authorization === 'string' && headers.authorization.length > 0;
    const hasCookieHeader = typeof headers.cookie === 'string' && headers.cookie.length > 0;

    if (!hasAuthorizationHeader && !hasCookieHeader) {
        return null;
    }

    const session = await fastify.getAuthSession(request);
    return session?.user?.id ?? null;
}

export async function attachAddedStateToDecks<T extends { id: string; userId: string }>(
    decks: T[],
    currentUserId: string | null
): Promise<Array<T & { isAdded: boolean }>> {
    if (!currentUserId || decks.length === 0) {
        return decks.map((deck) => ({ ...deck, isAdded: false }));
    }

    const deckIds = Array.from(new Set(decks.map((deck) => deck.id)));
    const cloneRows = await db
        .select({
            originalDeckId: deckClones.originalDeckId,
        })
        .from(deckClones)
        .where(and(eq(deckClones.userId, currentUserId), inArray(deckClones.originalDeckId, deckIds)));
    const clonedDeckIds = new Set(cloneRows.map((row) => row.originalDeckId));

    return decks.map((deck) => ({
        ...deck,
        isAdded: deck.userId === currentUserId || clonedDeckIds.has(deck.id),
    }));
}
