import { useCallback, useEffect, useRef, useState } from "react";
import { unstable_batchedUpdates } from "react-native";

import { Rating } from "ts-fsrs";

import {
  completeStudySession,
  countCards,
  createStudySession,
  getDeck,
  getDeckStats,
  getTodayStudyCounts,
  listDueCardsPage,
  listNewCards,
  listUpcomingCards,
  logStudyResult,
} from "../db/deckRepositorySafe";
import type { Card } from "../types/models";
import { useStore } from "../store/useStore";
import { logger } from "../utils/logger";
import { applyRatedCardQueueUpdate } from "./useStudySession.utils";
import {
  getNewCardLimitForSession,
  mergeNewCardsIntoSession,
  selectDueCardsForSession,
} from "./useStudySession.planning";

const LEARNING_REQUEUE_WINDOW_MS = 30 * 60 * 1000;

type Options = Readonly<{
  deckId: string;
  dailyGoal: number;
  allowExtraNew: boolean;
}>;

type Tally = Readonly<{ again: number; hard: number; good: number; easy: number }>;

type RateOptions = Readonly<{
  onAfterRate?: () => void;
}>;

export function useStudySession(options: Options) {
  const userId = useStore((state) => state.userId);
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tally, setTally] = useState<Tally>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deckCardCount, setDeckCardCount] = useState(0);
  const [deckName, setDeckName] = useState<string | null>(null);
  const [nextReviewAt, setNextReviewAt] = useState<number | null>(null);
  const [isDeckFullyLearned, setIsDeckFullyLearned] = useState<boolean | null>(null);
  const [sessionDurationMs, setSessionDurationMs] = useState<number | null>(null);

  const cardsRef = useRef<Card[]>([]);
  const answeredCountRef = useRef(0);
  const sessionEndedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  const currentCard = cards[index];
  const nextCard = cards[index + 1];
  const hasGap = cards.length > 0 && !cards[index];
  const finished = !loading && (index >= cards.length || hasGap);

  const refreshDeckStats = useCallback(async () => {
    const result = await getDeckStats(options.deckId);
    if (result.isErr()) {
      logger.error('Failed to refresh deck stats:', result.error.message);
      return;
    }
    const stats = result.value;
    const unlearnedCount = stats.newCount + stats.learningCount + stats.relearningCount;
    setIsDeckFullyLearned(unlearnedCount === 0);
  }, [options.deckId]);

  const listDueCardsLimited = useCallback(
    async (dueCutoff: number, remainingGoal: number, allowExtra: boolean) => {
      const selected: Card[] = [];
      let remaining = remainingGoal;
      let cursor: { due: number; createdAt: number } | undefined;

      while (true) {
        const pageResult = await listDueCardsPage(options.deckId, { now: dueCutoff, cursor });
        if (pageResult.isErr()) {
          logger.error('Failed to list due cards:', pageResult.error.message);
          break;
        }
        const page = pageResult.value;
        if (!page.length) break;
        const selection = selectDueCardsForSession(page, remaining, allowExtra);
        selected.push(...selection.selected);
        remaining = selection.remainingGoal;
        const last = page[page.length - 1];
        cursor = { due: last.due, createdAt: last.createdAt };
      }
      return { selected, remaining };
    },
    [options.deckId],
  );

  const buildSessionCards = useCallback(async () => {
    const now = Date.now();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const dueCutoff = endOfToday.getTime();
    const [totalCountResult, todayCountsResult] = await Promise.all([
      countCards(options.deckId),
      getTodayStudyCounts(options.deckId, now),
    ]);

    if (totalCountResult.isErr()) {
      logger.error('Failed to count cards:', totalCountResult.error.message);
      return { limitedCards: [], totalCount: 0 };
    }

    if (todayCountsResult.isErr()) {
      logger.error('Failed to get today study counts:', todayCountsResult.error.message);
      return { limitedCards: [], totalCount: totalCountResult.value };
    }

    const totalCount = totalCountResult.value;
    const todayCounts = todayCountsResult.value;
    const remainingGoal = Math.max(0, options.dailyGoal - todayCounts.reviewCount);
    const { selected: limitedDue, remaining } = await listDueCardsLimited(dueCutoff, remainingGoal, options.allowExtraNew);
    const newCardLimit = getNewCardLimitForSession(remaining, options.dailyGoal, options.allowExtraNew);
    if (newCardLimit === 0) {
      return { limitedCards: limitedDue, totalCount };
    }

    const newCardsResult = await listNewCards(options.deckId, newCardLimit + limitedDue.length);
    if (newCardsResult.isErr()) {
      logger.error('Failed to list new cards:', newCardsResult.error.message);
      return { limitedCards: limitedDue, totalCount };
    }

    const limitedCards = mergeNewCardsIntoSession({
      dueCards: limitedDue,
      newCards: newCardsResult.value,
      remainingGoal: remaining,
      dailyGoal: options.dailyGoal,
      allowExtraNew: options.allowExtraNew,
    });
    return { limitedCards, totalCount };
  }, [listDueCardsLimited, options.allowExtraNew, options.dailyGoal, options.deckId]);

  const finalizeSession = useCallback(async () => {
    if (!sessionIdRef.current || sessionEndedRef.current) return;
    const now = Date.now();
    if (sessionStartRef.current) {
      setSessionDurationMs(now - sessionStartRef.current);
    }
    const result = await completeStudySession(sessionIdRef.current, userId);
    if (result.isErr()) {
      logger.error('Failed to complete study session:', result.error.message);
    }
    sessionEndedRef.current = true;
    sessionIdRef.current = null;
    sessionStartRef.current = null;
  }, [userId]);

  const startSession = useCallback(
    async (sourceCards: Card[]) => {
      await finalizeSession();
      const queue = sourceCards;
      setCards(queue);
      setIndex(0);
      setTotalCards(queue.length);
      setTally({ again: 0, hard: 0, good: 0, easy: 0 });
      answeredCountRef.current = 0;
      if (!queue.length) {
        setSessionId(null);
        sessionIdRef.current = null;
        sessionEndedRef.current = true;
        sessionStartRef.current = null;
        setSessionDurationMs(null);
        return;
      }
      const result = await createStudySession(options.deckId);
      if (result.isErr()) {
        logger.error('Failed to create study session:', result.error.message);
        setSessionId(null);
        sessionIdRef.current = null;
        sessionEndedRef.current = true;
        sessionStartRef.current = null;
        setSessionDurationMs(null);
        return;
      }
      const id = result.value;
      setSessionId(id);
      sessionIdRef.current = id;
      sessionEndedRef.current = false;
      sessionStartRef.current = Date.now();
      setSessionDurationMs(null);
    },
    [finalizeSession, options.deckId],
  );

  useEffect(() => {
    if (!finished) return;
    void finalizeSession();
    void refreshDeckStats();
  }, [finished, finalizeSession, refreshDeckStats]);

  useEffect(() => {
    return () => {
      void finalizeSession();
    };
  }, [finalizeSession]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const now = Date.now();
      const [deckResult, upcomingResult, session, statsResult] = await Promise.all([
        getDeck(options.deckId),
        listUpcomingCards(options.deckId, { now, limit: 1 }),
        buildSessionCards(),
        getDeckStats(options.deckId),
      ]);
      if (!active) return;

      if (deckResult.isErr()) {
        logger.error('Failed to get deck:', deckResult.error.message);
        setDeckName(null);
      } else {
        setDeckName(deckResult.value.name ?? null);
      }

      if (upcomingResult.isErr()) {
        logger.error('Failed to list upcoming cards:', upcomingResult.error.message);
        setNextReviewAt(null);
      } else {
        setNextReviewAt(upcomingResult.value[0]?.due ?? null);
      }

      cardsRef.current = session.limitedCards;
      setDeckCardCount(session.totalCount);

      if (statsResult.isErr()) {
        logger.error('Failed to get deck stats:', statsResult.error.message);
        setIsDeckFullyLearned(null);
      } else {
        const stats = statsResult.value;
        const unlearnedCount = stats.newCount + stats.learningCount + stats.relearningCount;
        setIsDeckFullyLearned(unlearnedCount === 0);
      }

      await startSession(session.limitedCards);
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [buildSessionCards, options.deckId, startSession]);

  const restartSession = useCallback(async () => {
    setLoading(true);
    const now = Date.now();
    const [session, upcomingResult] = await Promise.all([
      buildSessionCards(),
      listUpcomingCards(options.deckId, { now, limit: 1 }),
    ]);
    cardsRef.current = session.limitedCards;
    setDeckCardCount(session.totalCount);

    if (upcomingResult.isErr()) {
      logger.error('Failed to list upcoming cards:', upcomingResult.error.message);
      setNextReviewAt(null);
    } else {
      setNextReviewAt(upcomingResult.value[0]?.due ?? null);
    }

    await startSession(session.limitedCards);
    setLoading(false);
  }, [buildSessionCards, options.deckId, startSession]);

  const handleRate = useCallback(
    async (rating: Rating, rateOptions?: RateOptions) => {
      if (finished || !currentCard) return;
      setTally((prev) => ({
        again: prev.again + (rating === Rating.Again ? 1 : 0),
        hard: prev.hard + (rating === Rating.Hard ? 1 : 0),
        good: prev.good + (rating === Rating.Good ? 1 : 0),
        easy: prev.easy + (rating === Rating.Easy ? 1 : 0),
      }));

      const result = await logStudyResult({ card: currentCard, deckId: options.deckId, rating, sessionId, userId });
      if (result.isErr()) {
        logger.error('Failed to log study result:', result.error.message);
        return;
      }

      const updated = result.value;
      const now = Date.now();

      const nextIndex = index + 1;
      unstable_batchedUpdates(() => {
        setCards((prev) => {
          return applyRatedCardQueueUpdate(prev, index, updated, now, LEARNING_REQUEUE_WINDOW_MS).cards;
        });
        const queueUpdate = applyRatedCardQueueUpdate(cardsRef.current, index, updated, now, LEARNING_REQUEUE_WINDOW_MS);
        cardsRef.current = queueUpdate.cards;
        if (queueUpdate.requeued) {
          setTotalCards((prev) => prev + queueUpdate.totalCardsDelta);
        }
        setIndex(nextIndex);
        rateOptions?.onAfterRate?.();
      });

      answeredCountRef.current += 1;
      sessionEndedRef.current = false;
    },
    [currentCard, finished, index, options.deckId, sessionId, userId],
  );

  const updateCard = useCallback((cardId: string, updater: (card: Card) => Card) => {
    setCards((prev) => {
      const next = prev.map((card) => (card.id === cardId ? updater(card) : card));
      cardsRef.current = next;
      return next;
    });
  }, []);

  return {
    loading,
    sessionCards: cards,
    currentCard,
    nextCard,
    index,
    totalCards,
    tally,
    sessionId,
    deckName,
    nextReviewAt,
    deckCardCount,
    isDeckFullyLearned,
    sessionDurationMs,
    finished,
    handleRate,
    restartSession,
    finalizeSession,
    answeredCountRef,
    updateCard,
  };
}
