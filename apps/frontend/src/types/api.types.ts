/**
 * Centralized API types for deck and card operations
 *
 * These types align with the backend API schemas defined in:
 * - apps/api/routes/decks.ts
 * - apps/api/routes/marketplace.ts
 */

import type { MarketplaceMetadata, QuizEnrichment, RomanizationPreference } from '@flashly/shared';

// ============================================================================
// Deck Types
// ============================================================================

export type DeckVisibility = 'private' | 'public';

export interface Deck {
  id: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    username?: string | null;
    displayName?: string | null;
    image?: string | null;
  };
  name: string;
  description: string | null;
  accentKey: string | null;
  materialType: string | null;
  deckType: string | null;
  locale: string | null;
  marketplaceMetadata?: MarketplaceMetadata | null;
  visibility: DeckVisibility;
  isFeatured: boolean;
  downloadCount: number;
  viewCount: number;
  lastSyncedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastStudiedAt: Date | string | null;
}

export interface DeckWithCardCount extends Deck {
  cardCount: number;
}

export interface DeckWithCards extends Deck {
  cards: Card[];
}

// ============================================================================
// Card Types
// ============================================================================

export type LearnState = 'not_studied' | 'learning' | 'mastered';
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  imageUrl: string | null;
  audioUrl: string | null;
  category: string | null;
  pos: string | null;
  gender: string | null;
  example: string | null;
  tags: string | null;
  isStarred: boolean;
  learnState: LearnState | null;
  learnCorrectStreak: number | null;
  learnCorrectTotal: number | null;
  learnIncorrectTotal: number | null;
  learnLastAnsweredAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastReviewedAt: Date | string | null;
  due: Date | string | null;
  stability: number | null;
  difficulty: number | null;
  elapsed_days: number | null;
  scheduled_days: number | null;
  learning_steps: number | null;
  reps: number | null;
  lapses: number | null;
  state: CardState | null;
  quiz?: QuizEnrichment | null;
}

// ============================================================================
// Pagination Types
// ============================================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// ============================================================================
// Input Types
// ============================================================================

export interface CreateDeckInput {
  name: string;
  description?: string;
  accentKey?: string;
  materialType?: string;
  deckType?: string;
  locale?: string;
  visibility?: DeckVisibility;
}

export interface UpdateDeckInput {
  name?: string;
  description?: string;
  materialType?: string;
  deckType?: string;
  locale?: string;
  accentKey?: string;
  visibility?: DeckVisibility;
}

export interface CreateCardInput {
  deckId: string;
  front: string;
  back: string;
  imageUrl?: string;
  audioUrl?: string;
  category?: string;
  pos?: string;
  gender?: string;
  example?: string;
  tags?: string;
  quiz?: QuizEnrichment | null;
}

export interface UpdateCardInput {
  front?: string;
  back?: string;
  imageUrl?: string;
  audioUrl?: string;
  category?: string;
  pos?: string;
  gender?: string;
  example?: string;
  tags?: string;
  quiz?: QuizEnrichment | null;
}

// ============================================================================
// Query/Filter Types
// ============================================================================

export interface ListDecksQuery {
  page?: number;
  limit?: number;
}

export interface MarketplaceQuery {
  materialType?: string;
  deckType?: string;
  locale?: string;
  level?: string;
  skill?: string;
  regionalVariant?: string;
  hasAudio?: boolean;
  script?: string;
  romanization?: RomanizationPreference;
  licenseCode?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: MarketplaceSortOption;
}

export type MarketplaceSortOption = 'newest' | 'most_downloaded' | 'most_viewed';

// ============================================================================
// Rating & Review Types
// ============================================================================

export interface DeckRating {
  id: string;
  deckId: string;
  userId: string;
  rating: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface DeckReview extends DeckRating {
  title: string | null;
  content: string;
  helpfulCount: number;
}

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

export interface CreateReviewInput {
  rating: number;
  title?: string;
  content: string;
}

// ============================================================================
// User Profile Types
// ============================================================================

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  image: string | null;
  bio: string | null;
  website: string | null;
  twitterHandle: string | null;
  followerCount: number;
  isFollowing?: boolean;
  deckCount: number;
  totalDownloads: number;
}
