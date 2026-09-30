/**
 * Marketplace types
 */

import type { MarketplaceMetadata, RomanizationPreference } from '@flashly/shared';

// ============================================================================
// MARKETPLACE QUERY
// ============================================================================

export type MarketplaceSortBy =
    | 'newest'
    | 'most_downloaded'
    | 'most_viewed'
    | 'created'
    | 'updated'
    | 'name'
    | 'downloadCount'
    | 'viewCount';

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
    sortBy?: MarketplaceSortBy;
    sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// MARKETPLACE DECK (from API)
// ============================================================================

export interface MarketplaceAuthor {
    id: string;
    name: string;
    username?: string | null;
    displayName?: string | null;
    image?: string | null;
}

export interface MarketplaceDeck {
    id: string;
    userId: string;
    name: string;
    description?: string | null;
    accentKey?: string | null;
    materialType?: string | null;
    deckType?: string | null;
    locale?: string | null;
    marketplaceMetadata?: MarketplaceMetadata | null;
    visibility: 'private' | 'public';
    isFeatured: boolean;
    downloadCount: number;
    viewCount: number;
    cardCount: number;
    isAdded?: boolean;
    createdAt: string;
    updatedAt: string;
    lastStudiedAt?: string | null;
    user?: MarketplaceAuthor;
}

export interface DeckPreviewCard {
    id: string;
    front: string;
    back: string;
    imageUrl?: string | null;
    audioUrl?: string | null;
}

export interface MarketplaceDeckWithCards extends MarketplaceDeck {
    cards?: DeckPreviewCard[];
}

// ============================================================================
// PAGINATED MARKETPLACE DECKS
// ============================================================================

export interface PaginatedMarketplaceDecks {
    items: MarketplaceDeck[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
}

// ============================================================================
// CLONE RESULT
// ============================================================================

export type CloneResult = MarketplaceDeckWithCards;

// ============================================================================
// DISCOVERY TYPES
// ============================================================================

export type TrendingPeriod = 'day' | 'week' | 'month' | 'all';

export interface MarketplaceTrendingDeck {
    id: string;
    name: string;
    description: string | null;
    cardCount: number;
    rating: number;
    downloadCount: number;
    viewCount: number;
}

export interface MarketplaceTrendingResult {
    decks: MarketplaceTrendingDeck[];
    period: TrendingPeriod;
}

export interface MarketplaceSimilarDeck {
    id: string;
    name: string;
    description: string | null;
    cardCount: number;
    rating: number;
    downloadCount: number;
    matchScore: number;
}

export interface MarketplaceSimilarResult {
    decks: MarketplaceSimilarDeck[];
}

export interface MarketplaceSearchSuggestion {
    id: string;
    name: string;
    type: 'deck' | 'category';
}
