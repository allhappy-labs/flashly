/**
 * Tests for Marketplace Client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { okAsync } from 'neverthrow';
import { createMarketplaceClient } from '../marketplace-client';
import { MobileApiClient } from '../../../lib/api/client';

// Mock API client
const mockApiClient = new MobileApiClient({
  baseUrl: 'http://localhost',
});

describe('MarketplaceClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('browseDecks', () => {
    it('should fetch public decks from API', async () => {
      const getMock = vi.spyOn(mockApiClient, 'get');
      const mockResponse = {
        items: [
          { id: 'deck-1', name: 'Test Deck', downloadCount: 10 },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasMore: false,
      };
      getMock.mockReturnValue(okAsync(mockResponse));

      const marketplaceClient = createMarketplaceClient(mockApiClient);
      const result = await marketplaceClient.browseDecks({ page: 1, limit: 10 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items).toEqual(mockResponse.items);
      }
      expect(getMock).toHaveBeenCalledWith('/api/marketplace?page=1&limit=10');
    });

    it('should pass query parameters correctly', async () => {
      const getMock = vi.spyOn(mockApiClient, 'get');
      getMock.mockReturnValue(okAsync({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasMore: false,
      }));

      const marketplaceClient = createMarketplaceClient(mockApiClient);
      await marketplaceClient.browseDecks({
        page: 2,
        limit: 20,
        search: 'spanish',
        locale: 'es',
      });

      expect(getMock).toHaveBeenCalledWith('/api/marketplace?locale=es&search=spanish&page=2&limit=20');
    });
  });

  describe('getDeckDetails', () => {
    it('should fetch a single deck from API', async () => {
      const getMock = vi.spyOn(mockApiClient, 'get');
      const mockDeck = {
        id: 'deck-1',
        name: 'Spanish Vocabulary',
        description: 'Learn Spanish',
        cards: [],
      };
      getMock.mockReturnValue(okAsync(mockDeck));

      const marketplaceClient = createMarketplaceClient(mockApiClient);
      const result = await marketplaceClient.getDeckDetails('deck-1');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Spanish Vocabulary');
      }
      expect(getMock).toHaveBeenCalledWith('/api/marketplace/deck-1');
    });
  });

  describe('cloneDeck', () => {
    it('should clone a deck via API', async () => {
      const postMock = vi.spyOn(mockApiClient, 'post');
      const mockImport = {
        id: 'new-deck',
        userId: 'user-1',
        name: 'Imported',
        visibility: 'private',
        isFeatured: false,
        downloadCount: 0,
        viewCount: 0,
        cardCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cards: [],
      };
      postMock.mockReturnValue(okAsync(mockImport));

      const marketplaceClient = createMarketplaceClient(mockApiClient);
      const result = await marketplaceClient.cloneDeck('deck-1');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Imported');
      }
      expect(postMock).toHaveBeenCalledWith('/api/marketplace/deck-1/clone', {});
    });
  });
});
