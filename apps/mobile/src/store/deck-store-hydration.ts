import { getMobileApiClient } from '../lib/api/client';
import { upsertCardFromSync, upsertDeckFromSync } from '../db/deckRepositorySafe';
import { logger } from '../utils/logger';

type RemoteDeck = {
  id: string;
  userId?: string;
  name?: string;
  description?: string | null;
  accentKey?: string | null;
  materialType?: string | null;
  deckType?: string | null;
  locale?: string | null;
  visibility?: 'private' | 'public';
  isFeatured?: boolean;
  downloadCount?: number;
  viewCount?: number;
  createdAt?: string;
  updatedAt?: string;
  lastStudiedAt?: string | null;
};

type RemoteCard = {
  id: string;
  deckId: string;
  front?: string;
  back?: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  category?: string | null;
  pos?: string | null;
  gender?: string | null;
  example?: string | null;
  tags?: string | string[] | null;
  isStarred?: boolean;
  learnState?: 'not_studied' | 'learning' | 'mastered' | null;
  learnCorrectStreak?: number | null;
  learnCorrectTotal?: number | null;
  learnIncorrectTotal?: number | null;
  learnLastAnsweredAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastReviewedAt?: string | null;
  due?: string | null;
  stability?: number | null;
  difficulty?: number | null;
  elapsed_days?: number | null;
  scheduled_days?: number | null;
  learning_steps?: number | null;
  reps?: number | null;
  lapses?: number | null;
  state?: 'new' | 'learning' | 'review' | 'relearning' | null;
};

type RemoteDeckWithCards = RemoteDeck & {
  cards?: RemoteCard[];
};

export async function hydrateDecksFromApi(userId: string): Promise<boolean> {
  const apiClient = getMobileApiClient();
  if (!apiClient) {
    return false;
  }

  let page = 1;
  let hasMore = true;
  let hydratedAny = false;

  while (hasMore) {
    const deckPageResult = await apiClient.get<{
      items: RemoteDeck[];
      hasMore: boolean;
      page: number;
      totalPages: number;
    }>(`/api/decks?page=${page}&limit=100`);

    if (deckPageResult.isErr()) {
      logger.error('[DeckBootstrap] Failed to fetch deck list:', deckPageResult.error.message);
      return hydratedAny;
    }

    const remoteDecks = deckPageResult.value.items ?? [];
    if (!remoteDecks.length) {
      hasMore = false;
      continue;
    }

    for (const remoteDeck of remoteDecks) {
      const deckUpsertResult = await upsertDeckFromSync({
        ...remoteDeck,
        userId: remoteDeck.userId ?? userId,
      });

      if (deckUpsertResult.isErr()) {
        logger.error('[DeckBootstrap] Failed to upsert deck:', deckUpsertResult.error.message);
        continue;
      }

      hydratedAny = true;

      const deckDetailResult = await apiClient.get<RemoteDeckWithCards>(`/api/decks/${remoteDeck.id}`);
      if (deckDetailResult.isErr()) {
        logger.error('[DeckBootstrap] Failed to fetch deck details:', deckDetailResult.error.message);
        continue;
      }

      const remoteCards = deckDetailResult.value.cards ?? [];
      for (const remoteCard of remoteCards) {
        const cardUpsertResult = await upsertCardFromSync({
          ...remoteCard,
          deckId: remoteCard.deckId ?? remoteDeck.id,
        });

        if (cardUpsertResult.isErr()) {
          logger.error('[DeckBootstrap] Failed to upsert card:', cardUpsertResult.error.message);
        }
      }
    }

    hasMore = Boolean(deckPageResult.value.hasMore);
    page += 1;
  }

  return hydratedAny;
}
