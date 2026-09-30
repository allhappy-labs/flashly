import type { ResultAsync } from 'neverthrow';
import { db } from '../../db/db.ts';
import { syncChanges } from '../auth/auth-schema.ts';
import type { DatabaseError} from '@flashly/shared';
import { errorFactory, safeAsync } from '@flashly/shared';
import type { EntityType, SyncOperation } from './sync-types.ts';

export type SyncLedgerEntry = typeof syncChanges.$inferSelect;

export function recordSyncChange(options: {
    userId: string;
    entityType: EntityType;
    entityId: string;
    operation: SyncOperation;
    payload?: unknown;
}): ResultAsync<SyncLedgerEntry, DatabaseError> {
    return safeAsync(
        db
            .insert(syncChanges)
            .values({
                userId: options.userId,
                entityType: options.entityType,
                entityId: options.entityId,
                operation: options.operation,
                payload: options.payload ?? null,
            })
            .returning()
            .then((rows) => rows[0] as SyncLedgerEntry),
        (error) => errorFactory.database('Failed to record sync change', error)
    );
}

export type SyncCursorPayload = { seq: number; version: number };

export function encodeSyncCursor(seq: number): string {
    const payload: SyncCursorPayload = { seq, version: 1 };
    return JSON.stringify(payload);
}

export function parseSyncCursor(cursor?: string | null): number {
    if (!cursor) return 0;
    try {
        const parsed = JSON.parse(cursor) as Partial<SyncCursorPayload> | number;
        if (typeof parsed === 'number' && Number.isFinite(parsed)) {
            return parsed;
        }
        if (parsed && typeof parsed === 'object' && typeof parsed.seq === 'number' && Number.isFinite(parsed.seq)) {
            return parsed.seq;
        }
    } catch {
        const fallback = Number(cursor);
        if (Number.isFinite(fallback)) return fallback;
    }
    return 0;
}
