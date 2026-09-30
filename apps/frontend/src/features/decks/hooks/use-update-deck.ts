/**
 * Hook for updating a deck
 */

import { useResultMutation } from '@/lib/react-query/result-utils';
import { updateDeck } from '@/lib/api/deck-service';
import type { UpdateDeckInput } from '@/types/api.types';
import type { DeckWithCards } from '@/types/api.types';

export function useUpdateDeck(options?: {
  onSuccess?: (deck: DeckWithCards) => void;
  onError?: (error: Error) => void;
}) {
  return useResultMutation(
    (args: { deckId: string; input: UpdateDeckInput }) =>
      updateDeck(args.deckId, args.input),
    options
  );
}
