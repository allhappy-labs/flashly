/**
 * Rating Service - API client for ratings and reviews
 */

import { getApiClient } from './client';

// ============================================================================
// Types
// ============================================================================

export interface DeckRatingStats {
  averageRating: number;
  totalRatings: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface DeckRating {
  id: string;
  deckId: string;
  userId: string;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeckReview {
  id: string;
  deckId: string;
  userId: string;
  rating: number;
  title: string | null;
  content: string;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewsData {
  reviews: Array<DeckReview & { authorName: string | null }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// Rating Operations
// ============================================================================

/**
 * Get deck rating statistics
 */
export async function getDeckRatingStats(deckId: string) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.get<DeckRatingStats>(`/api/decks/${deckId}/ratings`);
}

/**
 * Get user's rating for a deck
 */
export async function getUserRating(deckId: string) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.get<DeckRating>(`/api/decks/${deckId}/ratings/user`);
}

/**
 * Create or update rating
 */
export async function upsertRating(deckId: string, rating: number) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.post<DeckRating>(`/api/decks/${deckId}/ratings`, { rating });
}

/**
 * Delete rating
 */
export async function deleteRating(deckId: string) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.delete<void>(`/api/decks/${deckId}/ratings`);
}

// ============================================================================
// Review Operations
// ============================================================================

/**
 * Get reviews for a deck
 */
export async function getDeckReviews(
  deckId: string,
  options: { page?: number; limit?: number; sortBy?: 'recent' | 'helpful' } = {}
) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  const params = new URLSearchParams();
  if (options.page) params.append('page', options.page.toString());
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.sortBy) params.append('sortBy', options.sortBy);

  return api.get<ReviewsData>(`/api/decks/${deckId}/reviews?${params.toString()}`);
}

/**
 * Create review
 */
export async function createReview(
  deckId: string,
  input: { rating: number; title?: string; content: string }
) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.post<DeckReview>(`/api/decks/${deckId}/reviews`, input);
}

/**
 * Update review
 */
export async function updateReview(reviewId: string, input: { title?: string; content?: string }) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.patch<DeckReview>(`/api/reviews/${reviewId}`, input);
}

/**
 * Delete review
 */
export async function deleteReview(reviewId: string) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.delete<void>(`/api/reviews/${reviewId}`);
}

/**
 * Mark review as helpful
 */
export async function markReviewHelpful(reviewId: string) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.post<DeckReview>(`/api/reviews/${reviewId}/helpful`, {});
}
