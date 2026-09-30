import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { initializeDatabase } from "../db/database";
import {
  addCards,
  createCard,
  createDeck,
  deleteCard,
  deleteDeck,
  getDeck,
  getDeckStats,
  listCards,
  listDecks,
  resetDeckProgress,
  touchDeckStudied,
  updateCard,
  updateDeck,
} from "../db/deckRepositorySafe";
import {
  LANGUAGE_STORAGE_KEY,
  INTRO_SEEN_STORAGE_KEY,
  FSRS_PARAMS_STORAGE_KEY,
  HAPTICS_ENABLED_STORAGE_KEY,
  DAILY_GOAL_STORAGE_KEY,
  DAILY_GOAL_ALLOW_EXTRA_STORAGE_KEY,
  TIME_GRADING_CONFIG_STORAGE_KEY,
} from "../constants";
import i18n from "../i18n";
import { buildFsrsDefaults, setFsrsParameters, getFsrsParameters } from "../services/fsrsScheduler";
import {
  DEFAULT_TIME_GRADING_CONFIG,
  normalizeTimeGradingConfig,
} from "../utils/timeGrading";
import { enqueueSyncOperation } from "../services/sync/sync-queue";
import type { StoreState } from "./useStore.types";
import { sortDecksForList, upsertDeckInList } from "./deck-store-utils";
import { logger } from "../utils/logger";
import { APP_CAPABILITIES } from "../config/app-mode";
import { sanitizeMarkdownImageTargets } from "../utils/markdown-media-sanitizer";

async function loadPreferredLanguage() {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored ?? null;
}

async function refreshDeckStatsInStore(
  set: (partial: StoreState | Partial<StoreState> | ((state: StoreState) => StoreState | Partial<StoreState>), replace?: false) => void,
  deckId: string,
): Promise<void> {
  const result = await getDeckStats(deckId);
  if (result.isErr()) {
    logger.error('Failed to refresh deck stats after mutation:', result.error.message);
    return;
  }

  set((state) => ({
    decks: sortDecksForList(
      state.decks.map((deck) =>
        deck.id === deckId
          ? {
              ...deck,
              cardCount: result.value.totalCount,
              dueCount: result.value.dueCount,
              newCount: result.value.newCount,
              learningCount: result.value.learningCount,
              reviewCount: result.value.reviewCount,
              relearningCount: result.value.relearningCount,
              retention: result.value.retention,
            }
          : deck
      )
    ),
  }));
}

function sanitizeCardMarkdownForPersistence(front: string, back: string) {
  return {
    front: sanitizeMarkdownImageTargets(front, APP_CAPABILITIES.remoteMedia),
    back: sanitizeMarkdownImageTargets(back, APP_CAPABILITIES.remoteMedia),
  };
}

export const useStore = create<StoreState>((set, get) => ({
  initialized: false,
  language: "en",
  introSeen: false,
  userId: null,
  decks: [],
  fsrsParams: {},
  studySyncToken: 0,
  hapticsEnabled: true,
  dailyGoal: 50,
  allowExtraNew: false,
  timeGradingConfig: DEFAULT_TIME_GRADING_CONFIG,

  initialize: async (preferredLanguage) => {
    await initializeDatabase();
    const storedLanguage = preferredLanguage ?? (await loadPreferredLanguage()) ?? "en";
    set({ language: storedLanguage });
    const storedIntroSeen = await AsyncStorage.getItem(INTRO_SEEN_STORAGE_KEY);
    if (storedIntroSeen !== null) {
      set({ introSeen: storedIntroSeen === "true" });
    }
    const storedHaptics = await AsyncStorage.getItem(HAPTICS_ENABLED_STORAGE_KEY);
    if (storedHaptics !== null) {
      set({ hapticsEnabled: storedHaptics === "true" });
    }
    const storedDailyGoal = await AsyncStorage.getItem(DAILY_GOAL_STORAGE_KEY);
    if (storedDailyGoal !== null) {
      const parsedGoal = Number(storedDailyGoal);
      if (!Number.isNaN(parsedGoal) && parsedGoal > 0) {
        set({ dailyGoal: parsedGoal });
      }
    }
    const storedAllowExtra = await AsyncStorage.getItem(DAILY_GOAL_ALLOW_EXTRA_STORAGE_KEY);
    if (storedAllowExtra !== null) {
      set({ allowExtraNew: storedAllowExtra === "true" });
    }
    const storedTimeGradingConfig = await AsyncStorage.getItem(TIME_GRADING_CONFIG_STORAGE_KEY);
    if (storedTimeGradingConfig) {
      try {
        const parsed = JSON.parse(storedTimeGradingConfig);
        set({ timeGradingConfig: normalizeTimeGradingConfig(parsed) });
      } catch {
        set({ timeGradingConfig: DEFAULT_TIME_GRADING_CONFIG });
      }
    } else {
      set({ timeGradingConfig: DEFAULT_TIME_GRADING_CONFIG });
    }
    const storedParamsRaw = await AsyncStorage.getItem(FSRS_PARAMS_STORAGE_KEY);
    if (storedParamsRaw) {
      try {
        const parsed = JSON.parse(storedParamsRaw);
        setFsrsParameters(parsed);
        set({ fsrsParams: parsed });
      } catch {
        // ignore corrupted state
      }
    } else {
      set({ fsrsParams: getFsrsParameters() });
    }
    await get().refreshDecks();
    set({ initialized: true });
  },

  refreshDecks: async () => {
    const result = await listDecks();
    if (result.isErr()) {
      logger.error('Failed to refresh decks:', result.error.message);
      return;
    }

    let nextDecks = result.value;
    const currentUserId = get().userId;

    if (nextDecks.length === 0 && currentUserId) {
      const { hydrateDecksFromApi } = await import('./deck-store-hydration');
      const hydrated = await hydrateDecksFromApi(currentUserId);
      if (hydrated) {
        const refreshedResult = await listDecks();
        if (refreshedResult.isOk()) {
          nextDecks = refreshedResult.value;
        } else {
          logger.error('Failed to refresh decks after bootstrap:', refreshedResult.error.message);
        }
      }
    }

    set({ decks: nextDecks });
  },

  refreshDeckById: async (deckId) => {
    let result = await getDeck(deckId);
    if (result.isErr()) {
      const currentUserId = get().userId;
      if (currentUserId) {
        const { hydrateDecksFromApi } = await import('./deck-store-hydration');
        const hydrated = await hydrateDecksFromApi(currentUserId);
        if (hydrated) {
          result = await getDeck(deckId);
        }
      }
    }

    if (result.isErr()) {
      logger.error('Failed to refresh deck by id:', result.error.message);
      return;
    }

    const statsResult = await getDeckStats(deckId);
    if (statsResult.isErr()) {
      logger.error('Failed to refresh deck stats by id:', statsResult.error.message);
      return;
    }

    const { cards: _cards, ...deckRow } = result.value;
    const deck = {
      ...deckRow,
      cardCount: statsResult.value.totalCount,
      dueCount: statsResult.value.dueCount,
      newCount: statsResult.value.newCount,
      learningCount: statsResult.value.learningCount,
      reviewCount: statsResult.value.reviewCount,
      relearningCount: statsResult.value.relearningCount,
      retention: statsResult.value.retention,
    };
    set((state) => ({
      decks: upsertDeckInList(state.decks, deck),
    }));
  },

  addDeck: async (name, description = "", accentKey, materialType, deckType, locale) => {
    const result = await createDeck({ name, description, accentKey, materialType, deckType, locale });
    if (result.isErr()) {
      logger.error('Failed to add deck:', result.error.message);
      throw result.error;
    }
    set((state) => ({
      decks: upsertDeckInList(state.decks, result.value),
    }));

    // Queue sync for the new deck
    await get().queueSync('deck', result.value.id, 'create', {
      id: result.value.id,
      name,
      description,
      accentKey,
      materialType,
      deckType,
      locale,
      visibility: 'private',
      createdAt: new Date(result.value.createdAt).toISOString(),
      updatedAt: new Date(result.value.updatedAt).toISOString(),
      lastStudiedAt: result.value.lastStudiedAt ? new Date(result.value.lastStudiedAt).toISOString() : null,
      clientUpdatedAt: new Date(result.value.updatedAt).toISOString(),
    });

    return result.value.id;
  },

  removeDeck: async (deckId) => {
    const result = await deleteDeck(deckId);
    if (result.isErr()) {
      logger.error('Failed to remove deck:', result.error.message);
      throw result.error;
    }
    set({ decks: get().decks.filter((deck) => deck.id !== deckId) });

    // Queue sync for deck deletion
    await get().queueSync('deck', deckId, 'delete', {
      id: deckId,
      clientUpdatedAt: new Date().toISOString(),
    });
  },

  saveDeckDetails: async (deckId, updates) => {
    const normalizedUpdates = {
      ...updates,
      accentKey: updates.accentKey ?? undefined,
    };

    const result = await updateDeck(deckId, normalizedUpdates);
    if (result.isErr()) {
      logger.error('Failed to save deck details:', result.error.message);
      throw result.error;
    }
    set((state) => ({
      decks: upsertDeckInList(state.decks, result.value),
    }));

    // Queue sync for deck update
    await get().queueSync('deck', deckId, 'update', {
      id: deckId,
      ...normalizedUpdates,
      updatedAt: new Date(result.value.updatedAt).toISOString(),
      clientUpdatedAt: new Date(result.value.updatedAt).toISOString(),
    });
  },

  setLanguage: async (code) => {
    set({ language: code });
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    if (i18n.isInitialized) {
      await i18n.changeLanguage(code);
    }
  },
  setIntroSeen: async (seen) => {
    set({ introSeen: seen });
    if (seen) {
      await AsyncStorage.setItem(INTRO_SEEN_STORAGE_KEY, "true");
    } else {
      await AsyncStorage.removeItem(INTRO_SEEN_STORAGE_KEY);
    }
  },

  loadCards: async (deckId) => {
    const result = await listCards(deckId);
    if (result.isErr()) {
      logger.error('Failed to load cards:', result.error.message);
      return [];
    }
    return result.value;
  },

  saveCard: async (deckId, payload) => {
    const cardMarkdown = sanitizeCardMarkdownForPersistence(payload.front, payload.back);

    if (payload.cardId) {
      const result = await updateCard(payload.cardId, {
        front: cardMarkdown.front,
        back: cardMarkdown.back,
        imageUrl: payload.imageUrl ?? null,
        audioUrl: payload.audioUrl ?? null,
        category: payload.category ?? null,
        pos: payload.pos ?? null,
        gender: payload.gender,
        example: payload.example ?? null,
        tags: payload.tags ?? [],
      });
      if (result.isErr()) {
        logger.error('Failed to update card:', result.error.message);
        throw result.error;
      }

      // Queue sync for card update
      await get().queueSync('card', payload.cardId, 'update', {
        id: payload.cardId,
        deckId,
        front: cardMarkdown.front,
        back: cardMarkdown.back,
        imageUrl: payload.imageUrl,
        audioUrl: payload.audioUrl,
        category: payload.category,
        pos: payload.pos,
        gender: payload.gender,
        example: payload.example,
        tags: payload.tags,
        createdAt: new Date(result.value.createdAt).toISOString(),
        updatedAt: new Date(result.value.updatedAt).toISOString(),
        lastReviewedAt: result.value.lastReviewedAt ? new Date(result.value.lastReviewedAt).toISOString() : null,
        due: result.value.due ? new Date(result.value.due).toISOString() : null,
        stability: result.value.stability,
        difficulty: result.value.difficulty,
        elapsed_days: result.value.elapsed_days,
        scheduled_days: result.value.scheduled_days,
        learning_steps: result.value.learning_steps,
        reps: result.value.reps,
        lapses: result.value.lapses,
        state: result.value.state,
        learnState: result.value.learnState,
        learnCorrectStreak: result.value.learnCorrectStreak,
        learnCorrectTotal: result.value.learnCorrectTotal,
        learnIncorrectTotal: result.value.learnIncorrectTotal,
        learnLastAnsweredAt: result.value.learnLastAnsweredAt ? new Date(result.value.learnLastAnsweredAt).toISOString() : null,
        clientUpdatedAt: new Date(result.value.updatedAt).toISOString(),
      });

      return payload.cardId;
    }
    const result = await createCard(deckId, {
      front: cardMarkdown.front,
      back: cardMarkdown.back,
      imageUrl: payload.imageUrl ?? undefined,
      audioUrl: payload.audioUrl ?? undefined,
      category: payload.category ?? undefined,
      pos: payload.pos ?? undefined,
      gender: payload.gender ?? undefined,
      example: payload.example ?? undefined,
      tags: payload.tags ?? [],
    });
    if (result.isErr()) {
      logger.error('Failed to create card:', result.error.message);
      throw result.error;
    }

    const now = Date.now();
    const defaults = buildFsrsDefaults(now);

    // Queue sync for card creation
    await get().queueSync('card', result.value, 'create', {
      id: result.value,
      deckId,
      front: cardMarkdown.front,
      back: cardMarkdown.back,
      imageUrl: payload.imageUrl,
      audioUrl: payload.audioUrl,
      category: payload.category,
      pos: payload.pos,
      gender: payload.gender,
      example: payload.example,
      tags: payload.tags,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      lastReviewedAt: defaults.lastReviewedAt ? new Date(defaults.lastReviewedAt).toISOString() : null,
      due: new Date(defaults.due).toISOString(),
      stability: defaults.stability,
      difficulty: defaults.difficulty,
      elapsed_days: defaults.elapsed_days,
      scheduled_days: defaults.scheduled_days,
      learning_steps: defaults.learning_steps,
      reps: defaults.reps,
      lapses: defaults.lapses,
      state: defaults.state,
      learnState: 'not_studied',
      learnCorrectStreak: 0,
      learnCorrectTotal: 0,
      learnIncorrectTotal: 0,
      learnLastAnsweredAt: null,
      clientUpdatedAt: new Date(now).toISOString(),
    });

    return result.value;
  },

  removeCard: async (cardId, deckId) => {
    const result = await deleteCard(cardId);
    if (result.isErr()) {
      logger.error('Failed to remove card:', result.error.message);
      throw result.error;
    }
    await refreshDeckStatsInStore(set, deckId);

    // Queue sync for card deletion
    await get().queueSync('card', cardId, 'delete', {
      id: cardId,
      deckId,
      clientUpdatedAt: new Date().toISOString(),
    });

    // reload cards is handled by screen when needed
  },

  recordStudy: async (deckId) => {
    const result = await touchDeckStudied(deckId);
    if (result.isErr()) {
      logger.error('Failed to record study:', result.error.message);
    }
    const now = new Date();
    set((state) => ({
      decks: sortDecksForList(
        state.decks.map((deck) =>
          deck.id === deckId
            ? {
                ...deck,
                lastStudiedAt: now.getTime(),
                updatedAt: now.getTime(),
              }
            : deck
        )
      ),
    }));
    await get().queueSync('deck', deckId, 'update', {
      id: deckId,
      lastStudiedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      clientUpdatedAt: now.toISOString(),
    });
    set({ studySyncToken: Date.now() });
  },

  bulkAddCards: async (deckId, cards) => {
    const sanitizedCards = cards.map((card) => ({
      ...card,
      ...sanitizeCardMarkdownForPersistence(card.front, card.back),
    }));
    const result = await addCards(deckId, sanitizedCards);
    if (result.isErr()) {
      logger.error('Failed to add cards:', result.error.message);
      throw result.error;
    }
    await Promise.all(
      result.value.map((card) =>
        get().queueSync('card', card.id, 'create', {
          id: card.id,
          deckId,
          front: card.front,
          back: card.back,
          imageUrl: card.imageUrl,
          audioUrl: card.audioUrl,
          category: card.category,
          pos: card.pos,
          gender: card.gender,
          example: card.example,
          tags: card.tags,
          createdAt: new Date(card.createdAt).toISOString(),
          updatedAt: new Date(card.updatedAt).toISOString(),
          lastReviewedAt: card.lastReviewedAt ? new Date(card.lastReviewedAt).toISOString() : null,
          due: card.due ? new Date(card.due).toISOString() : null,
          stability: card.stability,
          difficulty: card.difficulty,
          elapsed_days: card.elapsed_days,
          scheduled_days: card.scheduled_days,
          learning_steps: card.learning_steps,
          reps: card.reps,
          lapses: card.lapses,
          state: card.state,
          learnState: card.learnState,
          learnCorrectStreak: card.learnCorrectStreak,
          learnCorrectTotal: card.learnCorrectTotal,
          learnIncorrectTotal: card.learnIncorrectTotal,
          learnLastAnsweredAt: card.learnLastAnsweredAt ? new Date(card.learnLastAnsweredAt).toISOString() : null,
          clientUpdatedAt: new Date(card.updatedAt).toISOString(),
        })
      )
    );
    await refreshDeckStatsInStore(set, deckId);
  },

  resetProgress: async (deckId) => {
    const result = await resetDeckProgress(deckId);
    if (result.isErr()) {
      logger.error('Failed to reset progress:', result.error.message);
      throw result.error;
    }
    await refreshDeckStatsInStore(set, deckId);
  },

  setFsrsParams: async (params) => {
    setFsrsParameters(params);
    set({ fsrsParams: params });
    await AsyncStorage.setItem(FSRS_PARAMS_STORAGE_KEY, JSON.stringify(params));
  },

  setHapticsEnabled: async (enabled) => {
    set({ hapticsEnabled: enabled });
    await AsyncStorage.setItem(HAPTICS_ENABLED_STORAGE_KEY, String(enabled));
  },

  setDailyGoal: async (goal) => {
    const sanitized = Math.max(1, Math.round(goal));
    set({ dailyGoal: sanitized });
    await AsyncStorage.setItem(DAILY_GOAL_STORAGE_KEY, String(sanitized));
  },

  setAllowExtraNew: async (enabled) => {
    set({ allowExtraNew: enabled });
    await AsyncStorage.setItem(DAILY_GOAL_ALLOW_EXTRA_STORAGE_KEY, String(enabled));
  },

  setTimeGradingConfig: async (config) => {
    const next = normalizeTimeGradingConfig({ ...get().timeGradingConfig, ...config });
    set({ timeGradingConfig: next });
    await AsyncStorage.setItem(TIME_GRADING_CONFIG_STORAGE_KEY, JSON.stringify(next));
  },

  setUserId: (userId) => {
    set({ userId });
  },

  clearDecks: () => {
    set({ decks: [] });
  },

  setDeckVisibility: async (deckId, visibility) => {
    const result = await updateDeck(deckId, { visibility });
    if (result.isErr()) {
      logger.error('Failed to update deck visibility:', result.error.message);
      throw result.error;
    }
    set((state) => ({
      decks: upsertDeckInList(state.decks, result.value),
    }));

    // Queue sync for deck visibility update
    await get().queueSync('deck', deckId, 'update', {
      id: deckId,
      visibility,
      updatedAt: new Date(result.value.updatedAt).toISOString(),
      clientUpdatedAt: new Date(result.value.updatedAt).toISOString(),
    });
  },

  queueSync: async (entityType, entityId, operation, data) => {
    try {
      const currentUserId = get().userId ?? null;
      await enqueueSyncOperation({ entityType, entityId, operation, data, userId: currentUserId });
    } catch (error) {
      logger.error('[Sync] Failed to queue operation:', error);
    }
  },
}));
