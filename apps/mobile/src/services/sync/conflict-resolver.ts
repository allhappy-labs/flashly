/**
 * Conflict resolver - Handles sync conflicts between local and remote data
 */

import { ResultAsync, okAsync, errAsync } from 'neverthrow';
import type { ValidationError } from '@flashly/shared';
import { ConflictError } from '@flashly/shared';
import type { ConflictInfo, ConflictResolution, ConflictType } from './sync-types';
import type { ClientDeck, ClientCard } from './sync-types';

// ============================================================================
// CONFLICT RESOLVER CLASS
// ============================================================================

export class ConflictResolver {
    private getObjectProperty(value: unknown, key: string): unknown {
        if (typeof value !== 'object' || value === null) {
            return undefined;
        }
        return Reflect.get(value, key);
    }

    /**
     * Detect conflict type between local and remote data
     */
    detectConflictType(
        localData: ClientDeck | ClientCard | null,
        remoteData: ClientDeck | ClientCard | null
    ): ConflictType {
        // Both deleted - no conflict
        if (!localData && !remoteData) {
            return 'validation_failed';
        }

        // One deleted, one edited
        if (!localData && remoteData) {
            return 'delete_edit';
        }
        if (localData && !remoteData) {
            return 'delete_edit';
        }

        // Both exist - version mismatch
        return 'version_mismatch';
    }

    /**
     * Auto-resolve conflict based on strategy
     */
    resolveConflict(
        conflict: ConflictInfo,
        strategy: ConflictResolution
    ): ResultAsync<{ data: unknown; resolution: ConflictResolution }, ConflictError | ValidationError> {
        const { localData, remoteData } = conflict;

        switch (strategy) {
            case 'local_wins':
                return okAsync({
                    data: localData,
                    resolution: 'local_wins',
                });

            case 'remote_wins':
                return okAsync({
                    data: remoteData,
                    resolution: 'remote_wins',
                });

            case 'merge':
                return this.mergeData(conflict);

            case 'manual':
                return errAsync(
                    new ConflictError('Manual resolution required', {
                        context: { conflict },
                    })
                );

            default:
                return errAsync(
                    new ConflictError('Unknown conflict resolution strategy', {
                        context: { strategy },
                    })
                );
        }
    }

    /**
     * Merge local and remote data
     * For now, prefers remote for metadata and merges cards
     */
    private mergeData(
        conflict: ConflictInfo
    ): ResultAsync<{ data: unknown; resolution: ConflictResolution }, ConflictError | ValidationError> {
        const { localData, remoteData, conflictType } = conflict;

        // Can't merge delete_edit conflicts
        if (conflictType === 'delete_edit') {
            return errAsync(
                new ConflictError('Cannot merge delete-edit conflict', {
                    context: { conflict },
                })
            );
        }

        // Check if we're merging decks or cards
        const isDeck = this.isDeckData(localData) || this.isDeckData(remoteData);

        if (isDeck && this.isDeckData(localData) && this.isDeckData(remoteData)) {
            return this.mergeDecks(localData, remoteData);
        }

        if (isDeck) {
            return errAsync(
                new ConflictError('Cannot merge deck conflict with invalid deck payload', {
                    context: { localData, remoteData },
                })
            );
        }

        // For cards, prefer remote
        return okAsync({
            data: remoteData,
            resolution: 'remote_wins',
        });
    }

    /**
     * Merge two deck objects
     * Keeps remote metadata but merges card sets
     */
    private mergeDecks(
        localDeck: ClientDeck,
        remoteDeck: ClientDeck
    ): ResultAsync<{ data: unknown; resolution: ConflictResolution }, ConflictError> {
        // Create merged deck
        const merged: ClientDeck = {
            ...remoteDeck, // Prefer remote metadata
            cards: this.mergeCardArrays(
                localDeck.cards || [],
                remoteDeck.cards || []
            ),
        };

        return okAsync({
            data: merged,
            resolution: 'merge',
        });
    }

    /**
     * Merge two card arrays, removing duplicates by ID
     */
    private mergeCardArrays(localCards: ClientCard[], remoteCards: ClientCard[]): ClientCard[] {
        const cardMap = new Map<string, ClientCard>();

        // Add all remote cards first
        for (const card of remoteCards) {
            cardMap.set(card.id, card);
        }

        // Add/overwrite with local cards
        for (const card of localCards) {
            cardMap.set(card.id, card);
        }

        return Array.from(cardMap.values());
    }

    /**
     * Determine if data is a deck object
     */
    private isDeckData(data: unknown): data is ClientDeck {
        if (!data || typeof data !== 'object') {
            return false;
        }

        const cards = this.getObjectProperty(data, 'cards');
        return Array.isArray(cards);
    }

    /**
     * Suggest resolution strategy based on conflict type
     */
    suggestResolution(conflict: ConflictInfo): ConflictResolution {
        const { conflictType, localData, remoteData } = conflict;

        switch (conflictType) {
            case 'delete_edit':
                // Prefer edited data over deleted
                return localData ? 'local_wins' : 'remote_wins';

            case 'version_mismatch':
                // If both have data, suggest merge for decks
                if (this.isDeckData(localData) || this.isDeckData(remoteData)) {
                    return 'merge';
                }
                // For cards, prefer remote (server is source of truth)
                return 'remote_wins';

            case 'duplicate_create':
                // Keep remote, but mark for manual review
                return 'manual';

            case 'parent_missing':
                // Local card without deck - delete local
                return 'remote_wins';

            case 'validation_failed':
                return 'remote_wins';

            default:
                return 'manual';
        }
    }

    /**
     * Check if conflict requires manual resolution
     */
    requiresManualResolution(conflict: ConflictInfo): boolean {
        const suggestion = this.suggestResolution(conflict);
        return suggestion === 'manual';
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let conflictResolverInstance: ConflictResolver | null = null;

export function getConflictResolver(): ConflictResolver {
    if (!conflictResolverInstance) {
        conflictResolverInstance = new ConflictResolver();
    }
    return conflictResolverInstance;
}
