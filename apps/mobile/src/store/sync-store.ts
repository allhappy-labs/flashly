/**
 * Sync store - Zustand state management for sync
 */

import React from 'react';
import { create } from 'zustand';
import type { SyncService } from '../services/sync/sync-service';
import type { SyncStatus, SyncResult, SyncOptions } from '../services/sync/sync-types';
import { logger } from '../utils/logger';

// ============================================================================
// STORE STATE
// ============================================================================

interface SyncStoreState {
    // State
    isSyncing: boolean;
    lastSyncAt: number | null;
    pendingUploads: number;
    pendingDownloads: number;
    syncStatus: SyncStatus;
    syncError: Error | null;
    lastSyncResult: SyncResult | null;

    // Actions
    startSync: (userId: string, options?: SyncOptions) => Promise<void>;
    stopSync: () => void;
    clearError: () => void;
    refreshSyncState: () => Promise<void>;
    setSyncStatus: (status: SyncStatus) => void;
}

// ============================================================================
// CREATE STORE
// ============================================================================

let syncServiceInstance: SyncService | null = null;

export function setSyncService(service: SyncService | null) {
    syncServiceInstance = service;
}

async function getHostedSyncService(): Promise<SyncService | null> {
    const { getSyncService } = await import('../services/sync/sync-service');
    return getSyncService();
}

export const useSyncStore = create<SyncStoreState>((set, get) => ({
    isSyncing: false,
    lastSyncAt: null,
    pendingUploads: 0,
    pendingDownloads: 0,
    syncStatus: 'idle',
    syncError: null,
    lastSyncResult: null,

    startSync: async (userId: string, options: SyncOptions = {}) => {
        const syncService = syncServiceInstance ?? await getHostedSyncService();
        if (!syncService) {
            set({
                syncStatus: 'error',
                syncError: new Error('Sync service not initialized'),
            });
            return;
        }
        syncServiceInstance = syncService;

        if (get().isSyncing) {
            // Already syncing
            return;
        }

        set({
            isSyncing: true,
            syncStatus: 'syncing',
            syncError: null,
        });

        try {
            const result = await syncService.incrementalSync(userId, options);

            result.match(
                (syncResult: SyncResult) => {
                    set({
                        isSyncing: false,
                        syncStatus: 'success',
                        lastSyncAt: Date.now(),
                        pendingUploads: 0,
                        pendingDownloads: 0,
                        lastSyncResult: syncResult,
                        syncError: null,
                    });

                    // Reset status after a delay
                    setTimeout(() => {
                        set({ syncStatus: 'idle' });
                    }, 3000);
                },
                (error: Error) => {
                    set({
                        isSyncing: false,
                        syncStatus: 'error',
                        syncError: error,
                    });
                }
            );
        } catch (error) {
            set({
                isSyncing: false,
                syncStatus: 'error',
                syncError: error instanceof Error ? error : new Error('Unknown sync error'),
            });
        }
    },

    stopSync: () => {
        set({
            isSyncing: false,
            syncStatus: 'idle',
        });
    },

    clearError: () => {
        set({ syncError: null, syncStatus: 'idle' });
    },

    refreshSyncState: async () => {
        // Get sync state from repository
        const { getSyncRepository } = await import('../services/sync/sync-repository');
        const syncRepo = getSyncRepository();

        // Try to get sync state for current user
        // This is a simplified version - in production you'd track the current userId
        const result = await syncRepo.getSyncState('default');

        result.match(
            (state) => {
                if (state) {
                    set({
                        lastSyncAt: state.lastSyncAt,
                        pendingUploads: state.pendingUploads,
                        pendingDownloads: state.pendingDownloads,
                    });
                }
            },
            (error) => {
                logger.error('Failed to refresh sync state:', error);
            }
        );
    },

    setSyncStatus: (status: SyncStatus) => {
        set({ syncStatus: status });
    },
}));

// ============================================================================
// SELECTORS
// ============================================================================

export const selectIsSyncing = (state: SyncStoreState): boolean => {
    return state.isSyncing;
};

export const selectHasPendingSync = (state: SyncStoreState): boolean => {
    return state.pendingUploads > 0 || state.pendingDownloads > 0;
};

export const selectSyncError = (state: SyncStoreState): Error | null => {
    return state.syncError;
};

export const selectLastSyncTime = (state: SyncStoreState): number | null => {
    return state.lastSyncAt;
};

export const selectIsOnline = (state: SyncStoreState): boolean => {
    return state.syncStatus !== 'offline';
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to trigger automatic sync on app foreground
 */
export function useAutoSync(userId: string | null, intervalMs: number = 5 * 60 * 1000) {
    const startSync = useSyncStore((state) => state.startSync);
    const isSyncing = useSyncStore((state) => state.isSyncing);

    // Trigger sync immediately if userId is available
    React.useEffect(() => {
        if (userId && !isSyncing) {
            startSync(userId);
        }
    }, [userId, isSyncing, startSync]);

    // Set up interval for periodic sync
    React.useEffect(() => {
        if (!userId) return;

        const interval = setInterval(() => {
            if (!isSyncing) {
                startSync(userId);
            }
        }, intervalMs);

        return () => clearInterval(interval);
    }, [userId, intervalMs, isSyncing, startSync]);
}
