/**
 * Marketplace service - Business logic for marketplace operations
 */

import type { ResultAsync} from 'neverthrow';
import { okAsync } from 'neverthrow';
import type {
    ApiError,
    NetworkError,
    ValidationError,
    NotFoundError,
} from '@flashly/shared';
import type { MarketplaceClient } from './marketplace-client';
import type {
    MarketplaceQuery,
    MarketplaceDeck,
    MarketplaceDeckWithCards,
    PaginatedMarketplaceDecks,
    CloneResult,
    MarketplaceTrendingResult,
    TrendingPeriod,
    MarketplaceSearchSuggestion,
    MarketplaceSimilarResult,
} from './marketplace-types';

// ============================================================================
// MARKETPLACE SERVICE CLASS
// ============================================================================

export class MarketplaceService {
    constructor(private marketplaceClient: MarketplaceClient) {}

    /**
     * Browse public decks with filters
     */
    browseDecks(query: MarketplaceQuery = {}): ResultAsync<PaginatedMarketplaceDecks, NetworkError | ApiError | ValidationError> {
        return this.marketplaceClient.browseDecks(query);
    }

    /**
     * Get featured decks
     */
    getFeaturedDecks(limit: number = 20): ResultAsync<MarketplaceDeck[], NetworkError | ApiError | ValidationError> {
        return this.marketplaceClient.getFeaturedDecks(limit);
    }

    /**
     * Search decks by term
     */
    searchDecks(searchTerm: string, query: MarketplaceQuery = {}): ResultAsync<PaginatedMarketplaceDecks, NetworkError | ApiError | ValidationError> {
        if (!searchTerm || searchTerm.trim().length === 0) {
            return this.browseDecks(query);
        }

        return this.marketplaceClient.searchDecks(searchTerm.trim(), query);
    }

    /**
     * Get deck details and track view
     */
    getDeckDetails(deckId: string): ResultAsync<MarketplaceDeckWithCards, NetworkError | ApiError | ValidationError> {
        // Track view in background, don't wait for it
        this.marketplaceClient.trackView(deckId).match(
            () => {},
            () => {}
        );

        return this.marketplaceClient.getDeckDetails(deckId);
    }

    /**
     * Clone deck to user's library
     * Returns the cloned deck with cards
     */
    cloneDeck(deckId: string): ResultAsync<CloneResult, NetworkError | ApiError | ValidationError | NotFoundError> {
        return this.marketplaceClient.cloneDeck(deckId);
    }

    /**
     * Get decks by material type
     */
    getDecksByMaterialType(materialType: string, query: MarketplaceQuery = {}): ResultAsync<PaginatedMarketplaceDecks, NetworkError | ApiError | ValidationError> {
        return this.browseDecks({ ...query, materialType });
    }

    /**
     * Get decks by locale
     */
    getDecksByLocale(locale: string, query: MarketplaceQuery = {}): ResultAsync<PaginatedMarketplaceDecks, NetworkError | ApiError | ValidationError> {
        return this.browseDecks({ ...query, locale });
    }

    /**
     * Get decks by deck type
     */
    getDecksByDeckType(deckType: string, query: MarketplaceQuery = {}): ResultAsync<PaginatedMarketplaceDecks, NetworkError | ApiError | ValidationError> {
        return this.browseDecks({ ...query, deckType });
    }

    /**
     * Get popular decks (sorted by download count)
     */
    getPopularDecks(query: MarketplaceQuery = {}): ResultAsync<PaginatedMarketplaceDecks, NetworkError | ApiError | ValidationError> {
        return this.browseDecks({
            ...query,
            sortBy: 'downloadCount',
            sortOrder: 'desc',
        });
    }

    /**
     * Get most viewed decks
     */
    getMostViewedDecks(query: MarketplaceQuery = {}): ResultAsync<PaginatedMarketplaceDecks, NetworkError | ApiError | ValidationError> {
        return this.browseDecks({
            ...query,
            sortBy: 'viewCount',
            sortOrder: 'desc',
        });
    }

    /**
     * Get newest decks
     */
    getNewestDecks(query: MarketplaceQuery = {}): ResultAsync<PaginatedMarketplaceDecks, NetworkError | ApiError | ValidationError> {
        return this.browseDecks({
            ...query,
            sortBy: 'created',
            sortOrder: 'desc',
        });
    }

    /**
     * Get recently updated decks
     */
    getRecentlyUpdatedDecks(query: MarketplaceQuery = {}): ResultAsync<PaginatedMarketplaceDecks, NetworkError | ApiError | ValidationError> {
        return this.browseDecks({
            ...query,
            sortBy: 'updated',
            sortOrder: 'desc',
        });
    }

    /**
     * Get trending decks
     */
    getTrendingDecks(
        period: TrendingPeriod = 'week',
        limit: number = 10
    ): ResultAsync<MarketplaceTrendingResult, NetworkError | ApiError | ValidationError> {
        return this.marketplaceClient.getTrendingDecks(period, limit);
    }

    /**
     * Get similar decks
     */
    getSimilarDecks(
        deckId: string,
        limit: number = 6
    ): ResultAsync<MarketplaceSimilarResult, NetworkError | ApiError | ValidationError> {
        return this.marketplaceClient.getSimilarDecks(deckId, limit);
    }

    /**
     * Get search suggestions
     */
    getSearchSuggestions(
        query: string,
        limit: number = 5
    ): ResultAsync<MarketplaceSearchSuggestion[], NetworkError | ApiError | ValidationError> {
        if (!query || query.trim().length === 0) {
            return okAsync([]);
        }
        return this.marketplaceClient.getSearchSuggestions(query.trim(), limit);
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let marketplaceServiceInstance: MarketplaceService | null = null;

export function createMarketplaceService(marketplaceClient: MarketplaceClient): MarketplaceService {
    marketplaceServiceInstance = new MarketplaceService(marketplaceClient);
    return marketplaceServiceInstance;
}

export function getMarketplaceService(): MarketplaceService | null {
    return marketplaceServiceInstance;
}
