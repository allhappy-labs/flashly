import { QueryClient } from '@tanstack/react-query';

export function createFlashlyQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: 1,
      },
      queries: {
        gcTime: 1000 * 60 * 10,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 1000 * 30,
      },
    },
  });
}
