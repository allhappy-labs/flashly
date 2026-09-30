/**
 * API Client Initialization
 *
 * Initializes the API client singleton for the frontend app.
 * Should be called once at app startup.
 */

import { createApiClient, setApiClient } from './client';
import { createFrontendTrpcClient, setFrontendTrpcClient } from '@/lib/trpc/client';

/**
 * Initialize the API client singleton
 */
export function initApiClient(): void {
  const trpcClient = createFrontendTrpcClient({
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  });
  setFrontendTrpcClient(trpcClient);

  const apiClient = createApiClient({
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
    timeoutMs: 10000,
  });
  setApiClient(apiClient);
}
