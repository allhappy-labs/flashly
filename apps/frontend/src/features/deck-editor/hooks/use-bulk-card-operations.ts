/**
 * Hook for bulk card operations
 */

import { useResultMutation } from '@/lib/react-query/result-utils';
import { bulkDeleteCards, bulkUpdateCards } from '@/lib/api/deck-service';

export function useBulkDeleteCards(options?: {
  onSuccess?: (data: { count: number }) => void;
  onError?: (error: Error) => void;
}) {
  return useResultMutation(
    (args: { deckId: string; cardIds: string[] }) =>
      bulkDeleteCards(args.deckId, args.cardIds),
    options
  );
}

export function useBulkUpdateCards(options?: {
  onSuccess?: (data: { count: number }) => void;
  onError?: (error: Error) => void;
}) {
  return useResultMutation(
    (args: {
      deckId: string;
      cardIds: string[];
      updates: { category?: string; tags?: string };
    }) => bulkUpdateCards(args.deckId, args.cardIds, args.updates),
    options
  );
}
