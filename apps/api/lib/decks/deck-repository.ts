import type { ResultAsync } from 'neverthrow';
import type {
    DatabaseError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
} from '@flashly/shared';
import type { QuizEnrichment } from '@flashly/shared';
import type {
    CreateDeckInput,
    MarketplaceQuery,
    UpdateDeckInput,
} from './deck-schema.ts';
import {
    bulkCreateCardsOperation,
    bulkDeleteCardsOperation,
    bulkUpdateCardsOperation,
    bulkUpdateCardQuizzesOperation,
    createCardOperation,
    deleteCardOperation,
    updateCardOperation,
} from './deck-repository-card-operations.ts';
import {
    createDeckOperation,
    deleteDeckOperation,
    getDeckByIdOperation,
    listUserDecksOperation,
    setDeckVisibilityOperation,
    updateDeckOperation,
} from './deck-repository-deck-operations.ts';
import {
    cloneDeckOperation,
    getFeaturedDecksOperation,
    incrementViewCountOperation,
    listMarketplaceDecksOperation,
} from './deck-repository-marketplace-operations.ts';
import {
    getOrCreateSyncStateOperation,
    updateSyncStateOperation,
} from './deck-repository-sync-operations.ts';
import type {
    Card,
    CardMutationInput,
    CardPartialMutationInput,
    Deck,
    DeckWithCards,
    DeckWithStats,
    PaginatedDecks,
    SyncState,
} from './deck-repository-shared.ts';

export type {
    Card,
    CardMutationInput,
    CardPartialMutationInput,
    Deck,
    DeckWithCards,
    DeckWithStats,
    PaginatedDecks,
    SyncState,
} from './deck-repository-shared.ts';

export class DeckRepository {
    createDeck(userId: string, data: CreateDeckInput): ResultAsync<Deck, DatabaseError | ValidationError> {
        return createDeckOperation(userId, data);
    }

    getDeckById(deckId: string): ResultAsync<DeckWithCards, DatabaseError | NotFoundError> {
        return getDeckByIdOperation(deckId);
    }

    listUserDecks(
        userId: string,
        options: { page?: number; limit?: number } = {}
    ): ResultAsync<PaginatedDecks, DatabaseError | ValidationError> {
        return listUserDecksOperation(userId, options);
    }

    updateDeck(
        deckId: string,
        userId: string,
        data: UpdateDeckInput
    ): ResultAsync<Deck, DatabaseError | ValidationError | ForbiddenError | NotFoundError> {
        return updateDeckOperation(deckId, userId, data);
    }

    deleteDeck(deckId: string, userId: string): ResultAsync<void, DatabaseError | ForbiddenError | NotFoundError> {
        return deleteDeckOperation(deckId, userId);
    }

    setDeckVisibility(
        deckId: string,
        userId: string,
        visibility: 'public' | 'private'
    ): ResultAsync<void, DatabaseError | ForbiddenError | NotFoundError | ValidationError> {
        return setDeckVisibilityOperation(deckId, userId, visibility);
    }

    listMarketplaceDecks(query: MarketplaceQuery): ResultAsync<PaginatedDecks, DatabaseError | ValidationError> {
        return listMarketplaceDecksOperation(query);
    }

    getFeaturedDecks(limit: number = 10): ResultAsync<DeckWithStats[], DatabaseError> {
        return getFeaturedDecksOperation(limit);
    }

    cloneDeck(
        deckId: string,
        userId: string
    ): ResultAsync<DeckWithCards, DatabaseError | NotFoundError> {
        return cloneDeckOperation(deckId, userId);
    }

    incrementViewCount(deckId: string): ResultAsync<void, DatabaseError> {
        return incrementViewCountOperation(deckId);
    }

    getOrCreateSyncState(userId: string): ResultAsync<SyncState, DatabaseError> {
        return getOrCreateSyncStateOperation(userId);
    }

    updateSyncState(
        userId: string,
        data: {
            lastSyncAt: Date;
            syncCursor?: string | null;
            pendingChanges?: number;
        }
    ): ResultAsync<SyncState, DatabaseError> {
        return updateSyncStateOperation(userId, data);
    }

    createCard(
        deckId: string,
        userId: string,
        data: CardMutationInput
    ): ResultAsync<Card, DatabaseError | ValidationError | NotFoundError | ForbiddenError> {
        return createCardOperation(deckId, userId, data);
    }

    bulkCreateCards(
        deckId: string,
        userId: string,
        items: CardMutationInput[]
    ): ResultAsync<{ count: number; skippedDuplicates: number }, DatabaseError | ValidationError | NotFoundError | ForbiddenError> {
        return bulkCreateCardsOperation(deckId, userId, items);
    }

    updateCard(
        cardId: string,
        deckId: string,
        userId: string,
        data: CardPartialMutationInput
    ): ResultAsync<Card, DatabaseError | ValidationError | NotFoundError | ForbiddenError> {
        return updateCardOperation(cardId, deckId, userId, data);
    }

    deleteCard(
        cardId: string,
        deckId: string,
        userId: string
    ): ResultAsync<void, DatabaseError | NotFoundError | ForbiddenError> {
        return deleteCardOperation(cardId, deckId, userId);
    }

    bulkDeleteCards(
        cardIds: string[],
        deckId: string,
        userId: string
    ): ResultAsync<{ count: number }, DatabaseError | NotFoundError | ForbiddenError> {
        return bulkDeleteCardsOperation(cardIds, deckId, userId);
    }

    bulkUpdateCards(
        cardIds: string[],
        deckId: string,
        userId: string,
        data: {
            category?: string;
            tags?: string;
        }
    ): ResultAsync<{ count: number }, DatabaseError | NotFoundError | ForbiddenError> {
        return bulkUpdateCardsOperation(cardIds, deckId, userId, data);
    }

    bulkUpdateCardQuizzes(
        updates: Array<{ cardId: string; quiz: QuizEnrichment | null }>,
        deckId: string,
        userId: string,
    ): ResultAsync<{ count: number }, DatabaseError | NotFoundError | ForbiddenError | ValidationError> {
        return bulkUpdateCardQuizzesOperation(updates, deckId, userId);
    }
}

export const deckRepository = new DeckRepository();
