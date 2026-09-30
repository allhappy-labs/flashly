/**
 * Tests for Marketplace Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { okAsync, errAsync } from 'neverthrow';
import { NetworkError } from '@flashly/shared';
import { MobileApiClient } from '../../../lib/api/client';
import { MarketplaceClient } from '../marketplace-client';
import { createMarketplaceService } from '../marketplace-service';
import type { MarketplaceDeck, MarketplaceDeckWithCards } from '../marketplace-types';

const mockMarketplaceClient = new MarketplaceClient(
  new MobileApiClient({ baseUrl: 'http://localhost' }),
);

function createDeck(overrides: Partial<MarketplaceDeck> = {}): MarketplaceDeck {
  return {
    id: 'deck-1',
    userId: 'user-1',
    name: 'Spanish Vocabulary',
    description: null,
    accentKey: null,
    materialType: null,
    deckType: null,
    locale: null,
    visibility: 'public',
    isFeatured: false,
    downloadCount: 0,
    viewCount: 0,
    cardCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('MarketplaceService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('browseDecks', () => {
    it('should successfully fetch public decks', async () => {
      const browseDecksMock = vi.spyOn(mockMarketplaceClient, 'browseDecks');
      const mockDecks = [
        createDeck({ id: 'deck-1', name: 'Spanish Vocabulary', downloadCount: 100 }),
        createDeck({ id: 'deck-2', name: 'French Basics', downloadCount: 50 }),
      ];
      browseDecksMock.mockReturnValue(okAsync({
        items: mockDecks,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasMore: false,
      }));

      const marketplaceService = createMarketplaceService(mockMarketplaceClient);
      const result = await marketplaceService.browseDecks({ page: 1, limit: 10 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.items).toEqual(mockDecks);
        expect(result.value.total).toBe(2);
      }
      expect(browseDecksMock).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    it('should handle API errors', async () => {
      const browseDecksMock = vi.spyOn(mockMarketplaceClient, 'browseDecks');
      browseDecksMock.mockReturnValue(errAsync(new NetworkError('Network error')));

      const marketplaceService = createMarketplaceService(mockMarketplaceClient);
      const result = await marketplaceService.browseDecks({ page: 1 });

      expect(result.isErr()).toBe(true);
    });
  });

  describe('getDeckDetails', () => {
    it('should successfully fetch a single deck', async () => {
      const trackViewMock = vi.spyOn(mockMarketplaceClient, 'trackView');
      const getDeckDetailsMock = vi.spyOn(mockMarketplaceClient, 'getDeckDetails');
      const mockDeck: MarketplaceDeckWithCards = {
        ...createDeck({
          id: 'deck-1',
          name: 'Spanish Vocabulary',
        }),
        cards: [
          { id: 'card-1', front: 'Hola', back: 'Hello' },
          { id: 'card-2', front: 'Gracias', back: 'Thank you' },
        ],
      };
      trackViewMock.mockReturnValue(okAsync(undefined));
      getDeckDetailsMock.mockReturnValue(okAsync(mockDeck));

      const marketplaceService = createMarketplaceService(mockMarketplaceClient);
      const result = await marketplaceService.getDeckDetails('deck-1');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Spanish Vocabulary');
        expect(result.value.cards).toHaveLength(2);
      }
      expect(getDeckDetailsMock).toHaveBeenCalledWith('deck-1');
    });

    it('should handle not found error', async () => {
      const trackViewMock = vi.spyOn(mockMarketplaceClient, 'trackView');
      const getDeckDetailsMock = vi.spyOn(mockMarketplaceClient, 'getDeckDetails');
      trackViewMock.mockReturnValue(okAsync(undefined));
      getDeckDetailsMock.mockReturnValue(errAsync(new NetworkError('Deck not found')));

      const marketplaceService = createMarketplaceService(mockMarketplaceClient);
      const result = await marketplaceService.getDeckDetails('nonexistent');

      expect(result.isErr()).toBe(true);
    });
  });

  describe('cloneDeck', () => {
    it('should successfully clone a deck', async () => {
      const cloneDeckMock = vi.spyOn(mockMarketplaceClient, 'cloneDeck');
      const mockImport = {
        ...createDeck({
          id: 'new-deck-1',
          userId: 'user-1',
          name: 'Imported Deck',
          visibility: 'private',
        }),
        downloadCount: 0,
        viewCount: 0,
        cardCount: 1,
        cards: [{ id: 'card-1', front: 'Test', back: 'Prueba' }],
      };
      cloneDeckMock.mockReturnValue(okAsync(mockImport));

      const marketplaceService = createMarketplaceService(mockMarketplaceClient);
      const result = await marketplaceService.cloneDeck('deck-1');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Imported Deck');
      }
      expect(cloneDeckMock).toHaveBeenCalledWith('deck-1');
    });
  });
});
