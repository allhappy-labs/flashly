/**
 * Hook for deleting a deck
 */

import { useResultMutation } from '@/lib/react-query/result-utils';
import { deleteDeck } from '@/lib/api/deck-service';

export function useDeleteDeck(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  return useResultMutation((deckId: string) => deleteDeck(deckId), options);
}
