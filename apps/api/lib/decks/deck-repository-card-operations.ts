import { and, count, eq, inArray } from 'drizzle-orm';
import type { ResultAsync } from 'neverthrow';
import { errAsync } from 'neverthrow';
import {
    createId,
    errorFactory,
    type DatabaseError,
    ForbiddenError,
    NotFoundError,
    safeAsync,
    ValidationError,
} from '@flashly/shared';
import type { QuizEnrichment } from '@flashly/shared';
import { db } from '../../db/db.ts';
import { cards, decks, syncChanges } from '../auth/auth-schema.ts';
import { recordSyncChange } from '../sync/sync-ledger.ts';
import {
    buildCardPayload,
    normalizeCardFrontKey,
    type Card,
    type CardMutationInput,
    type CardPartialMutationInput,
} from './deck-repository-shared.ts';

async function ensureDeckOwnership(deckId: string, userId: string): Promise<void> {
    const [deck] = await db
        .select({ id: decks.id })
        .from(decks)
        .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
        .limit(1);

    if (!deck) {
        throw errorFactory.notFound('Deck not found or access denied');
    }
}

async function ensureCardsBelongToDeck(cardIds: string[], deckId: string): Promise<void> {
    const cardCountResult = await db
        .select({ count: count() })
        .from(cards)
        .where(
            and(
                eq(cards.deckId, deckId),
                inArray(cards.id, cardIds)
            )
        );

    const actualCount = Number(cardCountResult[0]?.count ?? 0);
    if (actualCount !== cardIds.length) {
        throw errorFactory.validation('One or more cards not found in this deck');
    }
}

export function createCardOperation(
    deckId: string,
    userId: string,
    data: CardMutationInput
): ResultAsync<Card, DatabaseError | ValidationError | NotFoundError | ForbiddenError> {
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

    if (!data.front || !data.front.trim()) {
        return errAsync(
            errorFactory.validation('Card front is required', { field: 'front' })
        );
    }

    if (!data.back || !data.back.trim()) {
        return errAsync(
            errorFactory.validation('Card back is required', { field: 'back' })
        );
    }

    return safeAsync(
        (async () => {
            await ensureDeckOwnership(deckId, userId);

            const now = new Date();
            const card = {
                id: createId(),
                deckId,
                front: data.front.trim(),
                back: data.back.trim(),
                imageUrl: data.imageUrl ?? null,
                audioUrl: data.audioUrl ?? null,
                category: data.category ?? null,
                pos: data.pos ?? null,
                gender: data.gender ?? null,
                example: data.example ?? null,
                tags: data.tags ?? null,
                quiz: data.quiz ?? null,
                isStarred: false,
                learnState: null,
                learnCorrectStreak: null,
                learnCorrectTotal: null,
                learnIncorrectTotal: null,
                learnLastAnsweredAt: null,
                createdAt: now,
                updatedAt: now,
                lastReviewedAt: null,
                due: null,
                stability: null,
                difficulty: null,
                elapsed_days: null,
                scheduled_days: null,
                learning_steps: null,
                reps: null,
                lapses: null,
                state: null,
            };

            const [result] = await db.insert(cards).values(card).returning();
            const ledger = await recordSyncChange({
                userId,
                entityType: 'card',
                entityId: result.id,
                operation: 'create',
                payload: buildCardPayload(result),
            });
            if (ledger.isErr()) {
                throw ledger.error;
            }

            return result;
        })(),
        (error) => errorFactory.database('Failed to create card', { cause: error })
    );
}

export function bulkCreateCardsOperation(
    deckId: string,
    userId: string,
    items: CardMutationInput[]
): ResultAsync<{ count: number; skippedDuplicates: number }, DatabaseError | ValidationError | NotFoundError | ForbiddenError> {
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

    if (!items || items.length === 0) {
        return errAsync(
            errorFactory.validation('Cards are required', { field: 'cards' })
        );
    }

    return safeAsync(
        (async () => {
            await ensureDeckOwnership(deckId, userId);

            const existingDeckCards = await db
                .select({ front: cards.front })
                .from(cards)
                .where(eq(cards.deckId, deckId));

            const seenFronts = new Set(
                existingDeckCards
                    .map((row) => normalizeCardFrontKey(row.front))
                    .filter(Boolean)
            );

            const now = new Date();
            const rowsToCreate: Card[] = [];
            let skippedDuplicates = 0;

            for (const item of items) {
                const front = item.front.trim();
                const back = item.back.trim();

                if (!front) {
                    throw errorFactory.validation('Card front is required', { field: 'front' });
                }

                if (!back) {
                    throw errorFactory.validation('Card back is required', { field: 'back' });
                }

                const frontKey = normalizeCardFrontKey(front);
                if (!frontKey) {
                    throw errorFactory.validation('Card front is required', { field: 'front' });
                }

                if (seenFronts.has(frontKey)) {
                    skippedDuplicates += 1;
                    continue;
                }

                seenFronts.add(frontKey);

                rowsToCreate.push({
                    id: createId(),
                    deckId,
                    front,
                    back,
                    imageUrl: item.imageUrl ?? null,
                    audioUrl: item.audioUrl ?? null,
                    category: item.category ?? null,
                    pos: item.pos ?? null,
                    gender: item.gender ?? null,
                    example: item.example ?? null,
                    tags: item.tags ?? null,
                    quiz: item.quiz ?? null,
                    isStarred: false,
                    learnState: null,
                    learnCorrectStreak: null,
                    learnCorrectTotal: null,
                    learnIncorrectTotal: null,
                    learnLastAnsweredAt: null,
                    createdAt: now,
                    updatedAt: now,
                    lastReviewedAt: null,
                    due: null,
                    stability: null,
                    difficulty: null,
                    elapsed_days: null,
                    scheduled_days: null,
                    learning_steps: null,
                    reps: null,
                    lapses: null,
                    state: null,
                });
            }

            if (rowsToCreate.length === 0) {
                return { count: 0, skippedDuplicates };
            }

            const createdRows = await db.insert(cards).values(rowsToCreate).returning();

            for (const row of createdRows) {
                const ledger = await recordSyncChange({
                    userId,
                    entityType: 'card',
                    entityId: row.id,
                    operation: 'create',
                    payload: buildCardPayload(row),
                });
                if (ledger.isErr()) {
                    throw ledger.error;
                }
            }

            return { count: createdRows.length, skippedDuplicates };
        })(),
        (error) => errorFactory.database('Failed to create cards', { cause: error })
    );
}

export function updateCardOperation(
    cardId: string,
    deckId: string,
    userId: string,
    data: CardPartialMutationInput
): ResultAsync<Card, DatabaseError | ValidationError | NotFoundError | ForbiddenError> {
    if (!cardId) {
        return errAsync(
            errorFactory.validation('Card ID is required', { field: 'cardId' })
        );
    }

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
            await ensureDeckOwnership(deckId, userId);

            const values: Record<string, unknown> = {
                updatedAt: new Date(),
            };

            if (data.front !== undefined) values.front = data.front.trim();
            if (data.back !== undefined) values.back = data.back.trim();
            if (data.imageUrl !== undefined) values.imageUrl = data.imageUrl;
            if (data.audioUrl !== undefined) values.audioUrl = data.audioUrl;
            if (data.category !== undefined) values.category = data.category;
            if (data.pos !== undefined) values.pos = data.pos;
            if (data.gender !== undefined) values.gender = data.gender;
            if (data.example !== undefined) values.example = data.example;
            if (data.tags !== undefined) values.tags = data.tags;
            if (data.quiz !== undefined) values.quiz = data.quiz;

            const [result] = await db
                .update(cards)
                .set(values)
                .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)))
                .returning();

            if (!result) {
                throw errorFactory.notFound('Card not found');
            }

            const ledger = await recordSyncChange({
                userId,
                entityType: 'card',
                entityId: result.id,
                operation: 'update',
                payload: buildCardPayload(result),
            });
            if (ledger.isErr()) {
                throw ledger.error;
            }

            return result;
        })(),
        (error) => errorFactory.database('Failed to update card', { cause: error })
    );
}

export function deleteCardOperation(
    cardId: string,
    deckId: string,
    userId: string
): ResultAsync<void, DatabaseError | NotFoundError | ForbiddenError> {
    if (!cardId) {
        return errAsync(
            errorFactory.validation('Card ID is required', { field: 'cardId' })
        );
    }

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
            await ensureDeckOwnership(deckId, userId);

            const result = await db
                .delete(cards)
                .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)))
                .returning();

            if (!result[0]) {
                throw errorFactory.notFound('Card not found');
            }

            const ledger = await recordSyncChange({
                userId,
                entityType: 'card',
                entityId: cardId,
                operation: 'delete',
                payload: { id: cardId, deckId },
            });
            if (ledger.isErr()) {
                throw ledger.error;
            }
        })(),
        (error) => errorFactory.database('Failed to delete card', { cause: error })
    );
}

export function bulkDeleteCardsOperation(
    cardIds: string[],
    deckId: string,
    userId: string
): ResultAsync<{ count: number }, DatabaseError | NotFoundError | ForbiddenError> {
    if (!cardIds || cardIds.length === 0) {
        return errAsync(
            errorFactory.validation('Card IDs are required', { field: 'cardIds' })
        );
    }

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
            await ensureDeckOwnership(deckId, userId);
            await ensureCardsBelongToDeck(cardIds, deckId);

            const result = await db
                .delete(cards)
                .where(
                    and(
                        eq(cards.deckId, deckId),
                        inArray(cards.id, cardIds)
                    )
                )
                .returning();

            for (const row of result) {
                const ledger = await recordSyncChange({
                    userId,
                    entityType: 'card',
                    entityId: row.id,
                    operation: 'delete',
                    payload: { id: row.id, deckId },
                });
                if (ledger.isErr()) {
                    throw ledger.error;
                }
            }

            return { count: result.length };
        })(),
        (error) => errorFactory.database('Failed to delete cards', { cause: error })
    );
}

export function bulkUpdateCardsOperation(
    cardIds: string[],
    deckId: string,
    userId: string,
    data: {
        category?: string;
        tags?: string;
    }
): ResultAsync<{ count: number }, DatabaseError | NotFoundError | ForbiddenError> {
    if (!cardIds || cardIds.length === 0) {
        return errAsync(
            errorFactory.validation('Card IDs are required', { field: 'cardIds' })
        );
    }

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
            await ensureDeckOwnership(deckId, userId);
            await ensureCardsBelongToDeck(cardIds, deckId);

            const values: Record<string, unknown> = {
                updatedAt: new Date(),
            };

            if (data.category !== undefined) values.category = data.category;
            if (data.tags !== undefined) values.tags = data.tags;

            const result = await db
                .update(cards)
                .set(values)
                .where(
                    and(
                        eq(cards.deckId, deckId),
                        inArray(cards.id, cardIds)
                    )
                )
                .returning();

            for (const row of result) {
                const ledger = await recordSyncChange({
                    userId,
                    entityType: 'card',
                    entityId: row.id,
                    operation: 'update',
                    payload: buildCardPayload(row),
                });
                if (ledger.isErr()) {
                    throw ledger.error;
                }
            }

            return { count: result.length };
        })(),
        (error) => errorFactory.database('Failed to update cards', { cause: error })
    );
}

export function bulkUpdateCardQuizzesOperation(
    updates: Array<{ cardId: string; quiz: QuizEnrichment | null }>,
    deckId: string,
    userId: string
): ResultAsync<{ count: number }, DatabaseError | NotFoundError | ForbiddenError | ValidationError> {
    if (!updates || updates.length === 0) {
        return errAsync(
            errorFactory.validation('Quiz updates are required', { field: 'updates' })
        );
    }

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

    const cardIds = updates.map((update) => update.cardId);
    if (new Set(cardIds).size !== cardIds.length) {
        return errAsync(
            errorFactory.validation('Card IDs must be unique', { field: 'updates' })
        );
    }

    return safeAsync(
        db.transaction(async (tx) => {
            const [deck] = await tx
                .select({ id: decks.id })
                .from(decks)
                .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
                .limit(1);

            if (!deck) {
                throw errorFactory.notFound('Deck not found or access denied');
            }

            const cardCountResult = await tx
                .select({ count: count() })
                .from(cards)
                .where(
                    and(
                        eq(cards.deckId, deckId),
                        inArray(cards.id, cardIds),
                    )
                );

            const actualCount = Number(cardCountResult[0]?.count ?? 0);
            if (actualCount !== cardIds.length) {
                throw errorFactory.validation('One or more cards not found in this deck');
            }

            const now = new Date();
            let changedCount = 0;

            for (const update of updates) {
                const [updatedCard] = await tx
                    .update(cards)
                    .set({
                        quiz: update.quiz,
                        updatedAt: now,
                    })
                    .where(and(eq(cards.id, update.cardId), eq(cards.deckId, deckId)))
                    .returning();

                if (!updatedCard) {
                    throw errorFactory.notFound('Card not found');
                }

                const [ledgerEntry] = await tx
                    .insert(syncChanges)
                    .values({
                        userId,
                        entityType: 'card',
                        entityId: updatedCard.id,
                        operation: 'update',
                        payload: buildCardPayload(updatedCard),
                    })
                    .returning();

                if (!ledgerEntry) {
                    throw errorFactory.database('Failed to record sync change');
                }

                changedCount += 1;
            }

            return { count: changedCount };
        }),
        (error) =>
            error instanceof ValidationError
            || error instanceof ForbiddenError
            || error instanceof NotFoundError
                ? error
                : errorFactory.database('Failed to update card quizzes', { cause: error })
    );
}
