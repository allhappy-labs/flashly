/**
 * Hook for fetching deck reviews
 */

import { useQuery } from '@tanstack/react-query';
import { getDeckReviews, getDeckRatingStats } from '@/lib/api/rating-service';
import { unwrapResultOrThrow } from '@/lib/react-query/result-utils';
import type { DeckReview } from '@/types/api.types';

export interface UseReviewsOptions {
  page?: number;
  limit?: number;
  sortBy?: 'recent' | 'helpful';
}

export interface ReviewsData {
  reviews: Array<DeckReview & { authorName: string | null }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useReviews(deckId: string, options: UseReviewsOptions = {}) {
  return useQuery({
    queryKey: ['reviews', deckId, options.page ?? null, options.limit ?? null, options.sortBy ?? null],
    queryFn: async () => unwrapResultOrThrow(await getDeckReviews(deckId, options)),
    enabled: Boolean(deckId),
  });
}

export function useRatingStats(deckId: string) {
  return useQuery({
    queryKey: ['rating-stats', deckId],
    queryFn: async () => unwrapResultOrThrow(await getDeckRatingStats(deckId)),
    enabled: Boolean(deckId),
  });
}
