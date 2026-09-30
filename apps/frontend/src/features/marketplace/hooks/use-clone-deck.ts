/**
 * Hook for cloning a deck from marketplace
 */

import { useResultMutation } from '@/lib/react-query/result-utils';
import { cloneDeck } from '@/lib/api/deck-service';
import type { DeckWithCards } from '@/types/api.types';

export function useCloneDeck(options?: {
  onSuccess?: (deck: DeckWithCards) => void;
  onError?: (error: Error) => void;
}) {
  return useResultMutation((deckId: string) => cloneDeck(deckId), options);
}
