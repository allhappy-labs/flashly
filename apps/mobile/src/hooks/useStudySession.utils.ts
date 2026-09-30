import type { Card } from "../types/models";

export function replaceCardAtIndex(cards: Card[], targetIndex: number, updated: Card) {
  if (targetIndex < 0 || targetIndex >= cards.length) {
    return cards;
  }
  const next = [...cards];
  next[targetIndex] = updated;
  return next;
}

export function insertCardByDue(cards: Card[], updated: Card, startIndex: number) {
  if (!cards.length) {
    return [updated];
  }
  const insertFrom = Math.min(startIndex + 1, cards.length);
  let insertIndex = cards.length;
  for (let index = insertFrom; index < cards.length; index += 1) {
    const candidate = cards[index];
    if (updated.due < candidate.due || (updated.due === candidate.due && updated.createdAt < candidate.createdAt)) {
      insertIndex = index;
      break;
    }
  }
  const next = [...cards];
  next.splice(insertIndex, 0, updated);
  return next;
}

export function shouldRequeueCard(updated: Card, now: number, requeueWindowMs: number) {
  return (
    (updated.state === "learning" || updated.state === "relearning") &&
    updated.due - now < requeueWindowMs
  );
}

export function applyRatedCardQueueUpdate(
  cards: Card[],
  targetIndex: number,
  updated: Card,
  now: number,
  requeueWindowMs: number,
) {
  const replaced = replaceCardAtIndex(cards, targetIndex, updated);
  const requeued = shouldRequeueCard(updated, now, requeueWindowMs);

  if (!requeued) {
    return {
      cards: replaced,
      requeued: false,
      totalCardsDelta: 0,
    };
  }

  return {
    cards: insertCardByDue(replaced, updated, targetIndex),
    requeued: true,
    totalCardsDelta: 1,
  };
}
