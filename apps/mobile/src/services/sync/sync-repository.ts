/**
 * Sync repository - Local database operations for sync state management
 */

import { ResultAsync } from 'neverthrow';
import { eq, and, or, isNull, lte, asc, sql, gt } from 'drizzle-orm';
import { DatabaseError } from '@flashly/shared';
import { getDb } from '../../db/database';
import { syncState, syncQueue } from '../../db/schema';
import { createId } from '../../utils/ids';
import type { SyncQueueItem, LocalSyncState } from './sync-types';
import type { EntityType, SyncOperation } from './sync-types';

export function serializeSyncQueuePayload(payload: Record<string, unknown>): string {
    return JSON.stringify(payload);
}

// ============================================================================
// SYNC REPOSITORY CLASS
// ============================================================================

export class SyncRepository {
    /**
     * Initialize sync state for a user
     */
    initializeSyncState(userId: string): ResultAsync<LocalSyncState, DatabaseError> {
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                const existing = await db.select().from(syncState).where(eq(syncState.id, userId));

                if (existing.length > 0) {
                    const current = existing[0];
                    return {
                        id: current.id,
                        lastSyncAt: current.lastSyncAt,
                        pendingUploads: current.pendingUploads,
                        pendingDownloads: current.pendingDownloads,
                        syncCursor: current.syncCursor ?? undefined,
                    };
                }

                const newState: LocalSyncState = {
                    id: userId,
                    lastSyncAt: 0,
                    pendingUploads: 0,
                    pendingDownloads: 0,
                };

                await db.insert(syncState).values(newState);

                return newState;
            })(),
            (error) => new DatabaseError('Failed to initialize sync state', { cause: error })
        );
    }

    /**
     * Get sync state for user
     */
    getSyncState(userId: string): ResultAsync<LocalSyncState | null, DatabaseError> {
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                const result = await db.select().from(syncState).where(eq(syncState.id, userId));
                const row = result[0];
                if (!row) {
                    return null;
                }
                return {
                    id: row.id,
                    lastSyncAt: row.lastSyncAt,
                    pendingUploads: row.pendingUploads,
                    pendingDownloads: row.pendingDownloads,
                    syncCursor: row.syncCursor ?? undefined,
                };
            })(),
            (error) => new DatabaseError('Failed to get sync state', { cause: error })
        );
    }

    /**
     * Update sync state
     */
    updateSyncState(
        userId: string,
        updates: Partial<Omit<LocalSyncState, 'id'>>
    ): ResultAsync<void, DatabaseError> {
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                await db.update(syncState)
                    .set(updates)
                    .where(eq(syncState.id, userId));
            })(),
            (error) => new DatabaseError('Failed to update sync state', { cause: error })
        );
    }

    /**
     * Enqueue an operation for sync
     */
    enqueueOperation(
        entityType: EntityType,
        entityId: string,
        operation: SyncOperation,
        payload: Record<string, unknown>,
        userId?: string | null
    ): ResultAsync<void, DatabaseError> {
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                const id = createId();
                const now = Date.now();

                const queueItem: SyncQueueItem = {
                    id,
                    entityType,
                    entityId,
                    operation,
                    payload: serializeSyncQueuePayload(payload),
                    createdAt: now,
                    retries: 0,
                    userId: userId ?? null,
                };

                await db.insert(syncQueue).values(queueItem);

                // Increment pending uploads count
                await this.incrementPendingUploads(userId ?? null);
            })(),
            (error) => new DatabaseError('Failed to enqueue operation', { cause: error })
        );
    }

    /**
     * Get pending operations from queue
     */
    getPendingOperations(options: { limit?: number; userId?: string | null; maxRetries?: number } = {}): ResultAsync<SyncQueueItem[], DatabaseError> {
        const { limit = 50, userId, maxRetries } = options;

        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                const userCondition = userId
                    ? or(eq(syncQueue.userId, userId), isNull(syncQueue.userId))
                    : undefined;
                const retriesCondition = maxRetries !== undefined
                    ? lte(syncQueue.retries, maxRetries)
                    : undefined;
                const whereClause = userCondition && retriesCondition
                    ? and(userCondition, retriesCondition)
                    : (userCondition ?? retriesCondition);

                const rows = await db.select()
                    .from(syncQueue)
                    .where(whereClause)
                    .orderBy(asc(syncQueue.createdAt))
                    .limit(limit);
                return rows.map((row) => ({
                    id: row.id,
                    userId: row.userId,
                    entityType: row.entityType,
                    entityId: row.entityId,
                    operation: row.operation,
                    payload: row.payload,
                    createdAt: row.createdAt,
                    retries: row.retries,
                    lastAttemptAt: row.lastAttemptAt ?? undefined,
                    error: row.error ?? undefined,
                }));
            })(),
            (error) => new DatabaseError('Failed to get pending operations', { cause: error })
        );
    }

    /**
     * Claim anonymous operations for a user
     */
    claimAnonymousOperations(userId: string): ResultAsync<void, DatabaseError> {
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                await db
                    .update(syncQueue)
                    .set({ userId })
                    .where(isNull(syncQueue.userId));
            })(),
            (error) => new DatabaseError('Failed to claim anonymous operations', { cause: error })
        );
    }

    /**
     * Mark operation as complete (remove from queue)
     */
    markOperationComplete(operationId: string, userId?: string | null): ResultAsync<void, DatabaseError> {
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                const whereClause = userId
                    ? and(eq(syncQueue.id, operationId), or(eq(syncQueue.userId, userId), isNull(syncQueue.userId)))
                    : eq(syncQueue.id, operationId);
                await db.delete(syncQueue).where(whereClause);

                // Decrement pending uploads count
                await this.decrementPendingUploads(userId ?? null);
            })(),
            (error) => new DatabaseError('Failed to mark operation complete', { cause: error })
        );
    }

    /**
     * Mark operation as failed (increment retry count)
     */
    markOperationFailed(
        operationId: string,
        errorMessage: string,
        userId?: string | null
    ): ResultAsync<void, DatabaseError> {
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                const now = Date.now();
                const whereClause = userId
                    ? and(eq(syncQueue.id, operationId), or(eq(syncQueue.userId, userId), isNull(syncQueue.userId)))
                    : eq(syncQueue.id, operationId);
                await db.update(syncQueue)
                    .set({
                        retries: sql`${syncQueue.retries} + 1`,
                        lastAttemptAt: now,
                        error: errorMessage,
                    })
                    .where(whereClause);
            })(),
            (error) => new DatabaseError('Failed to mark operation failed', { cause: error })
        );
    }

    /**
     * Remove failed operations that have exceeded max retries
     */
    clearFailedOperations(maxRetries: number, userId?: string | null): ResultAsync<void, DatabaseError> {
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                const whereClause = userId
                    ? and(
                        or(eq(syncQueue.userId, userId), isNull(syncQueue.userId)),
                        gt(syncQueue.retries, maxRetries)
                    )
                    : gt(syncQueue.retries, maxRetries);
                await db.delete(syncQueue)
                    .where(whereClause);
            })(),
            (error) => new DatabaseError('Failed to clear failed operations', { cause: error })
        );
    }

    /**
     * Clear all operations (for testing or reset)
     */
    clearAllOperations(): ResultAsync<void, DatabaseError> {
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                await db.delete(syncQueue);
                await this.resetPendingCounts();
            })(),
            (error) => new DatabaseError('Failed to clear all operations', { cause: error })
        );
    }

    /**
     * Get count of pending operations
     */
    getPendingCount(userId?: string | null, maxRetries?: number): ResultAsync<number, DatabaseError> {
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                const userCondition = userId
                    ? or(eq(syncQueue.userId, userId), isNull(syncQueue.userId))
                    : undefined;
                const retriesCondition = maxRetries !== undefined
                    ? lte(syncQueue.retries, maxRetries)
                    : undefined;
                const whereClause = userCondition && retriesCondition
                    ? and(userCondition, retriesCondition)
                    : (userCondition ?? retriesCondition);
                const [row] = await db
                    .select({ count: sql<number>`count(*)`.as('count') })
                    .from(syncQueue)
                    .where(whereClause);
                return Number(row?.count ?? 0);
            })(),
            (error) => new DatabaseError('Failed to get pending count', { cause: error })
        );
    }

    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================

    private async incrementPendingUploads(userId?: string | null): Promise<void> {
        const db = await getDb();
        const states = userId
            ? await db.select().from(syncState).where(eq(syncState.id, userId)).limit(1)
            : await db.select().from(syncState).limit(1);

        if (states.length > 0) {
            const state = states[0];
            await db.update(syncState)
                .set({ pendingUploads: (state.pendingUploads || 0) + 1 })
                .where(eq(syncState.id, state.id));
        }
    }

    private async decrementPendingUploads(userId?: string | null): Promise<void> {
        const db = await getDb();
        const states = userId
            ? await db.select().from(syncState).where(eq(syncState.id, userId)).limit(1)
            : await db.select().from(syncState).limit(1);

        if (states.length > 0) {
            const state = states[0];
            await db.update(syncState)
                .set({ pendingUploads: Math.max(0, (state.pendingUploads || 0) - 1) })
                .where(eq(syncState.id, state.id));
        }
    }

    private async resetPendingCounts(): Promise<void> {
        const db = await getDb();
        const states = await db.select().from(syncState).limit(1);

        if (states.length > 0) {
            await db.update(syncState)
                .set({ pendingUploads: 0, pendingDownloads: 0 })
                .where(eq(syncState.id, states[0].id));
        }
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let syncRepositoryInstance: SyncRepository | null = null;

export function getSyncRepository(): SyncRepository {
    if (!syncRepositoryInstance) {
        syncRepositoryInstance = new SyncRepository();
    }
    return syncRepositoryInstance;
}
