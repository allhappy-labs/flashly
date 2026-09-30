import { describe, expect, it, vi } from 'vitest';

describe('local store module boundary', () => {
  it('does not evaluate the hosted API client while importing the local runtime store', async () => {
    vi.resetModules();
    vi.doMock('@react-native-async-storage/async-storage', () => ({
      default: {
        getItem: vi.fn(),
        removeItem: vi.fn(),
        setItem: vi.fn(),
      },
    }));
    vi.doMock('../constants', () => ({
      DAILY_GOAL_ALLOW_EXTRA_STORAGE_KEY: 'daily-goal-allow-extra',
      DAILY_GOAL_STORAGE_KEY: 'daily-goal',
      FSRS_PARAMS_STORAGE_KEY: 'fsrs-params',
      HAPTICS_ENABLED_STORAGE_KEY: 'haptics-enabled',
      INTRO_SEEN_STORAGE_KEY: 'intro-seen',
      LANGUAGE_STORAGE_KEY: 'language',
      TIME_GRADING_CONFIG_STORAGE_KEY: 'time-grading-config',
    }));
    vi.doMock('../db/database', () => ({ initializeDatabase: vi.fn() }));
    vi.doMock('../db/deckRepositorySafe', () => ({
      addCards: vi.fn(),
      createCard: vi.fn(),
      createDeck: vi.fn(),
      deleteCard: vi.fn(),
      deleteDeck: vi.fn(),
      getDeck: vi.fn(),
      getDeckStats: vi.fn(),
      listCards: vi.fn(),
      listDecks: vi.fn(),
      resetDeckProgress: vi.fn(),
      touchDeckStudied: vi.fn(),
      updateCard: vi.fn(),
      updateDeck: vi.fn(),
    }));
    vi.doMock('../i18n', () => ({ default: { isInitialized: false } }));
    vi.doMock('../services/fsrsScheduler', () => ({
      buildFsrsDefaults: vi.fn(),
      getFsrsParameters: vi.fn(),
      setFsrsParameters: vi.fn(),
    }));
    vi.doMock('../services/sync/sync-queue', () => ({ enqueueSyncOperation: vi.fn() }));
    vi.doMock('../utils/logger', () => ({ logger: { debug: vi.fn(), error: vi.fn() } }));
    vi.doMock('../utils/timeGrading', () => ({
      DEFAULT_TIME_GRADING_CONFIG: {},
      normalizeTimeGradingConfig: vi.fn(),
    }));
    vi.doMock('../lib/api/client', () => {
      throw new Error('Hosted API client was evaluated');
    });

    await expect(import('../store/useStore')).resolves.toBeDefined();
  });
});
