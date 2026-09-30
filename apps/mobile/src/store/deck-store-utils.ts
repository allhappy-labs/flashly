import type { DeckWithStats } from "../types/models";

export function sortDecksForList(decks: DeckWithStats[]): DeckWithStats[] {
  return [...decks].sort((left, right) => {
    const leftLastStudied = left.lastStudiedAt ?? 0;
    const rightLastStudied = right.lastStudiedAt ?? 0;
    if (leftLastStudied !== rightLastStudied) {
      return rightLastStudied - leftLastStudied;
    }
    return left.createdAt - right.createdAt;
  });
}

export function upsertDeckInList(decks: DeckWithStats[], nextDeck: DeckWithStats): DeckWithStats[] {
  const existingIndex = decks.findIndex((deck) => deck.id === nextDeck.id);
  if (existingIndex < 0) {
    return sortDecksForList([...decks, nextDeck]);
  }

  const next = [...decks];
  next[existingIndex] = nextDeck;
  return sortDecksForList(next);
}

