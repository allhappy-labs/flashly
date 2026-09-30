import { describe, expect, it } from "vitest";
import type { Card } from "../../types/models";
import type { LearnOptions } from "../../types/learn";
import {
  advanceLearnQueue,
  buildInitialLearnQueue,
  buildLearnQuestion,
  consumeScheduledLearnQuestionType,
  getLearnAnswerPool,
  pickLearnQuestionType,
  seedPendingLearnQuestionTypes,
} from "./learn-mode-utils";

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
    learnState: "not_studied",
    ...overrides,
  };
}

function createOptions(overrides: Partial<LearnOptions> = {}): LearnOptions {
  return {
    goal: "memorize",
    familiarity: "new",
    questionTypes: ["multiple_choice", "written"],
    grading: "smart",
    retypeAfterMiss: true,
    direction: "term",
    scope: "all",
    starredOnly: false,
    formatPreset: "QA",
    ...overrides,
  };
}

const noShuffle = () => 0.999999;

describe("learn-mode-utils", () => {
  it("buildLearnQuestion builds cloze prompt when format is Cloze and example exists", () => {
    const card = createCard("1", { front: "bonjour", back: "hello", example: "Je dis bonjour" });
    const question = buildLearnQuestion(card, createOptions({ formatPreset: "Cloze" }), "written", false);

    expect(question.directionLabel).toBe("cloze");
    expect(question.answer).toBe("bonjour");
    expect(question.prompt).toContain("_____");
  });

  it("buildLearnQuestion respects mixed direction preference", () => {
    const card = createCard("1", { front: "term", back: "definition" });
    const options = createOptions({ formatPreset: "Mixed", direction: "definition" });

    const termQuestion = buildLearnQuestion(card, options, "written", true);
    const definitionQuestion = buildLearnQuestion(card, options, "written", false);

    expect(termQuestion.directionLabel).toBe("term");
    expect(termQuestion.prompt).toBe("definition");
    expect(definitionQuestion.directionLabel).toBe("definition");
    expect(definitionQuestion.prompt).toBe("term");
  });

  it("uses curated multiple choice enrichment for a Learn question", () => {
    const card = createCard("1", {
      front: "France",
      back: "Paris",
      quiz: {
        prompt: "Which city has the Eiffel Tower?",
        options: ["Paris", "Rome", "Berlin"],
        correctAnswer: "Paris",
        explanation: "The Eiffel Tower is in Paris.",
      },
    });

    const question = buildLearnQuestion(
      card,
      createOptions(),
      "multiple_choice",
      false,
      ["Lyon", "Marseille"],
      noShuffle,
    );

    expect(question).toEqual({
      prompt: "Which city has the Eiffel Tower?",
      answer: "Paris",
      directionLabel: "term",
      type: "multiple_choice",
      scheduledType: "multiple_choice",
      answerSide: "front",
      options: ["Paris", "Rome", "Berlin"],
      explanation: "The Eiffel Tower is in Paris.",
      source: "curated",
    });
  });

  it("uses deck-derived choices when a Learn card has no enrichment", () => {
    const card = createCard("1", { front: "France", back: "Paris" });

    const question = buildLearnQuestion(
      card,
      createOptions(),
      "multiple_choice",
      false,
      ["Lyon", "Marseille"],
      noShuffle,
    );

    expect(question).toEqual({
      prompt: "Paris",
      answer: "France",
      directionLabel: "term",
      type: "multiple_choice",
      scheduledType: "multiple_choice",
      answerSide: "front",
      options: ["France", "Lyon", "Marseille"],
      source: "generic",
    });
    expect(question).not.toHaveProperty("explanation");
  });

  it("changes an unanswerable Learn multiple choice question to written", () => {
    const card = createCard("1", { front: "France", back: "Paris" });

    const question = buildLearnQuestion(card, createOptions(), "multiple_choice", false, ["France"], noShuffle);

    expect(question).toMatchObject({
      prompt: "Paris",
      answer: "France",
      directionLabel: "term",
      type: "written",
    });
    expect(question).not.toHaveProperty("options");
  });

  it("consumes the scheduled multiple choice type after a written fallback", () => {
    const card = createCard("1", { front: "France", back: "Paris" });
    const question = buildLearnQuestion(card, createOptions(), "multiple_choice", false, ["France"], noShuffle);

    expect(question.type).toBe("written");
    expect(question.scheduledType).toBe("multiple_choice");
    expect(
      consumeScheduledLearnQuestionType(["multiple_choice", "written"], question.scheduledType),
    ).toEqual(["written"]);
  });

  it("advances a repeated card to its remaining scheduled question", () => {
    const card = createCard("1", { front: "France", back: "Paris" });
    const firstQuestion = buildLearnQuestion(card, createOptions(), "multiple_choice", false, [], noShuffle);
    const remainingTypes = consumeScheduledLearnQuestionType(
      ["multiple_choice", "written"],
      firstQuestion.scheduledType,
    );

    expect(firstQuestion.type).toBe("written");
    expect(
      advanceLearnQueue({
        queue: [card.id],
        currentId: card.id,
        shouldRepeat: true,
        questionAttempt: 0,
      }),
    ).toEqual({
      queue: [card.id],
      currentId: card.id,
      questionAttempt: 1,
    });

    const secondQuestion = buildLearnQuestion(card, createOptions(), remainingTypes[0] ?? "written", false);

    expect(secondQuestion.scheduledType).toBe("written");
    expect(consumeScheduledLearnQuestionType(remainingTypes, secondQuestion.scheduledType)).toEqual([]);
  });

  it("uses front-side distractors for a cloze question", () => {
    const card = createCard("one", {
      front: "bonjour",
      back: "hello",
      example: "Je dis bonjour",
    });
    const question = buildLearnQuestion(card, createOptions({ formatPreset: "Cloze" }), "multiple_choice", false);
    const cards = [
      card,
      createCard("two", { front: "salut", back: "hi" }),
      createCard("three", { front: "au revoir", back: "goodbye" }),
    ];

    expect(question.answerSide).toBe("front");
    expect(getLearnAnswerPool(cards, card.id, question.answerSide)).toEqual(["salut", "au revoir"]);
  });

  it("pickLearnQuestionType selects deterministically from multiple types", () => {
    const options = createOptions({ questionTypes: ["multiple_choice", "written"] });
    expect(pickLearnQuestionType(options, () => 0)).toBe("multiple_choice");
    expect(pickLearnQuestionType(options, () => 0.99)).toBe("written");
  });

  it("buildInitialLearnQueue prioritizes not_studied for familiarity=some", () => {
    const cards = [
      createCard("a", { learnState: "learning" }),
      createCard("b", { learnState: "not_studied" }),
      createCard("c", { learnState: "mastered" }),
    ];

    expect(buildInitialLearnQueue(cards, "some", noShuffle)).toEqual(["b", "a", "c"]);
  });

  it("seedPendingLearnQuestionTypes creates per-card shuffled copies", () => {
    const cards = [createCard("a"), createCard("b")];
    const seeded = seedPendingLearnQuestionTypes(cards, ["multiple_choice", "written"], noShuffle);

    expect(seeded.get("a")).toEqual(["multiple_choice", "written"]);
    expect(seeded.get("b")).toEqual(["multiple_choice", "written"]);
    expect(seeded.get("a")).not.toBe(seeded.get("b"));
  });
});
