import { and, count, desc, eq } from 'drizzle-orm';
import type { ResultAsync } from 'neverthrow';
import { errAsync } from 'neverthrow';
import {
    createId,
    errorFactory,
    ForbiddenError,
    type DatabaseError,
    NotFoundError,
    safeAsync,
    safeValidate,
    ValidationError,
} from '@flashly/shared';
import { db } from '../../db/db.ts';
import { cards, decks } from '../auth/auth-schema.ts';
import { recordSyncChange } from '../sync/sync-ledger.ts';
import { SetVisibilitySchema, type CreateDeckInput, type UpdateDeckInput } from './deck-schema.ts';
import {
    buildDeckPayload,
    getErrorCause,
    type Deck,
    type DeckWithCards,
    type DeckWithStats,
    type PaginatedDecks,
} from './deck-repository-shared.ts';
import { CreateDeckSchema, UpdateDeckSchema } from './deck-schema.ts';

export function createDeckOperation(userId: string, data: CreateDeckInput): ResultAsync<Deck, DatabaseError | ValidationError> {
    const validationResult = safeValidate(CreateDeckSchema, data);
    if (validationResult.isErr()) {
        return errAsync(validationResult.error);
    }

    const now = new Date();
    const deck = {
        id: createId(),
        userId,
        name: data.name.trim(),
        description: data.description?.trim() ?? null,
        accentKey: data.accentKey ?? null,
        materialType: data.materialType ?? null,
        deckType: data.deckType ?? null,
        locale: data.locale ?? null,
        marketplaceMetadata: data.marketplaceMetadata ?? null,
        visibility: data.visibility ?? 'private',
        isFeatured: false,
        downloadCount: 0,
        viewCount: 0,
        lastSyncedAt: null,
        createdAt: now,
        updatedAt: now,
        lastStudiedAt: null,
    };

    return safeAsync(
        (async () => {
            const [result] = await db.insert(decks).values({
                ...deck,
            }).returning();
            const ledger = await recordSyncChange({
                userId,
                entityType: 'deck',
                entityId: result.id,
                operation: 'create',
                payload: buildDeckPayload(result),
            });
            if (ledger.isErr()) {
                throw ledger.error;
            }
            return result;
        })(),
        (error) => errorFactory.database('Failed to create deck', { cause: error })
    );
}

export function getDeckByIdOperation(deckId: string): ResultAsync<DeckWithCards, DatabaseError | NotFoundError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    return safeAsync(
        db.query.decks.findFirst({
            where: eq(decks.id, deckId),
            with: {
                cards: true,
            },
        }).then((deck) => {
            if (!deck) {
                throw errorFactory.notFound('Deck not found');
            }

            return deck;
        }),
        (error) => errorFactory.database('Failed to get deck', { cause: error })
    );
}

export function listUserDecksOperation(
    userId: string,
    options: { page?: number; limit?: number } = {}
): ResultAsync<PaginatedDecks, DatabaseError | ValidationError> {
    if (!userId) {
        return errAsync(
            errorFactory.validation('User ID is required', { field: 'userId' })
        );
    }

    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const offset = (page - 1) * limit;

    return safeAsync(
        (async () => {
            const [countResult] = await db
                .select({ count: count() })
                .from(decks)
                .where(eq(decks.userId, userId));

            const total = countResult?.count ?? 0;
            const totalPages = Math.ceil(total / limit);

            const deckRows = await db
                .select({
                    id: decks.id,
                    userId: decks.userId,
                    name: decks.name,
                    description: decks.description,
                    accentKey: decks.accentKey,
                    materialType: decks.materialType,
                    deckType: decks.deckType,
                    locale: decks.locale,
                    marketplaceMetadata: decks.marketplaceMetadata,
                    visibility: decks.visibility,
                    isFeatured: decks.isFeatured,
                    downloadCount: decks.downloadCount,
                    viewCount: decks.viewCount,
                    lastSyncedAt: decks.lastSyncedAt,
                    createdAt: decks.createdAt,
                    updatedAt: decks.updatedAt,
                    lastStudiedAt: decks.lastStudiedAt,
                    isTemplate: decks.isTemplate,
                    templateId: decks.templateId,
                    templateData: decks.templateData,
                    cardCount: count(cards.id),
                })
                .from(decks)
                .leftJoin(cards, eq(decks.id, cards.deckId))
                .where(eq(decks.userId, userId))
                .groupBy(decks.id)
                .orderBy(desc(decks.lastStudiedAt), desc(decks.createdAt))
                .limit(limit)
                .offset(offset);

            const items: DeckWithStats[] = deckRows.map((row) => ({
                ...row,
                cardCount: Number(row.cardCount ?? 0),
                downloadCount: Number(row.downloadCount ?? 0),
                viewCount: Number(row.viewCount ?? 0),
            }));

            return {
                items,
                total,
                page,
                limit,
                totalPages,
                hasMore: page < totalPages,
            };
        })(),
        (error) => errorFactory.database('Failed to list user decks', { cause: error })
    );
}

export function updateDeckOperation(
    deckId: string,
    userId: string,
    data: UpdateDeckInput
): ResultAsync<Deck, DatabaseError | ValidationError | ForbiddenError | NotFoundError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    if (!userId) {
        return errAsync(
            errorFactory.validation('User ID is required', { field: 'userId' })
        );
    }

    const validationResult = safeValidate(UpdateDeckSchema, data);
    if (validationResult.isErr()) {
        return errAsync(validationResult.error);
    }

    return safeAsync(
        (async () => {
            const [existingDeck] = await db
                .select()
                .from(decks)
                .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
                .limit(1);

            if (!existingDeck) {
                throw errorFactory.notFound('Deck not found or access denied');
            }

            const values: Record<string, unknown> = {
                updatedAt: new Date(),
            };

            if (data.name !== undefined) values.name = data.name.trim();
            if (data.description !== undefined) values.description = data.description?.trim() ?? null;
            if (data.accentKey !== undefined) values.accentKey = data.accentKey;
            if (data.materialType !== undefined) values.materialType = data.materialType;
            if (data.deckType !== undefined) values.deckType = data.deckType;
            if (data.locale !== undefined) values.locale = data.locale;
            if (data.marketplaceMetadata !== undefined) values.marketplaceMetadata = data.marketplaceMetadata;
            if (data.visibility !== undefined) values.visibility = data.visibility;

            const result = await db
                .update(decks)
                .set(values)
                .where(eq(decks.id, deckId))
                .returning();
            const updated = result[0];
            const ledger = await recordSyncChange({
                userId,
                entityType: 'deck',
                entityId: updated.id,
                operation: 'update',
                payload: buildDeckPayload(updated),
            });
            if (ledger.isErr()) {
                console.warn('[DeckRepository] Failed to record deck update in sync ledger', {
                    deckId: updated.id,
                    userId,
                    error: ledger.error,
                    cause: getErrorCause(ledger.error),
                });
            }

            return updated;
        })(),
        (error) =>
            error instanceof ValidationError
            || error instanceof ForbiddenError
            || error instanceof NotFoundError
                ? error
                : errorFactory.database('Failed to update deck', error)
    );
}

export function deleteDeckOperation(deckId: string, userId: string): ResultAsync<void, DatabaseError | ForbiddenError | NotFoundError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    if (!userId) {
        return errAsync(
            errorFactory.validation('User ID is required', { field: 'userId' })
        );
    }

    return safeAsync(
        (async () => {
            const result = await db
                .delete(decks)
                .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
                .returning();

            if (!result[0]) {
                throw errorFactory.notFound('Deck not found or access denied');
            }
            const ledger = await recordSyncChange({
                userId,
                entityType: 'deck',
                entityId: deckId,
                operation: 'delete',
                payload: { id: deckId },
            });
            if (ledger.isErr()) {
                throw ledger.error;
            }
        })(),
        (error) => errorFactory.database('Failed to delete deck', { cause: error })
    );
}

export function setDeckVisibilityOperation(
    deckId: string,
    userId: string,
    visibility: 'public' | 'private'
): ResultAsync<void, DatabaseError | ForbiddenError | NotFoundError | ValidationError> {
    if (!deckId) {
        return errAsync(
            errorFactory.validation('Deck ID is required', { field: 'deckId' })
        );
    }

    if (!userId) {
        return errAsync(
            errorFactory.validation('User ID is required', { field: 'userId' })
        );
    }

    const validationResult = safeValidate(SetVisibilitySchema, { visibility });
    if (validationResult.isErr()) {
        return errAsync(validationResult.error);
    }

    return safeAsync(
        (async () => {
            const [existingDeck] = await db
                .select()
                .from(decks)
                .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
                .limit(1);

            if (!existingDeck) {
                throw errorFactory.forbidden('Deck not found or access denied');
            }

            await db
                .update(decks)
                .set({ visibility, updatedAt: new Date() })
                .where(eq(decks.id, deckId));

            const [updated] = await db
                .select()
                .from(decks)
                .where(eq(decks.id, deckId))
                .limit(1);
            if (updated) {
                const ledger = await recordSyncChange({
                    userId,
                    entityType: 'deck',
                    entityId: updated.id,
                    operation: 'update',
                    payload: buildDeckPayload(updated),
                });
                if (ledger.isErr()) {
                    console.warn('[DeckRepository] Failed to record visibility change in sync ledger', {
                        deckId: updated.id,
                        userId,
                        visibility,
                        error: ledger.error,
                        cause: getErrorCause(ledger.error),
                    });
                }
            }
        })(),
        (error) =>
            error instanceof ValidationError
            || error instanceof ForbiddenError
            || error instanceof NotFoundError
                ? error
                : errorFactory.database('Failed to set deck visibility', error)
    );
}
