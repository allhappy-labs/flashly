/**
 * Hook for submitting a review
 */

import { useResultMutation } from '@/lib/react-query/result-utils';
import { createReview, upsertRating } from '@/lib/api/rating-service';
import type { CreateReviewInput } from '@/types/api.types';

export function useSubmitReview(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  return useResultMutation(
    (args: { deckId: string; input: Omit<CreateReviewInput, 'title'> & { title?: string } }) =>
      createReview(args.deckId, args.input),
    options
  );
}

export function useSubmitRating(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  return useResultMutation(
    (args: { deckId: string; rating: number }) =>
      upsertRating(args.deckId, args.rating),
    options
  );
}
