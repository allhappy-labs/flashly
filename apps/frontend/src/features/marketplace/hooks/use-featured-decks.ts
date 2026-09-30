/**
 * Hook for fetching featured decks
 */

import { useQuery } from '@tanstack/react-query';
import { getFeaturedDecks } from '@/lib/api/deck-service';

export function useFeaturedDecks(limit: number = 10) {
  return useQuery({
    queryKey: ['featured-decks', limit],
    queryFn: async () => {
      const result = await getFeaturedDecks(limit);
      return result.match(
        (data) => data,
        (error) => {
          throw error;
        }
      );
    },
  });
}
