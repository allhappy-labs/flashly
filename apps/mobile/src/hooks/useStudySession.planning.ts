import type { Card } from "../types/models";

type DueSelectionResult = Readonly<{
  selected: Card[];
  remainingGoal: number;
}>;

type MergeNewCardsOptions = Readonly<{
  dueCards: Card[];
  newCards: Card[];
  remainingGoal: number;
  dailyGoal: number;
  allowExtraNew: boolean;
}>;

export function selectDueCardsForSession(
  dueCards: Card[],
  remainingGoal: number,
  allowExtraNew: boolean,
): DueSelectionResult {
  const selected: Card[] = [];
  let remaining = remainingGoal;

  for (const card of dueCards) {
    if (card.state === "new") {
      if (!allowExtraNew && remaining <= 0) {
        continue;
      }
    }

    selected.push(card);

    if (!allowExtraNew && remaining > 0) {
      remaining -= 1;
    }
  }

  return { selected, remainingGoal: remaining };
}

export function getNewCardLimitForSession(
  remainingGoal: number,
  dailyGoal: number,
  allowExtraNew: boolean,
): number {
  let limit = Math.max(0, remainingGoal);
  if (allowExtraNew && limit === 0) {
    limit = dailyGoal;
  }
  return Math.max(0, limit);
}

export function mergeNewCardsIntoSession(options: MergeNewCardsOptions): Card[] {
  const newCardLimit = getNewCardLimitForSession(
    options.remainingGoal,
    options.dailyGoal,
    options.allowExtraNew,
  );

  if (newCardLimit === 0) {
    return options.dueCards;
  }

  const dueCardIds = new Set(options.dueCards.map((card) => card.id));
  const extraNewCards = options.newCards
    .filter((card) => !dueCardIds.has(card.id))
    .slice(0, newCardLimit);

  return [...options.dueCards, ...extraNewCards];
}
