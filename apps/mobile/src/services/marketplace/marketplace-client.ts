/**
 * Marketplace API client
 * Handles communication with marketplace endpoints
 */

import type { ResultAsync } from 'neverthrow';
import type {
    NetworkError,
    ApiError,
    ValidationError,
} from '@flashly/shared';
import type { MobileApiClient} from '../../lib/api/client';
import { getMobileApiClient } from '../../lib/api/client';
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
// MARKETPLACE CLIENT CLASS
// ============================================================================

export class MarketplaceClient {
    private apiClient: MobileApiClient;

    constructor(apiClient?: MobileApiClient) {
        this.apiClient = apiClient || getMobileApiClient()!;
    }

    /**
     * Browse public decks with filters
     */
    browseDecks(query: MarketplaceQuery = {}): ResultAsync<PaginatedMarketplaceDecks, NetworkError | ApiError | ValidationError> {
        const params = new URLSearchParams();

        if (query.materialType) params.append('materialType', query.materialType);
        if (query.deckType) params.append('deckType', query.deckType);
        if (query.locale) params.append('locale', query.locale);
        if (query.level) params.append('level', query.level);
        if (query.skill) params.append('skill', query.skill);
        if (query.regionalVariant) params.append('regionalVariant', query.regionalVariant);
        if (query.hasAudio !== undefined) params.append('hasAudio', String(query.hasAudio));
        if (query.script) params.append('script', query.script);
        if (query.romanization) params.append('romanization', query.romanization);
        if (query.licenseCode) params.append('licenseCode', query.licenseCode);
        if (query.search) params.append('search', query.search);
        if (query.page) params.append('page', String(query.page));
        if (query.limit) params.append('limit', String(query.limit));
        if (query.sortBy) params.append('sortBy', query.sortBy);
        if (query.sortOrder) params.append('sortOrder', query.sortOrder);

        const queryString = params.toString();
        const path = `/api/marketplace${queryString ? `?${queryString}` : ''}`;

        return this.apiClient.get<PaginatedMarketplaceDecks>(path);
    }

    /**
     * Get featured decks
     */
    getFeaturedDecks(limit: number = 20): ResultAsync<MarketplaceDeck[], NetworkError | ApiError | ValidationError> {
        return this.apiClient.get<MarketplaceDeck[]>(`/api/marketplace/featured?limit=${limit}`);
    }

    /**
     * Search decks
     */
    searchDecks(searchTerm: string, query: MarketplaceQuery = {}): ResultAsync<PaginatedMarketplaceDecks, NetworkError | ApiError | ValidationError> {
        return this.browseDecks({ ...query, search: searchTerm });
    }

    /**
     * Get deck details
     */
    getDeckDetails(deckId: string): ResultAsync<MarketplaceDeckWithCards, NetworkError | ApiError | ValidationError> {
        return this.apiClient.get<MarketplaceDeckWithCards>(`/api/marketplace/${deckId}`);
    }

    /**
     * Clone deck to user's library
     */
    cloneDeck(deckId: string): ResultAsync<CloneResult, NetworkError | ApiError | ValidationError> {
        return this.apiClient.post<CloneResult>(`/api/marketplace/${deckId}/clone`, {});
    }

    /**
     * Track deck view
     */
    trackView(deckId: string): ResultAsync<void, NetworkError | ApiError> {
        return this.apiClient
            .post<void>(`/api/marketplace/${deckId}/view`, {})
            .map(() => undefined);
    }

    /**
     * Get trending decks
     */
    getTrendingDecks(period: TrendingPeriod = 'week', limit: number = 10): ResultAsync<MarketplaceTrendingResult, NetworkError | ApiError | ValidationError> {
        const params = new URLSearchParams();
        params.append('period', period);
        params.append('limit', String(limit));
        return this.apiClient.get<MarketplaceTrendingResult>(`/api/marketplace/trending?${params.toString()}`);
    }

    /**
     * Get similar decks by ID
     */
    getSimilarDecks(deckId: string, limit: number = 6): ResultAsync<MarketplaceSimilarResult, NetworkError | ApiError | ValidationError> {
        return this.apiClient.get<MarketplaceSimilarResult>(`/api/marketplace/${deckId}/similar?limit=${limit}`);
    }

    /**
     * Get search suggestions
     */
    getSearchSuggestions(query: string, limit: number = 5): ResultAsync<MarketplaceSearchSuggestion[], NetworkError | ApiError | ValidationError> {
        const params = new URLSearchParams();
        params.append('q', query);
        params.append('limit', String(limit));
        return this.apiClient.get<MarketplaceSearchSuggestion[]>(`/api/search/suggestions?${params.toString()}`);
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let marketplaceClientInstance: MarketplaceClient | null = null;

export function createMarketplaceClient(apiClient: MobileApiClient): MarketplaceClient {
    marketplaceClientInstance = new MarketplaceClient(apiClient);
    return marketplaceClientInstance;
}

export function getMarketplaceClient(): MarketplaceClient | null {
    return marketplaceClientInstance;
}
