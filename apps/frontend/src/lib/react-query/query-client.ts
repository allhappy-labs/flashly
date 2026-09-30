/**
 * React Query Configuration
 *
 * Sets up the QueryClient for the frontend app with appropriate defaults.
 */

import type { QueryClient } from '@tanstack/react-query';
import { createFlashlyQueryClient } from '@flashly/api-contracts';

/**
 * Create a configured QueryClient instance
 */
export function createQueryClient(): QueryClient {
  return createFlashlyQueryClient();
}

// Create singleton instance
const queryClient = createQueryClient();

export { queryClient };
