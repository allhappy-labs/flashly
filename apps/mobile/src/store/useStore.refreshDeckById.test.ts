import { err, ok } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMocks = vi.hoisted(() => ({
  addCards: vi.fn(),
  createCard: vi.fn(),
  getDeck: vi.fn(),
  getDeckStats: vi.fn(),
  updateCard: vi.fn(),
}));

const schedulerMocks = vi.hoisted(() => ({
  buildFsrsDefaults: vi.fn(),
}));

const hydrationMocks = vi.hoisted(() => ({
  hydrateDecksFromApi: vi.fn(),
}));

vi.mock('../db/deckRepositorySafe', () => ({
  addCards: repositoryMocks.addCards,
  createCard: repositoryMocks.createCard,
  createDeck: vi.fn(),
  deleteCard: vi.fn(),
  deleteDeck: vi.fn(),
  getDeck: repositoryMocks.getDeck,
  getDeckStats: repositoryMocks.getDeckStats,
  listCards: vi.fn(),
  listDecks: vi.fn(),
  resetDeckProgress: vi.fn(),
  touchDeckStudied: vi.fn(),
  updateCard: repositoryMocks.updateCard,
  updateDeck: vi.fn(),
}));

vi.mock('./deck-store-hydration', () => ({
  hydrateDecksFromApi: hydrationMocks.hydrateDecksFromApi,
}));

vi.mock('../db/database', () => ({
  initializeDatabase: vi.fn(),
}));

vi.mock('../i18n', () => ({
  default: {
    changeLanguage: vi.fn(),
  },
}));

vi.mock('../services/fsrsScheduler', () => ({
  buildFsrsDefaults: schedulerMocks.buildFsrsDefaults,
  getFsrsParameters: vi.fn(),
  setFsrsParameters: vi.fn(),
}));

vi.mock('../services/sync/sync-queue', () => ({
  enqueueSyncOperation: vi.fn(),
}));

import { useStore } from './useStore';

const deckRow = {
  id: 'deck-1',
  name: 'Imported deck',
  description: '',
  createdAt: 1,
  updatedAt: 1,
  lastStudiedAt: null,
  cardCount: 0,
  dueCount: 0,
  newCount: 0,
  learningCount: 0,
  reviewCount: 0,
  relearningCount: 0,
  retention: 1,
  cards: [
    {
      id: 'card-1',
      deckId: 'deck-1',
      front: 'Front',
      back: 'Back',
      createdAt: 1,
      updatedAt: 1,
      due: 1,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: 'new',
    },
  ],
};

const freshStats = {
  totalCount: 1,
  dueCount: 1,
  newCount: 1,
  learningCount: 0,
  reviewCount: 0,
  relearningCount: 0,
  retention: 1,
};

const storedCard = {
  id: 'card-1',
  deckId: 'deck-1',
  front: 'Prompt cover',
  back: 'Answer diagram',
  createdAt: 1,
  updatedAt: 1,
  due: 1,
  stability: 0,
  difficulty: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  learning_steps: 0,
  reps: 0,
  lapses: 0,
  state: 'new',
  learnState: 'not_studied',
  learnCorrectStreak: 0,
  learnCorrectTotal: 0,
  learnIncorrectTotal: 0,
  learnLastAnsweredAt: null,
};

describe('refreshDeckById', () => {
  beforeEach(() => {
    repositoryMocks.getDeck.mockReset();
    repositoryMocks.getDeckStats.mockReset();
    repositoryMocks.createCard.mockReset();
    repositoryMocks.updateCard.mockReset();
    repositoryMocks.addCards.mockReset();
    hydrationMocks.hydrateDecksFromApi.mockReset();
    schedulerMocks.buildFsrsDefaults.mockReturnValue({
      lastReviewedAt: null,
      due: 1,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
    });
    useStore.setState({ decks: [], userId: null });
  });

  it('merges fresh stats before one store update', async () => {
    repositoryMocks.getDeck.mockResolvedValue(ok(deckRow));
    repositoryMocks.getDeckStats.mockResolvedValue(ok(freshStats));
    const deckSnapshots: unknown[] = [];
    const unsubscribe = useStore.subscribe((state) => {
      deckSnapshots.push(state.decks);
    });

    await useStore.getState().refreshDeckById('deck-1');
    unsubscribe();

    expect(deckSnapshots).toHaveLength(1);
    expect(useStore.getState().decks[0]).toMatchObject({
      id: 'deck-1',
      cardCount: 1,
      dueCount: 1,
      newCount: 1,
    });
  });

  it('preserves hosted hydration fallback and then applies fresh stats', async () => {
    repositoryMocks.getDeck
      .mockResolvedValueOnce(err(new Error('missing')))
      .mockResolvedValueOnce(ok(deckRow));
    repositoryMocks.getDeckStats.mockResolvedValue(ok(freshStats));
    hydrationMocks.hydrateDecksFromApi.mockResolvedValue(true);
    useStore.setState({ userId: 'user-1' });

    await useStore.getState().refreshDeckById('deck-1');

    expect(hydrationMocks.hydrateDecksFromApi).toHaveBeenCalledWith('user-1');
    expect(repositoryMocks.getDeck).toHaveBeenCalledTimes(2);
    expect(useStore.getState().decks[0]).toMatchObject({
      id: 'deck-1',
      cardCount: 1,
      dueCount: 1,
      newCount: 1,
    });
  });
});

describe('card Markdown persistence policy', () => {
  const remoteMarkdown = {
    front: 'Prompt ![cover](https://cdn.example/cover.png)',
    back: '<img alt="diagram" src="http://cdn.example/diagram.png" />',
  };

  beforeEach(() => {
    repositoryMocks.getDeckStats.mockResolvedValue(ok(freshStats));
    repositoryMocks.createCard.mockResolvedValue(ok('card-1'));
    repositoryMocks.updateCard.mockResolvedValue(ok(storedCard));
    repositoryMocks.addCards.mockResolvedValue(ok([storedCard]));
  });

  it('sanitizes remote Markdown images before create, update, and bulk persistence in local mode', async () => {
    await useStore.getState().saveCard('deck-1', remoteMarkdown);
    await useStore.getState().saveCard('deck-1', { ...remoteMarkdown, cardId: 'card-1' });
    await useStore.getState().bulkAddCards('deck-1', [remoteMarkdown]);

    expect(repositoryMocks.createCard).toHaveBeenCalledWith('deck-1', expect.objectContaining({
      front: 'Prompt cover',
      back: 'diagram',
    }));
    expect(repositoryMocks.updateCard).toHaveBeenCalledWith('card-1', expect.objectContaining({
      front: 'Prompt cover',
      back: 'diagram',
    }));
    expect(repositoryMocks.addCards).toHaveBeenCalledWith('deck-1', [expect.objectContaining({
      front: 'Prompt cover',
      back: 'diagram',
    })]);
  });
});
