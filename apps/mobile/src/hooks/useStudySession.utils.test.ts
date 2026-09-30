import { describe, expect, it } from 'vitest';
import type { Card } from '../types/models';
import { applyRatedCardQueueUpdate, insertCardByDue, replaceCardAtIndex, shouldRequeueCard } from './useStudySession.utils';

function createCard(id: string, due: number, createdAt: number): Card {
  return {
    id,
    deckId: 'deck-1',
    front: `front-${id}`,
    back: `back-${id}`,
    createdAt,
    updatedAt: createdAt,
    due,
    stability: 1,
    difficulty: 1,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
  };
}

describe('useStudySession utils', () => {
  it('replaceCardAtIndex replaces a card in bounds', () => {
    const first = createCard('a', 100, 1);
    const second = createCard('b', 200, 2);
    const updated = createCard('b2', 250, 2);

    const next = replaceCardAtIndex([first, second], 1, updated);

    expect(next[0]?.id).toBe('a');
    expect(next[1]?.id).toBe('b2');
  });

  it('replaceCardAtIndex returns same reference when out of bounds', () => {
    const cards = [createCard('a', 100, 1)];
    const next = replaceCardAtIndex(cards, 4, createCard('b', 200, 2));
    expect(next).toBe(cards);
  });

  it('insertCardByDue inserts after current index and sorts by due then createdAt', () => {
    const current = createCard('current', 100, 10);
    const later = createCard('later', 500, 30);
    const tieLaterCreated = createCard('tie-late', 300, 50);
    const tieEarlierCreated = createCard('tie-early', 300, 20);

    const next = insertCardByDue([current, tieLaterCreated, later], tieEarlierCreated, 0);

    expect(next.map((card) => card.id)).toEqual(['current', 'tie-early', 'tie-late', 'later']);
  });

  it('shouldRequeueCard only requeues learning/relearning cards inside the window', () => {
    const now = 1_000;
    const learningSoon = { ...createCard('l', now + 100, 1), state: 'learning' as const };
    const reviewSoon = { ...createCard('r', now + 100, 2), state: 'review' as const };
    const learningLater = { ...createCard('ll', now + 10_000, 3), state: 'learning' as const };

    expect(shouldRequeueCard(learningSoon, now, 5_000)).toBe(true);
    expect(shouldRequeueCard(reviewSoon, now, 5_000)).toBe(false);
    expect(shouldRequeueCard(learningLater, now, 5_000)).toBe(false);
  });

  it('applyRatedCardQueueUpdate requeues learning cards and reports total delta', () => {
    const now = 1_000;
    const current = createCard('current', 900, 1);
    const future = createCard('future', 2_000, 2);
    const updated = { ...current, due: 1_200, state: 'learning' as const };

    const result = applyRatedCardQueueUpdate([current, future], 0, updated, now, 5_000);

    expect(result.requeued).toBe(true);
    expect(result.totalCardsDelta).toBe(1);
    expect(result.cards.map((card) => card.id)).toEqual(['current', 'current', 'future']);
    expect(result.cards[1]?.due).toBe(1_200);
  });

  it('applyRatedCardQueueUpdate only replaces card when requeue is not needed', () => {
    const now = 1_000;
    const current = createCard('current', 900, 1);
    const future = createCard('future', 2_000, 2);
    const updated = { ...current, due: 10_000, state: 'review' as const };

    const result = applyRatedCardQueueUpdate([current, future], 0, updated, now, 5_000);

    expect(result.requeued).toBe(false);
    expect(result.totalCardsDelta).toBe(0);
    expect(result.cards.map((card) => card.id)).toEqual(['current', 'future']);
    expect(result.cards[0]?.due).toBe(10_000);
  });
});
