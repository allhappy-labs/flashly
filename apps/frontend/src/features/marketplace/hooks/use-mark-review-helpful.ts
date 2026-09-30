/**
 * Hook for marking a review as helpful
 */

import { useResultMutation } from '@/lib/react-query/result-utils';
import { markReviewHelpful } from '@/lib/api/rating-service';

export function useMarkReviewHelpful(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  return useResultMutation(
    (args: { reviewId: string; deckId: string }) =>
      markReviewHelpful(args.reviewId),
    options
  );
}
