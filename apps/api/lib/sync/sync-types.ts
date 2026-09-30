/**
 * Sync types and interfaces for bidirectional deck synchronization
 */
import type { QuizEnrichment } from '@flashly/shared';

// ============================================================================
// SYNC DIRECTION
// ============================================================================

export type SyncDirection = 'upload' | 'download' | 'bidirectional';

// ============================================================================
// SYNC STATUS
// ============================================================================

export type SyncStatus =
    | 'idle'
    | 'syncing'
    | 'success'
    | 'error'
    | 'conflict'
    | 'offline';

// ============================================================================
// ENTITY TYPES
// ============================================================================

export type EntityType = 'deck' | 'card';

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

export type SyncOperation = 'create' | 'update' | 'delete';

// ============================================================================
// CONFLICT RESOLUTION STRATEGY
// ============================================================================

export type ConflictResolution =
    | 'local_wins'      // Keep local version
    | 'remote_wins'     // Keep remote version
    | 'merge'           // Merge both versions (when possible)
    | 'manual'          // Require manual resolution

// ============================================================================
// SYNC CHANGE
// ============================================================================

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

// ============================================================================
// SYNC RESULT
// ============================================================================

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

// ============================================================================
// CONFLICT INFO
// ============================================================================

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

// ============================================================================
// CONFLICT TYPE
// ============================================================================

export type ConflictType =
    | 'version_mismatch'       // Both sides modified, different versions
    | 'delete_edit'            // One side deleted, other side edited
    | 'duplicate_create'       // Same entity created on both sides
    | 'parent_missing'         // Card references non-existent deck
    | 'validation_failed';     // Data validation error

// ============================================================================
// SYNC STATE
// ============================================================================

export interface UserSyncState {
    userId: string;
    lastSyncAt: Date;
    syncCursor: string | null;
    pendingChanges: number;
}

// ============================================================================
// FULL SYNC REQUEST
// ============================================================================

export interface FullSyncRequest {
    userId: string;
    clientDecks?: ClientDeck[];
    lastSyncAt?: Date;
    force?: boolean;  // Force full sync even if recent sync exists
}

// ============================================================================
// INCREMENTAL SYNC REQUEST
// ============================================================================

export interface IncrementalSyncRequest {
    userId: string;
    cursor?: string;
    limit?: number;
    changes?: SyncChange[];
}

// ============================================================================
// CLIENT DECK (from mobile app)
// ============================================================================

export interface ClientDeck {
    id: string;
    name: string;
    description?: string | null;
    accentKey?: string | null;
    materialType?: string | null;
    deckType?: string | null;
    locale?: string | null;
    marketplaceMetadata?: {
        level?: string | null;
        skills?: string[] | null;
        regionalVariant?: string | null;
        script?: string | null;
        romanization?: 'native_only' | 'with_romanization' | 'romanized_only' | null;
        license?: {
            code: string;
            name: string;
            url?: string;
        } | null;
    } | null;
    visibility?: 'private' | 'public';
    createdAt?: Date;
    updatedAt?: Date;
    lastStudiedAt?: Date | null;
    cards?: ClientCard[];
}

// ============================================================================
// CLIENT CARD (from mobile app)
// ============================================================================

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
    quiz?: QuizEnrichment | null;
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

// ============================================================================
// SYNC CURSOR
// ============================================================================

export interface SyncCursor {
    seq: number;
    version?: number;    // Sync protocol version
}

// ============================================================================
// SYNC BATCH
// ============================================================================

export interface SyncBatch {
    changes: SyncChange[];
    cursor: string;
    hasMore: boolean;
}

// ============================================================================
// SYNC ERROR
// ============================================================================

export interface SyncErrorInfo {
    code: string;
    message: string;
    entityType?: EntityType;
    entityId?: string;
    retryable: boolean;
    details?: Record<string, unknown>;
}

// ============================================================================
// SYNC PROGRESS
// ============================================================================

export interface SyncProgress {
    stage: 'uploading' | 'downloading' | 'resolving_conflicts' | 'complete';
    uploaded: number;
    downloaded: number;
    total: number;
    conflicts: number;
    resolved: number;
}

// ============================================================================
// SYNC OPTIONS
// ============================================================================

export interface SyncOptions {
    batchSize?: number;
    maxRetries?: number;
    timeout?: number;
    resolveConflicts?: ConflictResolution;
    includeCards?: boolean;
}

// ============================================================================
// VALIDATION
// ============================================================================
