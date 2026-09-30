/**
 * Sync types for mobile bidirectional synchronization
 * Re-exports from API sync-types for consistency
 */

export type SyncDirection = 'upload' | 'download' | 'bidirectional';

export type SyncStatus =
    | 'idle'
    | 'syncing'
    | 'success'
    | 'error'
    | 'conflict'
    | 'offline';

export type EntityType = 'deck' | 'card';

export type SyncOperation = 'create' | 'update' | 'delete';

export type ConflictResolution =
    | 'local_wins'
    | 'remote_wins'
    | 'merge'
    | 'manual';

export interface SyncChange {
    entityType: EntityType;
    entityId: string;
    operation: SyncOperation;
    data?: unknown;
    clientUpdatedAt?: string;
}

export interface SyncLedgerChange extends SyncChange {
    seq: number;
    changedAt: string;
}

export interface SyncResult {
    success: boolean;
    direction: SyncDirection;
    uploaded: number;
    downloaded: number;
    deleted: number;
    conflicts: ConflictInfo[];
    duration: number;
    syncedAt: Date;
    changes?: SyncLedgerChange[];
    cursor?: string;
    hasMore?: boolean;
}

export interface ConflictInfo {
    entityType: EntityType;
    entityId: string;
    localVersion: number;
    remoteVersion: number;
    localData: unknown;
    remoteData: unknown;
    conflictType: ConflictType;
    resolved?: boolean;
    resolution?: ConflictResolution;
}

export type ConflictType =
    | 'version_mismatch'
    | 'delete_edit'
    | 'duplicate_create'
    | 'parent_missing'
    | 'validation_failed';

export interface UserSyncState {
    userId: string;
    lastSyncAt: Date;
    syncCursor: string | null;
    pendingChanges: number;
}

export interface FullSyncRequest {
    userId: string;
    clientDecks?: ClientDeck[];
    lastSyncAt?: Date;
    force?: boolean;
}

export interface ClientDeck {
    id: string;
    name: string;
    description?: string | null;
    accentKey?: string | null;
    materialType?: string | null;
    deckType?: string | null;
    locale?: string | null;
    visibility?: 'private' | 'public';
    createdAt?: Date;
    updatedAt?: Date;
    lastStudiedAt?: Date | null;
    cards?: ClientCard[];
}

export interface ClientCard {
    id: string;
    deckId: string;
    front: string;
    back: string;
    imageUrl?: string | null;
    audioUrl?: string | null;
    category?: string | null;
    pos?: string | null;
    gender?: string | null;
    example?: string | null;
    tags?: string[];
    isStarred?: boolean;
    learnState?: 'not_studied' | 'learning' | 'mastered';
    learnCorrectStreak?: number;
    learnCorrectTotal?: number;
    learnIncorrectTotal?: number;
    learnLastAnsweredAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
    lastReviewedAt?: Date | null;
    due?: Date | null;
    stability?: number;
    difficulty?: number;
    elapsed_days?: number;
    scheduled_days?: number;
    learning_steps?: number;
    reps?: number;
    lapses?: number;
    state?: 'new' | 'learning' | 'review' | 'relearning';
}

export interface SyncCursor {
    seq: number;
    version?: number;
}

export interface SyncBatch {
    changes: SyncChange[];
    cursor: string;
    hasMore: boolean;
}

export interface SyncErrorInfo {
    code: string;
    message: string;
    entityType?: EntityType;
    entityId?: string;
    retryable: boolean;
    details?: Record<string, unknown>;
}

export interface SyncProgress {
    stage: 'uploading' | 'downloading' | 'resolving_conflicts' | 'complete';
    uploaded: number;
    downloaded: number;
    total: number;
    conflicts: number;
    resolved: number;
}

export interface SyncOptions {
    batchSize?: number;
    maxRetries?: number;
    timeout?: number;
    resolveConflicts?: ConflictResolution;
    includeCards?: boolean;
}

// ============================================================================
// LOCAL SYNC QUEUE ITEM
// ============================================================================

export interface SyncQueueItem {
    id: string;
    entityType: EntityType;
    entityId: string;
    operation: SyncOperation;
    payload: string; // JSON string
    createdAt: number;
    retries: number;
    lastAttemptAt?: number;
    error?: string;
    userId?: string | null;
}

// ============================================================================
// LOCAL SYNC STATE
// ============================================================================

export interface LocalSyncState {
    id: string;
    lastSyncAt: number;
    pendingUploads: number;
    pendingDownloads: number;
    syncCursor?: string;
}
