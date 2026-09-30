/**
 * Deck Service - API client for deck and card operations
 *
 * This service wraps all deck-related API calls with neverthrow Result types
 * for type-safe error handling throughout the frontend.
 *
 * API Endpoints:
 * - POST   /api/decks                    - Create deck
 * - GET    /api/decks                    - List user's decks
 * - GET    /api/decks/:id                - Get deck with cards
 * - PUT    /api/decks/:id                - Update deck
 * - DELETE /api/decks/:id                - Delete deck
 * - PATCH  /api/decks/:id/visibility     - Set deck visibility
 * - GET    /api/marketplace              - Browse marketplace
 * - GET    /api/marketplace/featured     - Get featured decks
 * - GET    /api/marketplace/search       - Search marketplace
 * - GET    /api/marketplace/:id          - View public deck
 * - POST   /api/marketplace/:id/clone    - Clone deck
 */

import { getApiClient } from './client';
import type {
  Card,
  CreateCardInput,
  CreateDeckInput,
  Deck,
  DeckWithCardCount,
  DeckWithCards,
  PaginatedResponse,
  UpdateCardInput,
  UpdateDeckInput,
  DeckVisibility,
  MarketplaceQuery,
} from '@/types/api.types';
import type { QuizEnrichment } from '@flashly/shared/src';

// ============================================================================
// Deck Management
// ============================================================================

/**
 * Create a new deck
 */
export async function createDeck(input: CreateDeckInput) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.post<Deck>('/api/decks', input);
}

/**
 * List user's decks with pagination
 */
export async function listUserDecks(query: { page?: number; limit?: number } = {}) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  const params = new URLSearchParams();
  if (query.page) params.append('page', query.page.toString());
  if (query.limit) params.append('limit', query.limit.toString());

  return api.get<PaginatedResponse<DeckWithCardCount>>(`/api/decks?${params.toString()}`);
}

/**
 * Get deck by ID with all cards
 */
export async function getDeck(deckId: string) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.get<DeckWithCards>(`/api/decks/${deckId}`);
}

/**
 * Update deck metadata
 */
export async function updateDeck(deckId: string, input: UpdateDeckInput) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.put<DeckWithCards>(`/api/decks/${deckId}`, input);
}

/**
 * Delete a deck
 */
export async function deleteDeck(deckId: string) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.delete<void>(`/api/decks/${deckId}`);
}

/**
 * Set deck visibility (private/public)
 */
export async function setDeckVisibility(deckId: string, visibility: DeckVisibility) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.patch<void>(`/api/decks/${deckId}/visibility`, { visibility });
}

// ============================================================================
// Card Management
// ============================================================================

/**
 * Create a new card in a deck
 */
export async function createCard(deckId: string, input: Omit<CreateCardInput, 'deckId'>) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  // Note: Backend doesn't have a separate card creation endpoint yet
  // This is a placeholder for when it's implemented
  return api.post<Card>(`/api/decks/${deckId}/cards`, input);
}

/**
 * Bulk create cards in a deck (server deduplicates by front text)
 */
export async function bulkCreateCards(deckId: string, inputs: Array<Omit<CreateCardInput, 'deckId'>>) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.post<{ count: number; skippedDuplicates: number }>(`/api/decks/${deckId}/cards`, {
    cards: inputs,
  });
}

/**
 * Update an existing card
 */
export async function updateCard(deckId: string, cardId: string, input: UpdateCardInput) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  // Note: Backend doesn't have a separate card update endpoint yet
  // This is a placeholder for when it's implemented
  return api.put<Card>(`/api/decks/${deckId}/cards/${cardId}`, input);
}

/**
 * Delete a card
 */
export async function deleteCard(deckId: string, cardId: string) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  // Note: Backend doesn't have a separate card deletion endpoint yet
  // This is a placeholder for when it's implemented
  return api.delete<void>(`/api/decks/${deckId}/cards/${cardId}`);
}

/**
 * Bulk delete cards
 */
export async function bulkDeleteCards(deckId: string, cardIds: string[]) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.post<{ count: number }>(`/api/decks/${deckId}/cards/bulk/delete`, {
    cardIds,
  });
}

/**
 * Bulk update cards
 */
export async function bulkUpdateCards(
  deckId: string,
  cardIds: string[],
    updates: { category?: string; tags?: string },
) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.post<{ count: number }>(`/api/decks/${deckId}/cards/bulk/update`, {
    cardIds,
    ...updates,
  });
}

export async function bulkUpdateCardQuizzes(
    deckId: string,
    updates: Array<{ cardId: string; quiz: QuizEnrichment | null }>,
) {
    const api = getApiClient();
    if (!api) {
        throw new Error('API client not initialized');
    }

    return api.post<{ count: number }>(`/api/decks/${deckId}/cards/bulk/quiz`, { updates });
}

// ============================================================================
// Marketplace
// ============================================================================

/**
 * Browse marketplace with filters
 */
export async function browseMarketplace(query: MarketplaceQuery = {}) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

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
  if (query.page) params.append('page', query.page.toString());
  if (query.limit) params.append('limit', query.limit.toString());
  if (query.sortBy) params.append('sortBy', query.sortBy);

  return api.get<PaginatedResponse<DeckWithCardCount>>(`/api/marketplace?${params.toString()}`);
}

/**
 * Get featured decks
 */
export async function getFeaturedDecks(limit: number = 10) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  const params = new URLSearchParams();
  params.append('limit', limit.toString());

  return api.get<DeckWithCardCount[]>(`/api/marketplace/featured?${params.toString()}`);
}

/**
 * Search marketplace
 */
export async function searchMarketplace(query: {
  q: string;
  materialType?: string;
  deckType?: string;
  locale?: string;
  page?: number;
  limit?: number;
}) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  const params = new URLSearchParams();
  params.append('q', query.q);
  if (query.materialType) params.append('materialType', query.materialType);
  if (query.deckType) params.append('deckType', query.deckType);
  if (query.locale) params.append('locale', query.locale);
  if (query.page) params.append('page', query.page.toString());
  if (query.limit) params.append('limit', query.limit.toString());

    return api.get<PaginatedResponse<DeckWithCardCount>>(`/api/marketplace/search?${params.toString()}`);
}

/**
 * Get public deck details from marketplace
 */
export async function getMarketplaceDeck(deckId: string) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.get<DeckWithCards>(`/api/marketplace/${deckId}`);
}

/**
 * Clone a deck from marketplace to user's library
 */
export async function cloneDeck(deckId: string) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.post<DeckWithCards>(`/api/marketplace/${deckId}/clone`);
}

/**
 * Nominate deck for featuring
 */
export async function nominateDeck(deckId: string, input: { reason: string }) {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  return api.post<{
    id: string;
    deckId: string;
    userId: string;
    reason: string;
    status: string;
    createdAt: Date | string;
  }>(`/api/decks/${deckId}/nominate`, input);
}
