/**
 * Hook for deleting a card
 */

import { useResultMutation } from '@/lib/react-query/result-utils';
import { deleteCard } from '@/lib/api/deck-service';

export function useDeleteCard(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  return useResultMutation(
    (args: { deckId: string; cardId: string }) => deleteCard(args.deckId, args.cardId),
    options
  );
}
