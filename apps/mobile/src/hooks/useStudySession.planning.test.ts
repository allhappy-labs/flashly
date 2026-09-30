import { describe, expect, it } from "vitest";
import type { Card } from "../types/models";
import {
  getNewCardLimitForSession,
  mergeNewCardsIntoSession,
  selectDueCardsForSession,
} from "./useStudySession.planning";

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

describe("useStudySession planning", () => {
  it("selects due cards while respecting goal limit for new cards", () => {
    const dueCards = [
      createCard("new-1", { state: "new" }),
      createCard("review-1", { state: "review" }),
      createCard("new-2", { state: "new" }),
    ];

    const selection = selectDueCardsForSession(dueCards, 1, false);

    expect(selection.selected.map((card) => card.id)).toEqual(["new-1", "review-1"]);
    expect(selection.remainingGoal).toBe(0);
  });

  it("allows all due cards when extra new cards are enabled", () => {
    const dueCards = [
      createCard("new-1", { state: "new" }),
      createCard("review-1", { state: "review" }),
      createCard("new-2", { state: "new" }),
    ];

    const selection = selectDueCardsForSession(dueCards, 0, true);

    expect(selection.selected.map((card) => card.id)).toEqual(["new-1", "review-1", "new-2"]);
    expect(selection.remainingGoal).toBe(0);
  });

  it("computes new-card limit from goal and extra-new setting", () => {
    expect(getNewCardLimitForSession(3, 50, false)).toBe(3);
    expect(getNewCardLimitForSession(0, 50, false)).toBe(0);
    expect(getNewCardLimitForSession(0, 5, true)).toBe(5);
  });

  it("merges due and new cards without duplicates and respects limit", () => {
    const dueCards = [createCard("a", { state: "review" }), createCard("b", { state: "learning" })];
    const newCards = [createCard("b"), createCard("c"), createCard("d"), createCard("e")];

    const merged = mergeNewCardsIntoSession({
      dueCards,
      newCards,
      remainingGoal: 2,
      dailyGoal: 10,
      allowExtraNew: false,
    });

    expect(merged.map((card) => card.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("uses daily goal as fallback new-card limit when extra-new is enabled", () => {
    const merged = mergeNewCardsIntoSession({
      dueCards: [],
      newCards: [createCard("n1"), createCard("n2"), createCard("n3")],
      remainingGoal: 0,
      dailyGoal: 2,
      allowExtraNew: true,
    });

    expect(merged.map((card) => card.id)).toEqual(["n1", "n2"]);
  });
});
