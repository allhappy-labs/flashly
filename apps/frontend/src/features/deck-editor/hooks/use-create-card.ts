/**
 * Hook for creating a new card
 */

import { useResultMutation } from '@/lib/react-query/result-utils';
import { createCard } from '@/lib/api/deck-service';
import type { CreateCardInput } from '@/types/api.types';
import type { Card } from '@/types/api.types';

export function useCreateCard(options?: {
  onSuccess?: (card: Card) => void;
  onError?: (error: Error) => void;
}) {
  return useResultMutation(
    (args: { deckId: string; input: Omit<CreateCardInput, 'deckId'> }) =>
      createCard(args.deckId, args.input),
    options
  );
}
