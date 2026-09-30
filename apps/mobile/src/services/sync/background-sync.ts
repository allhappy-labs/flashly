/**
 * Background sync - Manages automatic sync triggers
 */

import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';
import type { NativeEventSubscription } from 'react-native';
import { getSyncService } from './sync-service';
import type { SyncOptions } from './sync-types';
import { logger } from '../../utils/logger';

// User ID getter function - should be set by the app
let getUserIdFn: (() => string | null) | null = null;

export function setUserIdGetter(fn: () => string | null) {
    getUserIdFn = fn;
}

// ============================================================================
// CONFIG
// ============================================================================

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SYNC_ON_FOREGROUND_DELAY = 1000; // 1 second after coming to foreground

// ============================================================================
// BACKGROUND SYNC CLASS
// ============================================================================

export class BackgroundSync {
    private syncInterval: NodeJS.Timeout | null = null;
    private appStateSubscription: NativeEventSubscription | null = null;
    private isOnline: boolean = true;
    private isInitialized: boolean = false;
    private syncInFlight: boolean = false;
    private syncRerunRequested: boolean = false;

    /**
     * Initialize background sync
     */
    initialize() {
        if (this.isInitialized) {
            return;
        }

        logger.debug('[BackgroundSync] Initializing...');

        // Listen for app state changes
        this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

        // Start periodic sync interval
        this.startSyncInterval();

        this.isInitialized = true;
        logger.debug('[BackgroundSync] Initialized');
    }

    /**
     * Cleanup background sync
     */
    destroy() {
        logger.debug('[BackgroundSync] Destroying...');

        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }

        this.stopSyncInterval();

        this.isInitialized = false;
    }

    /**
     * Set online status
     */
    setOnlineStatus(online: boolean) {
        const wasOnline = this.isOnline;
        this.isOnline = online;

        if (!wasOnline && this.isOnline) {
            logger.debug('[BackgroundSync] Network restored, triggering sync');
            setTimeout(() => {
                void this.triggerSync();
            }, SYNC_ON_FOREGROUND_DELAY);
        }
    }

    /**
     * Trigger immediate sync
     */
    async triggerSync(options?: SyncOptions): Promise<void> {
        if (this.syncInFlight) {
            this.syncRerunRequested = true;
            return;
        }

        const userId = getUserIdFn?.();

        if (!userId) {
            logger.debug('[BackgroundSync] No user authenticated, skipping sync');
            return;
        }

        if (!this.isOnline) {
            logger.debug('[BackgroundSync] Offline, skipping sync');
            return;
        }

        const syncService = getSyncService();
        if (!syncService) {
            logger.debug('[BackgroundSync] Sync service not initialized');
            return;
        }

        logger.debug('[BackgroundSync] Triggering sync...');
        this.syncInFlight = true;
        try {
            await syncService.incrementalSync(userId, options);
        } catch (error) {
            logger.error('[BackgroundSync] Sync trigger failed', error);
        } finally {
            this.syncInFlight = false;
        }

        if (this.syncRerunRequested) {
            this.syncRerunRequested = false;
            await this.triggerSync(options);
        }
    }

    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================

    private handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
            logger.debug('[BackgroundSync] App came to foreground');
            // Trigger sync after a short delay
            setTimeout(() => {
                void this.triggerSync();
            }, SYNC_ON_FOREGROUND_DELAY);
        }
    };

    private startSyncInterval() {
        if (this.syncInterval) {
            return;
        }

        logger.debug('[BackgroundSync] Starting periodic sync interval');
        this.syncInterval = setInterval(() => {
            void this.triggerSync();
        }, SYNC_INTERVAL_MS);
    }

    private stopSyncInterval() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            logger.debug('[BackgroundSync] Stopped periodic sync interval');
        }
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let backgroundSyncInstance: BackgroundSync | null = null;

export function getBackgroundSync(): BackgroundSync {
    if (!backgroundSyncInstance) {
        backgroundSyncInstance = new BackgroundSync();
    }
    return backgroundSyncInstance;
}

export function initializeBackgroundSync() {
    const sync = getBackgroundSync();
    sync.initialize();
}

export function destroyBackgroundSync() {
    if (backgroundSyncInstance) {
        backgroundSyncInstance.destroy();
        backgroundSyncInstance = null;
    }
}
