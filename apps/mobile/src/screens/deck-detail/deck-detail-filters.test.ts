import { describe, expect, it } from "vitest";
import type { Card } from "../../types/models";
import { filterDeckCards, listDeckCategories, listDeckTags } from "./deck-detail-filters";

function createCard(id: string, overrides: Partial<Card> = {}): Card {
  return {
    id,
    deckId: "deck-1",
    front: `front-${id}`,
    back: `back-${id}`,
    createdAt: 1,
    updatedAt: 1,
    due: 1,
    stability: 1,
    difficulty: 1,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: "new",
    ...overrides,
  };
}

describe("deck-detail-filters", () => {
  it("lists unique categories and ignores empty values", () => {
    const cards = [
      createCard("a", { category: "verbs" }),
      createCard("b", { category: "verbs" }),
      createCard("c", { category: "nouns" }),
      createCard("d", { category: "" }),
      createCard("e", { category: null }),
    ];

    expect(listDeckCategories(cards)).toEqual(["verbs", "nouns"]);
  });

  it("lists unique tags across cards", () => {
    const cards = [
      createCard("a", { tags: ["easy", "daily"] }),
      createCard("b", { tags: ["daily", "travel"] }),
      createCard("c", { tags: [] }),
    ];

    expect(listDeckTags(cards)).toEqual(["easy", "daily", "travel"]);
  });

  it("filters by category and all selected tags", () => {
    const cards = [
      createCard("a", { category: "verbs", tags: ["daily", "easy"] }),
      createCard("b", { category: "verbs", tags: ["daily"] }),
      createCard("c", { category: "nouns", tags: ["daily", "easy"] }),
    ];

    const filtered = filterDeckCards(cards, "verbs", ["daily", "easy"]);

    expect(filtered.map((card) => card.id)).toEqual(["a"]);
  });
});
