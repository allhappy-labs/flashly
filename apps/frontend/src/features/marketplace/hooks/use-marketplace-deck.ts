import { useQuery } from '@tanstack/react-query';

import { getMarketplaceDeck } from '@/lib/api/deck-service';

export function useMarketplaceDeck(deckId: string | undefined) {
  return useQuery({
    queryKey: ['marketplace-deck', deckId ?? null],
    enabled: Boolean(deckId),
    queryFn: async () => {
      if (!deckId) {
        throw new Error('Missing deck id');
      }

      const result = await getMarketplaceDeck(deckId);
      return result.match(
        (deck) => deck,
        (requestError) => {
          throw (requestError instanceof Error ? requestError : new Error('Failed to load deck'));
        }
      );
    },
  });
}
