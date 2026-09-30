/**
 * Hook for fetching a deck with its cards
 */

import { useQuery } from '@tanstack/react-query';
import { getDeck } from '@/lib/api/deck-service';
import { unwrapResultOrThrow } from '@/lib/react-query/result-utils';

export function useDeckWithCards(deckId: string, options?: { executeOnMount?: boolean }) {
  const query = useQuery({
    queryKey: ['deck-with-cards', deckId],
    queryFn: async () => unwrapResultOrThrow(await getDeck(deckId)),
    enabled: (options?.executeOnMount ?? true) && Boolean(deckId),
  });

  return {
    ...query,
    data: query.data ?? null,
    error: query.error ?? null,
  };
}
