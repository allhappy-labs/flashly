import { eq } from 'drizzle-orm';
import type { ResultAsync } from 'neverthrow';
import { errAsync } from 'neverthrow';
import { errorFactory, type DatabaseError, safeAsync } from '@flashly/shared';
import { db } from '../../db/db.ts';
import { deckSyncState } from '../auth/auth-schema.ts';
import type { SyncState } from './deck-repository-shared.ts';

export function getOrCreateSyncStateOperation(userId: string): ResultAsync<SyncState, DatabaseError> {
    if (!userId) {
        return errAsync(
            errorFactory.validation('User ID is required', { field: 'userId' })
        );
    }

    return safeAsync(
        (async () => {
            const [syncState] = await db
                .select()
                .from(deckSyncState)
                .where(eq(deckSyncState.userId, userId))
                .limit(1);

            if (syncState) {
                return syncState;
            }

            const [newState] = await db
                .insert(deckSyncState)
                .values({
                    userId,
                    lastSyncAt: new Date(),
                    syncCursor: null,
                    pendingChanges: 0,
                })
                .returning();

            if (!newState) {
                throw errorFactory.database('Failed to create sync state');
            }

            return newState;
        })(),
        (error) => errorFactory.database('Failed to get sync state', { cause: error })
    );
}

export function updateSyncStateOperation(
    userId: string,
    data: {
        lastSyncAt: Date;
        syncCursor?: string | null;
        pendingChanges?: number;
    }
): ResultAsync<SyncState, DatabaseError> {
    if (!userId) {
        return errAsync(
            errorFactory.validation('User ID is required', { field: 'userId' })
        );
    }

    return safeAsync(
        (async () => {
            const [result] = await db
                .update(deckSyncState)
                .set(data)
                .where(eq(deckSyncState.userId, userId))
                .returning();

            if (result) {
                return result;
            }

            const [newState] = await db
                .insert(deckSyncState)
                .values({
                    userId,
                    lastSyncAt: data.lastSyncAt,
                    syncCursor: data.syncCursor ?? null,
                    pendingChanges: data.pendingChanges ?? 0,
                })
                .returning();

            if (!newState) {
                throw errorFactory.database('Failed to create sync state during update');
            }

            return newState;
        })(),
        (error) => errorFactory.database('Failed to update sync state', { cause: error })
    );
}
