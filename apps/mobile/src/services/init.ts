/**
 * Service Initialization - Sets up all singleton services
 *
 * This file initializes all the core services for the mobile app:
 * - API client with configured base URL
 * - Sync service
 * - Background sync
 */

import {
  createMobileApiClient,
  setMobileApiClient,
} from '../lib/api/client';
import { createMobileTrpcClient, setMobileTrpcClient } from '../lib/trpc/client';
import { getSessionCookie, getSessionToken } from '../services/auth/auth-client';
import {
  setSyncService as setSyncServiceSingleton,
  createSyncService,
} from '../services/sync/sync-service';
import { setSyncService as setSyncStoreService } from '../store/sync-store';
import {
  setUserIdGetter,
  initializeBackgroundSync,
} from '../services/sync/background-sync';
import { createMarketplaceClient } from './marketplace/marketplace-client';
import { createMarketplaceService } from './marketplace/marketplace-service';
import { useStore } from '../store/useStore';
import { API_BASE_URL, getApiBaseUrlInfo } from '../constants';
import { logger } from '../utils/logger';

/**
 * Initialize all app services
 * Should be called once at app startup
 */
export async function initServices(): Promise<void> {
  logger.debug('[Init] Initializing services...');

  // 1. Initialize API Client
  const getAuthToken = async () => {
    return getSessionToken();
  };
  const getAuthCookie = async () => {
    return getSessionCookie();
  };

  const trpcClient = createMobileTrpcClient({
    baseUrl: API_BASE_URL,
    getAuthToken,
    getAuthCookie,
  });
  setMobileTrpcClient(trpcClient);

  const apiClient = createMobileApiClient({
    baseUrl: API_BASE_URL,
    timeoutMs: 15000, // Mobile might need longer timeout
    getAuthToken,
    getAuthCookie,
  });
  setMobileApiClient(apiClient);
  logger.debug('[Init] API client initialized with URL:', apiClient);
  const apiInfo = getApiBaseUrlInfo();
  logger.debug('[Init] API baseUrl:', apiInfo.baseUrl, 'source:', apiInfo.source);

  // 2. Initialize marketplace services
  const marketplaceClient = createMarketplaceClient(apiClient);
  createMarketplaceService(marketplaceClient);
  logger.debug('[Init] Marketplace service initialized');

  // 3. Initialize Sync Service
  const syncService = createSyncService();
  setSyncServiceSingleton(syncService);
  setSyncStoreService(syncService);
  logger.debug('[Init] Sync service initialized');

  // 4. Set up user ID getter for background sync
  setUserIdGetter(() => {
    return useStore.getState().userId || null;
  });

  // 5. Initialize background sync
  initializeBackgroundSync();
  logger.debug('[Init] Background sync initialized');

  logger.debug('[Init] All services initialized successfully');
}
