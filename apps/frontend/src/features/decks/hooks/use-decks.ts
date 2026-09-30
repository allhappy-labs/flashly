/**
 * Hook for fetching user's decks
 */

import { useQuery } from '@tanstack/react-query';
import { listUserDecks } from '@/lib/api/deck-service';

export function useDecks(query: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['decks', query.page ?? null, query.limit ?? null],
    queryFn: async () => {
      const result = await listUserDecks(query);
      return result.match(
        (data) => data,
        (error) => {
          throw error;
        }
      );
    },
  });
}
