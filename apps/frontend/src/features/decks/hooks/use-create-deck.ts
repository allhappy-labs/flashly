/**
 * Hook for creating a new deck
 */

import { useResultMutation } from '@/lib/react-query/result-utils';
import { createDeck } from '@/lib/api/deck-service';
import type { CreateDeckInput } from '@/types/api.types';
import type { Deck } from '@/types/api.types';

export function useCreateDeck(options?: {
  onSuccess?: (deck: Deck) => void;
  onError?: (error: Error) => void;
}) {
  return useResultMutation((input: CreateDeckInput) => createDeck(input), options);
}
