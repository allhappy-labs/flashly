import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import type { ResultAsync } from 'neverthrow';
import { errAsync } from 'neverthrow';
import {
    ConflictError,
    errorFactory,
    QuizEnrichmentSchema,
    safeAsync,
    SyncError,
    type DatabaseError,
    type ValidationError,
} from '@flashly/shared';
import { db } from '../../db/db.ts';
import { decks, cards, syncChanges } from '../auth/auth-schema.ts';
import { deckRepository } from '../decks/deck-repository.ts';
import { encodeSyncCursor, parseSyncCursor, recordSyncChange } from './sync-ledger.ts';
import type {
    SyncResult,
    FullSyncRequest,
    IncrementalSyncRequest,
    SyncChange,
    SyncLedgerChange,
} from './sync-types.ts';

// ============================================================================
// HELPERS
// ============================================================================

function toDate(value?: string | number | Date | null): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.valueOf()) ? null : parsed;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function toIso(value?: Date | null): string | null {
    if (!value) return null;
    return value.toISOString();
}

function normalizeTags(value?: string | string[] | null): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
    } catch {
        // fallthrough
    }
    return value
        .split(/[;,]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function normalizeQuiz(value: unknown) {
    const result = QuizEnrichmentSchema.safeParse(value);
    return result.success ? result.data : null;
}

function buildDeckPayload(deck: typeof decks.$inferSelect) {
    return {
        id: deck.id,
        userId: deck.userId,
        name: deck.name,
        description: deck.description ?? null,
        accentKey: deck.accentKey ?? null,
        materialType: deck.materialType ?? null,
        deckType: deck.deckType ?? null,
        locale: deck.locale ?? null,
        marketplaceMetadata: deck.marketplaceMetadata ?? null,
        visibility: deck.visibility,
        isFeatured: deck.isFeatured,
        downloadCount: Number(deck.downloadCount ?? 0),
        viewCount: Number(deck.viewCount ?? 0),
        lastSyncedAt: toIso(deck.lastSyncedAt),
        createdAt: toIso(deck.createdAt),
        updatedAt: toIso(deck.updatedAt),
        lastStudiedAt: toIso(deck.lastStudiedAt),
    };
}

function buildCardPayload(card: typeof cards.$inferSelect) {
    return {
        id: card.id,
        deckId: card.deckId,
        front: card.front,
        back: card.back,
        imageUrl: card.imageUrl ?? null,
        audioUrl: card.audioUrl ?? null,
        category: card.category ?? null,
        pos: card.pos ?? null,
        gender: card.gender ?? null,
        example: card.example ?? null,
        tags: normalizeTags(card.tags),
        quiz: normalizeQuiz(card.quiz),
        isStarred: card.isStarred ?? false,
        learnState: card.learnState ?? null,
        learnCorrectStreak: card.learnCorrectStreak ?? null,
        learnCorrectTotal: card.learnCorrectTotal ?? null,
        learnIncorrectTotal: card.learnIncorrectTotal ?? null,
        learnLastAnsweredAt: toIso(card.learnLastAnsweredAt),
        createdAt: toIso(card.createdAt),
        updatedAt: toIso(card.updatedAt),
        lastReviewedAt: toIso(card.lastReviewedAt),
        due: toIso(card.due),
        stability: card.stability ?? null,
        difficulty: card.difficulty ?? null,
        elapsed_days: card.elapsed_days ?? null,
        scheduled_days: card.scheduled_days ?? null,
        learning_steps: card.learning_steps ?? null,
        reps: card.reps ?? null,
        lapses: card.lapses ?? null,
        state: card.state ?? null,
    };
}

function chunkArray<T>(items: T[], size: number): T[][] {
    if (items.length === 0) return [];
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sync payloads are schemaless cross-version blobs
function isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null;
}

// ============================================================================
// SYNC SERVICE
// ============================================================================

export class SyncService {
    /**
     * Perform full bidirectional sync (cursor reset)
     */
    fullSync(request: FullSyncRequest): ResultAsync<SyncResult, DatabaseError | ValidationError | SyncError | ConflictError> {
        if (!request.userId) {
            return errAsync(
                errorFactory.validation('User ID is required', { field: 'userId' })
            );
        }

        const startTime = Date.now();

        return safeAsync(
            (async () => {
                const syncStateResult = await deckRepository.getOrCreateSyncState(request.userId);
                if (syncStateResult.isErr()) {
                    throw syncStateResult.error;
                }

                let uploaded = 0;
                if (request.clientDecks && request.clientDecks.length > 0) {
                    const changes = this.flattenClientDecks(request.clientDecks);
                    const uploadResult = await this.processChanges(request.userId, changes);
                    if (uploadResult.isErr()) {
                        throw uploadResult.error;
                    }
                    uploaded = uploadResult.value;
                }

                await this.ensureLedgerSeeded(request.userId);

                const downloadResult = await this.getLedgerChanges(request.userId, 0, 500);
                if (downloadResult.isErr()) {
                    throw downloadResult.error;
                }

                const { changes, nextCursor, hasMore } = downloadResult.value;

                await deckRepository.updateSyncState(request.userId, {
                    lastSyncAt: new Date(),
                    syncCursor: encodeSyncCursor(nextCursor),
                    pendingChanges: 0,
                });

                return {
                    success: true,
                    direction: 'bidirectional',
                    uploaded,
                    downloaded: changes.length,
                    deleted: changes.filter((c) => c.operation === 'delete').length,
                    conflicts: [],
                    duration: Date.now() - startTime,
                    syncedAt: new Date(),
                    changes,
                    cursor: encodeSyncCursor(nextCursor),
                    hasMore,
                } satisfies SyncResult;
            })(),
            (error) => {
                if (error instanceof ConflictError) return error;
                return new SyncError('Full sync failed', { cause: error });
            }
        );
    }

    /**
     * Perform incremental sync (ledger-based)
     */
    incrementalSync(request: IncrementalSyncRequest): ResultAsync<SyncResult, DatabaseError | ValidationError | SyncError | ConflictError> {
        if (!request.userId) {
            return errAsync(
                errorFactory.validation('User ID is required', { field: 'userId' })
            );
        }

        const startTime = Date.now();

        return safeAsync(
            (async () => {
                const syncStateResult = await deckRepository.getOrCreateSyncState(request.userId);
                if (syncStateResult.isErr()) {
                    throw syncStateResult.error;
                }
                const syncState = syncStateResult.value;

                const baseCursor = parseSyncCursor(request.cursor ?? syncState.syncCursor);
                let uploaded = 0;

                if (request.changes && request.changes.length > 0) {
                    const uploadResult = await this.processChanges(request.userId, request.changes);
                    if (uploadResult.isErr()) {
                        throw uploadResult.error;
                    }
                    uploaded = uploadResult.value;
                }

                if (baseCursor === 0) {
                    await this.ensureLedgerSeeded(request.userId);
                }

                const downloadResult = await this.getLedgerChanges(
                    request.userId,
                    baseCursor,
                    request.limit ?? 200
                );
                if (downloadResult.isErr()) {
                    throw downloadResult.error;
                }

                const { changes, nextCursor, hasMore } = downloadResult.value;

                await deckRepository.updateSyncState(request.userId, {
                    lastSyncAt: new Date(),
                    syncCursor: encodeSyncCursor(nextCursor),
                    pendingChanges: 0,
                });

                return {
                    success: true,
                    direction: 'bidirectional',
                    uploaded,
                    downloaded: changes.length,
                    deleted: changes.filter((c) => c.operation === 'delete').length,
                    conflicts: [],
                    duration: Date.now() - startTime,
                    syncedAt: new Date(),
                    changes,
                    cursor: encodeSyncCursor(nextCursor),
                    hasMore,
                } satisfies SyncResult;
            })(),
            (error) => {
                if (error instanceof ConflictError) return error;
                return new SyncError('Incremental sync failed', { cause: error });
            }
        );
    }

    /**
     * Get user's sync state
     */
    getSyncState(userId: string) {
        return deckRepository.getOrCreateSyncState(userId);
    }

    // =========================================================================
    // PRIVATE METHODS
    // =========================================================================

    private flattenClientDecks(clientDecks: FullSyncRequest['clientDecks']): SyncChange[] {
        if (!clientDecks) return [];
        const changes: SyncChange[] = [];

        for (const deck of clientDecks) {
            changes.push({
                entityType: 'deck',
                entityId: deck.id,
                operation: 'update',
                data: deck,
                clientUpdatedAt: deck.updatedAt?.toISOString(),
            });

            if (deck.cards) {
                for (const card of deck.cards) {
                    changes.push({
                        entityType: 'card',
                        entityId: card.id,
                        operation: 'update',
                        data: card,
                        clientUpdatedAt: card.updatedAt?.toISOString(),
                    });
                }
            }
        }

        return changes;
    }

    private getLedgerChanges(
        userId: string,
        cursor: number,
        limit: number
    ): ResultAsync<{ changes: SyncLedgerChange[]; nextCursor: number; hasMore: boolean }, DatabaseError> {
        return safeAsync(
            (async () => {
                const rows = await db
                    .select()
                    .from(syncChanges)
                    .where(and(eq(syncChanges.userId, userId), gt(syncChanges.seq, cursor)))
                    .orderBy(asc(syncChanges.seq))
                    .limit(limit);

                const changes: SyncLedgerChange[] = rows.map((row) => ({
                    seq: row.seq,
                    entityType: row.entityType,
                    entityId: row.entityId,
                    operation: row.operation,
                    data: row.payload ?? undefined,
                    changedAt: row.changedAt.toISOString(),
                }));

                const nextCursor = changes.length > 0 ? changes[changes.length - 1].seq : cursor;
                const hasMore = rows.length === limit;

                return { changes, nextCursor, hasMore };
            })(),
            (error) => errorFactory.database('Failed to load sync changes', { cause: error })
        );
    }

    private processChanges(userId: string, changes: SyncChange[]): ResultAsync<number, DatabaseError | ValidationError> {
        return safeAsync(
            (async () => {
                let processed = 0;

                for (const change of changes) {
                    if (change.entityType === 'deck') {
                        if (change.operation === 'delete') {
                            const deleted = await this.applyDeckDelete(userId, change.entityId);
                            if (deleted) processed += 1;
                        } else {
                            const deckData = isRecord(change.data) ? change.data : {};
                            const applied = await this.applyDeckUpsert(userId, deckData, change.clientUpdatedAt);
                            if (applied) processed += 1;
                        }
                    } else if (change.entityType === 'card') {
                        if (change.operation === 'delete') {
                            const cardDeleteData = isRecord(change.data) ? change.data : {};
                            const deleted = await this.applyCardDelete(userId, change.entityId, cardDeleteData);
                            if (deleted) processed += 1;
                        } else {
                            const cardData = isRecord(change.data) ? change.data : {};
                            const applied = await this.applyCardUpsert(userId, cardData, change.clientUpdatedAt);
                            if (applied) processed += 1;
                        }
                    }
                }

                return processed;
            })(),
            (error) => errorFactory.database('Failed to process sync changes', { cause: error })
        );
    }

    private ensureLedgerSeeded(userId: string): Promise<void> {
        return db.transaction(async (tx) => {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`sync-seed:${userId}`}))`);

            const [existingLedgerRow] = await tx
                .select({ seq: syncChanges.seq })
                .from(syncChanges)
                .where(eq(syncChanges.userId, userId))
                .limit(1);

            if (existingLedgerRow) {
                return;
            }

            const userDecks = await tx
                .select()
                .from(decks)
                .where(eq(decks.userId, userId))
                .orderBy(asc(decks.createdAt), asc(decks.id));

            if (userDecks.length === 0) {
                return;
            }

            for (const deckChunk of chunkArray(userDecks, 200)) {
                await tx.insert(syncChanges).values(
                    deckChunk.map((deck) => ({
                        userId,
                        entityType: 'deck' as const,
                        entityId: deck.id,
                        operation: 'create' as const,
                        changedAt: deck.updatedAt ?? deck.createdAt ?? new Date(),
                        payload: buildDeckPayload(deck),
                    }))
                );
            }

            const deckIds = userDecks.map((deck) => deck.id);
            const userCards = deckIds.length > 0
                ? await tx
                    .select()
                    .from(cards)
                    .where(inArray(cards.deckId, deckIds))
                    .orderBy(asc(cards.createdAt), asc(cards.id))
                : [];

            for (const cardChunk of chunkArray(userCards, 500)) {
                await tx.insert(syncChanges).values(
                    cardChunk.map((card) => ({
                        userId,
                        entityType: 'card' as const,
                        entityId: card.id,
                        operation: 'create' as const,
                        changedAt: card.updatedAt ?? card.createdAt ?? new Date(),
                        payload: buildCardPayload(card),
                    }))
                );
            }
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sync payloads are schemaless cross-version blobs
    private async applyDeckUpsert(userId: string, data: Record<string, any>, clientUpdatedAt?: string): Promise<boolean> {
        if (!data?.id) {
            throw errorFactory.validation('Deck ID is required', { field: 'id' });
        }

        const clientUpdated = toDate(clientUpdatedAt) ?? toDate(data.updatedAt) ?? new Date();

        const [existing] = await db
            .select()
            .from(decks)
            .where(eq(decks.id, data.id))
            .limit(1);

        if (existing) {
            if (existing.userId !== userId) {
                throw errorFactory.forbidden('Deck access denied');
            }

            const serverUpdated = existing.updatedAt ?? new Date(0);
            if (clientUpdated <= serverUpdated) {
                return false;
            }

            const values: Record<string, unknown> = {
                updatedAt: clientUpdated,
            };
            if (data.name !== undefined) values.name = String(data.name).trim();
            if (data.description !== undefined) values.description = data.description ?? null;
            if (data.accentKey !== undefined) values.accentKey = data.accentKey ?? null;
            if (data.materialType !== undefined) values.materialType = data.materialType ?? null;
            if (data.deckType !== undefined) values.deckType = data.deckType ?? null;
            if (data.locale !== undefined) values.locale = data.locale ?? null;
            if (data.marketplaceMetadata !== undefined) {
                values.marketplaceMetadata = data.marketplaceMetadata ?? null;
            }
            if (data.visibility !== undefined) values.visibility = data.visibility ?? 'private';
            if (data.lastStudiedAt !== undefined) values.lastStudiedAt = toDate(data.lastStudiedAt);

            const [updated] = await db
                .update(decks)
                .set(values)
                .where(eq(decks.id, data.id))
                .returning();

            const ledger = await recordSyncChange({
                userId,
                entityType: 'deck',
                entityId: updated.id,
                operation: 'update',
                payload: buildDeckPayload(updated),
            });
            if (ledger.isErr()) {
                throw ledger.error;
            }

            return true;
        }

        if (!data?.name) {
            throw errorFactory.validation('Deck name is required', { field: 'name' });
        }

        const createdAt = toDate(data.createdAt) ?? clientUpdated;
        const [inserted] = await db
            .insert(decks)
            .values({
                id: data.id,
                userId,
                name: String(data.name).trim(),
                description: data.description ?? null,
                accentKey: data.accentKey ?? null,
                materialType: data.materialType ?? null,
                deckType: data.deckType ?? null,
                locale: data.locale ?? null,
                marketplaceMetadata: data.marketplaceMetadata ?? null,
                visibility: data.visibility ?? 'private',
                isFeatured: false,
                downloadCount: data.downloadCount ?? 0,
                viewCount: data.viewCount ?? 0,
                lastSyncedAt: new Date(),
                createdAt,
                updatedAt: clientUpdated,
                lastStudiedAt: toDate(data.lastStudiedAt),
            })
            .returning();

        const ledger = await recordSyncChange({
            userId,
            entityType: 'deck',
            entityId: inserted.id,
            operation: 'create',
            payload: buildDeckPayload(inserted),
        });
        if (ledger.isErr()) {
            throw ledger.error;
        }

        return true;
    }

    private async applyDeckDelete(userId: string, deckId: string): Promise<boolean> {
        if (!deckId) {
            throw errorFactory.validation('Deck ID is required', { field: 'deckId' });
        }

        const deleted = await db
            .delete(decks)
            .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
            .returning();

        if (!deleted[0]) {
            return false;
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

        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sync payloads are schemaless cross-version blobs
    private async applyCardUpsert(userId: string, data: Record<string, any>, clientUpdatedAt?: string): Promise<boolean> {
        if (!data?.id) {
            throw errorFactory.validation('Card ID is required', { field: 'id' });
        }

        const clientUpdated = toDate(clientUpdatedAt) ?? toDate(data.updatedAt) ?? new Date();

        const [existing] = await db
            .select({
                card: cards,
                deckOwner: decks.userId,
            })
            .from(cards)
            .innerJoin(decks, eq(cards.deckId, decks.id))
            .where(eq(cards.id, data.id))
            .limit(1);

        if (existing) {
            if (existing.deckOwner !== userId) {
                throw errorFactory.forbidden('Card access denied');
            }

            const serverUpdated = existing.card.updatedAt ?? new Date(0);
            if (clientUpdated <= serverUpdated) {
                return false;
            }

            const values: Record<string, unknown> = {
                updatedAt: clientUpdated,
            };

            if (data.front !== undefined) values.front = String(data.front).trim();
            if (data.back !== undefined) values.back = String(data.back).trim();
            if (data.imageUrl !== undefined) values.imageUrl = data.imageUrl ?? null;
            if (data.audioUrl !== undefined) values.audioUrl = data.audioUrl ?? null;
            if (data.category !== undefined) values.category = data.category ?? null;
            if (data.pos !== undefined) values.pos = data.pos ?? null;
            if (data.gender !== undefined) values.gender = data.gender ?? null;
            if (data.example !== undefined) values.example = data.example ?? null;
            if (data.tags !== undefined) values.tags = Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags;
            if (data.quiz !== undefined) values.quiz = normalizeQuiz(data.quiz);
            if (data.isStarred !== undefined) values.isStarred = data.isStarred ?? false;
            if (data.learnState !== undefined) values.learnState = data.learnState ?? null;
            if (data.learnCorrectStreak !== undefined) values.learnCorrectStreak = data.learnCorrectStreak ?? null;
            if (data.learnCorrectTotal !== undefined) values.learnCorrectTotal = data.learnCorrectTotal ?? null;
            if (data.learnIncorrectTotal !== undefined) values.learnIncorrectTotal = data.learnIncorrectTotal ?? null;
            if (data.learnLastAnsweredAt !== undefined) values.learnLastAnsweredAt = toDate(data.learnLastAnsweredAt);
            if (data.lastReviewedAt !== undefined) values.lastReviewedAt = toDate(data.lastReviewedAt);
            if (data.due !== undefined) values.due = toDate(data.due);
            if (data.stability !== undefined) values.stability = data.stability ?? null;
            if (data.difficulty !== undefined) values.difficulty = data.difficulty ?? null;
            if (data.elapsed_days !== undefined) values.elapsed_days = data.elapsed_days ?? null;
            if (data.scheduled_days !== undefined) values.scheduled_days = data.scheduled_days ?? null;
            if (data.learning_steps !== undefined) values.learning_steps = data.learning_steps ?? null;
            if (data.reps !== undefined) values.reps = data.reps ?? null;
            if (data.lapses !== undefined) values.lapses = data.lapses ?? null;
            if (data.state !== undefined) values.state = data.state ?? null;

            const [updated] = await db
                .update(cards)
                .set(values)
                .where(eq(cards.id, data.id))
                .returning();

            const ledger = await recordSyncChange({
                userId,
                entityType: 'card',
                entityId: updated.id,
                operation: 'update',
                payload: buildCardPayload(updated),
            });
            if (ledger.isErr()) {
                throw ledger.error;
            }

            return true;
        }

        if (!data?.deckId) {
            throw errorFactory.validation('Deck ID is required', { field: 'deckId' });
        }
        if (!data?.front || !data?.back) {
            throw errorFactory.validation('Card front/back is required', { field: 'front' });
        }

        const [deck] = await db
            .select()
            .from(decks)
            .where(and(eq(decks.id, data.deckId), eq(decks.userId, userId)))
            .limit(1);
        if (!deck) {
            throw errorFactory.notFound('Deck not found or access denied');
        }

        const createdAt = toDate(data.createdAt) ?? clientUpdated;

        const [inserted] = await db
            .insert(cards)
            .values({
                id: data.id,
                deckId: data.deckId,
                front: String(data.front).trim(),
                back: String(data.back).trim(),
                imageUrl: data.imageUrl ?? null,
                audioUrl: data.audioUrl ?? null,
                category: data.category ?? null,
                pos: data.pos ?? null,
                gender: data.gender ?? null,
                example: data.example ?? null,
                tags: Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags ?? null,
                quiz: data.quiz === undefined ? null : normalizeQuiz(data.quiz),
                isStarred: data.isStarred ?? false,
                learnState: data.learnState ?? null,
                learnCorrectStreak: data.learnCorrectStreak ?? null,
                learnCorrectTotal: data.learnCorrectTotal ?? null,
                learnIncorrectTotal: data.learnIncorrectTotal ?? null,
                learnLastAnsweredAt: toDate(data.learnLastAnsweredAt),
                createdAt,
                updatedAt: clientUpdated,
                lastReviewedAt: toDate(data.lastReviewedAt),
                due: toDate(data.due),
                stability: data.stability ?? null,
                difficulty: data.difficulty ?? null,
                elapsed_days: data.elapsed_days ?? null,
                scheduled_days: data.scheduled_days ?? null,
                learning_steps: data.learning_steps ?? null,
                reps: data.reps ?? null,
                lapses: data.lapses ?? null,
                state: data.state ?? null,
            })
            .returning();

        const ledger = await recordSyncChange({
            userId,
            entityType: 'card',
            entityId: inserted.id,
            operation: 'create',
            payload: buildCardPayload(inserted),
        });
        if (ledger.isErr()) {
            throw ledger.error;
        }

        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sync payloads are schemaless cross-version blobs
    private async applyCardDelete(userId: string, cardId: string, data: Record<string, any>): Promise<boolean> {
        if (!cardId) {
            throw errorFactory.validation('Card ID is required', { field: 'cardId' });
        }

        const [existing] = await db
            .select({
                cardId: cards.id,
                deckId: cards.deckId,
                deckOwner: decks.userId,
            })
            .from(cards)
            .innerJoin(decks, eq(cards.deckId, decks.id))
            .where(eq(cards.id, cardId))
            .limit(1);

        if (!existing || existing.deckOwner !== userId) {
            return false;
        }

        const deleted = await db.delete(cards).where(eq(cards.id, cardId)).returning();
        if (!deleted[0]) {
            return false;
        }

        const ledger = await recordSyncChange({
            userId,
            entityType: 'card',
            entityId: cardId,
            operation: 'delete',
            payload: { id: cardId, deckId: existing.deckId ?? data.deckId },
        });
        if (ledger.isErr()) {
            throw ledger.error;
        }

        return true;
    }

}

// Export singleton instance
export const syncService = new SyncService();
