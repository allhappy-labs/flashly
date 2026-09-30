import type { QueryClient } from '@tanstack/react-query';
import { createFlashlyQueryClient } from '@flashly/api-contracts';

export function createQueryClient(): QueryClient {
  return createFlashlyQueryClient();
}

export const queryClient = createQueryClient();
