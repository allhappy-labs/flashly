/**
 * Sync service - Orchestrates bidirectional synchronization (ledger-based)
 */

import { okAsync, errAsync } from 'neverthrow';
import type { Result } from 'neverthrow';
import type { DatabaseError } from '@flashly/shared';
import { SyncError, NetworkError } from '@flashly/shared';
import type { MobileApiClient } from '../../lib/api/client';
import { getMobileApiClient } from '../../lib/api/client';
import { getSyncRepository } from './sync-repository';
import { getStudyEventRepository } from './study-event-repository';
import type {
    SyncResult,
    SyncOptions,
    ConflictInfo,
    SyncLedgerChange,
    SyncQueueItem,
    SyncChange,
} from './sync-types';
import {
    applyCardDeleteFromSync,
    applyDeckDeleteFromSync,
    deckExists,
    upsertCardFromSync,
    upsertDeckFromSync,
} from '../../db/deckRepositorySafe';
import { toRecord } from '../../utils/records';
import { logger } from '../../utils/logger';

// ============================================================================
// SYNC SERVICE CLASS
// ============================================================================

export class SyncService {
    private syncRepository = getSyncRepository();
    private studyEventRepository = getStudyEventRepository();

    private getObjectProperty(value: unknown, key: string): unknown {
        if (typeof value !== 'object' || value === null) {
            return undefined;
        }

        return Reflect.get(value, key);
    }

    private parseJsonRecord(payload: string): Record<string, unknown> {
        const parsed = JSON.parse(payload);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed;
        }

        return {};
    }

    private getDeckIdFromChangeData(data: unknown): string {
        const deckId = this.getObjectProperty(data, 'deckId');
        return typeof deckId === 'string' ? deckId : '';
    }

    /**
     * Perform full sync - uses incremental protocol with cursor reset
     */
    async fullSync(userId: string, options: SyncOptions = {}): Promise<Result<SyncResult, SyncError | NetworkError | DatabaseError>> {
        return this.incrementalSync(userId, options, true);
    }

    /**
     * Incremental sync - ledger-based
     */
    async incrementalSync(
        userId: string,
        options: SyncOptions = {},
        resetCursor: boolean = false
    ): Promise<Result<SyncResult, SyncError | NetworkError | DatabaseError>> {
        const startTime = Date.now();
        const {
            batchSize = 100,
            maxRetries = 3,
        } = options;

        const apiClient = getMobileApiClient();
        if (!apiClient) {
            return errAsync(new SyncError('API client not initialized'));
        }

        // Ensure sync state
        const syncStateResult = await this.syncRepository.getSyncState(userId);
        if (syncStateResult.isErr()) {
            return errAsync(syncStateResult.error);
        }

        let syncState = syncStateResult.value;
        if (!syncState) {
            const initResult = await this.syncRepository.initializeSyncState(userId);
            if (initResult.isErr()) {
                return errAsync(initResult.error);
            }
            syncState = initResult.value;
        }
        let cursor = resetCursor ? null : syncState.syncCursor ?? null;

        // Claim anonymous queued ops/events for this user
        const claimOpsResult = await this.syncRepository.claimAnonymousOperations(userId);
        if (claimOpsResult.isErr()) {
            return errAsync(claimOpsResult.error);
        }
        const claimEventsResult = await this.studyEventRepository.claimAnonymousEvents(userId);
        if (claimEventsResult.isErr()) {
            return errAsync(claimEventsResult.error);
        }

        // Step 1: Upload study events (idempotent)
        const studyUploadResult = await this.uploadStudyEvents(apiClient, batchSize, userId, maxRetries);
        if (studyUploadResult.isErr()) {
            logger.warn('[Sync] Failed to upload study events:', studyUploadResult.error.message);
        }

        let uploaded = 0;
        let downloaded = 0;
        let deleted = 0;
        const remoteChanges: SyncLedgerChange[] = [];
        let hasMore = true;

        while (hasMore) {
            // Load pending operations (deck/card)
            const operationsResult = await this.syncRepository.getPendingOperations({
                limit: batchSize,
                userId,
                maxRetries,
            });
            if (operationsResult.isErr()) {
                return errAsync(operationsResult.error);
            }

            const operations = operationsResult.value;
            const { changes, operationIds } = this.buildChangeBatch(operations);

            const responseResult = await apiClient.post<{
                uploaded: number;
                downloaded: number;
                deleted: number;
                changes?: SyncLedgerChange[];
                cursor?: string;
                hasMore?: boolean;
            }>('/api/sync/incremental', {
                cursor: cursor ?? undefined,
                limit: batchSize,
                changes,
            }).mapErr((error) => new NetworkError('Failed to sync changes', { cause: error }));

            if (responseResult.isErr()) {
                for (const op of operations) {
                    await this.syncRepository.markOperationFailed(op.id, responseResult.error.message, userId);
                }
                return errAsync(responseResult.error);
            }

            const response = responseResult.value;

            uploaded += response.uploaded ?? 0;
            downloaded += response.downloaded ?? 0;
            deleted += response.deleted ?? 0;

            if (operationIds.length > 0) {
                for (const opId of operationIds) {
                    await this.syncRepository.markOperationComplete(opId, userId);
                }
            }

            const responseChanges = response.changes ?? [];
            if (responseChanges.length > 0) {
                const applyResult = await this.applyRemoteChanges(responseChanges);
                if (applyResult.isErr()) {
                    return errAsync(applyResult.error);
                }
                remoteChanges.push(...responseChanges);
            }

            cursor = response.cursor ?? cursor;
            hasMore = Boolean(response.hasMore);

            if (!hasMore && operations.length === batchSize) {
                // More pending uploads; continue
                hasMore = true;
            }

            if (!hasMore && operations.length === 0) {
                break;
            }
        }

        const pendingCountResult = await this.syncRepository.getPendingCount(userId);
        const pendingUploads = pendingCountResult.isOk() ? pendingCountResult.value : 0;

        await this.syncRepository.updateSyncState(userId, {
            lastSyncAt: Date.now(),
            syncCursor: cursor ?? undefined,
            pendingUploads,
            pendingDownloads: 0,
        });

        const duration = Date.now() - startTime;

        return okAsync({
            success: true,
            direction: 'bidirectional',
            uploaded,
            downloaded,
            deleted,
            conflicts: [],
            duration,
            syncedAt: new Date(),
            changes: remoteChanges,
        });
    }

    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================

    private buildChangeBatch(operations: SyncQueueItem[]): { changes: SyncChange[]; operationIds: string[] } {
        const changes: SyncChange[] = [];
        const operationIds: string[] = [];

        for (const op of operations) {
            const payload = this.parseJsonRecord(op.payload ?? '{}');
            const rawUpdatedAt = payload.clientUpdatedAt ?? payload.updatedAt;
            const clientUpdatedAt = typeof rawUpdatedAt === 'string'
                ? rawUpdatedAt
                : typeof rawUpdatedAt === 'number'
                    ? new Date(rawUpdatedAt).toISOString()
                    : new Date(op.createdAt).toISOString();

            changes.push({
                entityType: op.entityType,
                entityId: op.entityId,
                operation: op.operation,
                data: payload,
                clientUpdatedAt,
            });
            operationIds.push(op.id);
        }

        return { changes, operationIds };
    }

    private async uploadStudyEvents(
        apiClient: MobileApiClient,
        batchSize: number,
        userId: string,
        maxRetries: number
    ): Promise<Result<number, SyncError | NetworkError | DatabaseError>> {
        const pendingResult = await this.studyEventRepository.getPendingEvents(batchSize, userId, maxRetries);
        if (pendingResult.isErr()) {
            return errAsync(pendingResult.error);
        }

        const pending = pendingResult.value;
        if (!pending.length) {
            return okAsync(0);
        }

        const reviewEvents: Record<string, unknown>[] = [];
        const sessionEvents: Record<string, unknown>[] = [];
        const ids = pending.map((item) => item.id);

        for (const item of pending) {
            const payload = this.parseJsonRecord(item.payload);
            if (item.eventType === 'review') {
                reviewEvents.push(payload);
            } else {
                sessionEvents.push(payload);
            }
        }

        const result = await apiClient
            .post<{ acceptedIds: string[] }>('/api/study/events/batch', { reviewEvents, sessionEvents })
            .mapErr((error) => new NetworkError('Failed to upload study events', { cause: error }));

        if (result.isErr()) {
            await this.studyEventRepository.markEventsFailed(ids, result.error.message, userId);
            return errAsync(result.error);
        }

        const response = result.value;
        const acceptedIds = response.acceptedIds ?? ids;
        const deleteResult = await this.studyEventRepository.markEventsAccepted(acceptedIds, userId);
        if (deleteResult.isErr()) {
            return errAsync(deleteResult.error);
        }

        return okAsync(acceptedIds.length);
    }

    private async applyRemoteChanges(
        changes: SyncLedgerChange[]
    ): Promise<Result<void, SyncError | DatabaseError>> {
        const deferredCards: SyncLedgerChange[] = [];

        for (const change of changes) {
            if (change.entityType === 'deck') {
                if (change.operation === 'delete') {
                    const result = await applyDeckDeleteFromSync(change.entityId);
                    if (result.isErr()) {
                        return errAsync(result.error);
                    }
                } else {
                    const payload = toRecord(change.data);
                    if (!payload) {
                        return errAsync(new SyncError('Invalid deck sync payload'));
                    }
                    const result = await upsertDeckFromSync(payload);
                    if (result.isErr()) {
                        return errAsync(result.error);
                    }
                }
            }

                if (change.entityType === 'card') {
                if (change.operation !== 'delete') {
                    const deckId = this.getDeckIdFromChangeData(change.data);
                    const existsResult = await deckExists(deckId);
                    if (existsResult.isErr()) {
                        return errAsync(existsResult.error);
                    }
                    if (!existsResult.value) {
                        deferredCards.push(change);
                        continue;
                    }
                }

                if (change.operation === 'delete') {
                    const result = await applyCardDeleteFromSync(change.entityId);
                    if (result.isErr()) {
                        return errAsync(result.error);
                    }
                } else {
                    const payload = toRecord(change.data);
                    if (!payload) {
                        return errAsync(new SyncError('Invalid card sync payload'));
                    }
                    const result = await upsertCardFromSync(payload);
                    if (result.isErr()) {
                        return errAsync(result.error);
                    }
                }
            }
        }

        if (deferredCards.length > 0) {
            for (const change of deferredCards) {
                const deckId = this.getDeckIdFromChangeData(change.data);
                const existsResult = await deckExists(deckId);
                if (existsResult.isErr()) {
                    return errAsync(existsResult.error);
                }
                if (!existsResult.value) {
                    continue;
                }

                const payload = toRecord(change.data);
                if (!payload) {
                    return errAsync(new SyncError('Invalid deferred card sync payload'));
                }
                const result = await upsertCardFromSync(payload);
                if (result.isErr()) {
                    return errAsync(result.error);
                }
            }
        }

        return okAsync(undefined);
    }

    private async detectAndResolveConflicts(): Promise<Result<ConflictInfo[], SyncError | DatabaseError>> {
        return okAsync([]);
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let syncServiceInstance: SyncService | null = null;

export function getSyncService(): SyncService {
    if (!syncServiceInstance) {
        syncServiceInstance = new SyncService();
    }
    return syncServiceInstance;
}

export function createSyncService(): SyncService {
    syncServiceInstance = new SyncService();
    return syncServiceInstance;
}

export function setSyncService(service: SyncService | null): void {
    syncServiceInstance = service;
}
