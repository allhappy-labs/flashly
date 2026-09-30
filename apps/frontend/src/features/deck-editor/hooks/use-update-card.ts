/**
 * Hook for updating a card
 */

import { useResultMutation } from '@/lib/react-query/result-utils';
import { updateCard } from '@/lib/api/deck-service';
import type { UpdateCardInput } from '@/types/api.types';
import type { Card } from '@/types/api.types';

export function useUpdateCard(options?: {
  onSuccess?: (card: Card) => void;
  onError?: (error: Error) => void;
}) {
  return useResultMutation(
    (args: { deckId: string; cardId: string; input: UpdateCardInput }) =>
      updateCard(args.deckId, args.cardId, args.input),
    options
  );
}
