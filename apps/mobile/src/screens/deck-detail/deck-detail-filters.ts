import type { Card } from "../../types/models";

export function listDeckCategories(cards: Card[]): string[] {
  return Array.from(
    new Set(cards.map((card) => card.category).filter((category): category is string => Boolean(category)))
  );
}

export function listDeckTags(cards: Card[]): string[] {
  return Array.from(new Set(cards.flatMap((card) => card.tags ?? []).filter((tag) => tag)));
}

export function filterDeckCards(
  cards: Card[],
  categoryFilter: string | null,
  tagFilters: string[],
): Card[] {
  return cards.filter((card) => {
    const matchesCategory = categoryFilter ? card.category === categoryFilter : true;
    const matchesTags = tagFilters.length
      ? tagFilters.every((tag) => (card.tags ?? []).includes(tag))
      : true;
    return matchesCategory && matchesTags;
  });
}
