import { describe, expect, it } from "vitest";
import type { CardPreview } from "../../db/deckRepositorySafe";
import { buildTestQuestions, shuffleItems } from "./test-mode-utils";

function createCardPreview(id: string, overrides: Partial<CardPreview> = {}): CardPreview {
  return {
    id,
    front: `front-${id}`,
    back: `back-${id}`,
    isStarred: false,
    audioUrl: null,
    ...overrides,
  };
}

const noShuffle = () => 0.999999;

describe("test-mode-utils", () => {
  it("shuffleItems preserves order with deterministic no-op random", () => {
    expect(shuffleItems([1, 2, 3], noShuffle)).toEqual([1, 2, 3]);
  });

  it("buildTestQuestions generates a mixed cycle of question types", () => {
    const cards = [createCardPreview("a"), createCardPreview("b"), createCardPreview("c")];
    const questions = buildTestQuestions(cards, noShuffle);

    expect(questions.map((question) => question.type)).toEqual(["mcq", "written", "boolean"]);
    expect(questions[0]?.correctAnswer).toBe("back-a");
    expect(questions[1]?.id).toBe("b-written");
    expect(questions[2]?.id).toBe("c-bool");
  });

  it("uses curated enrichment for an MCQ-cycle card", () => {
    const [question] = buildTestQuestions(
      [
        createCardPreview("a", {
          front: "France",
          back: "Paris",
          quiz: {
            prompt: "Which city has the Eiffel Tower?",
            options: ["Paris", "Rome", "Berlin"],
            correctAnswer: "Paris",
            explanation: "The Eiffel Tower is in Paris.",
          },
        }),
        createCardPreview("b", { back: "Madrid" }),
      ],
      noShuffle,
    );

    expect(question).toMatchObject({
      type: "mcq",
      prompt: "Which city has the Eiffel Tower?",
      correctAnswer: "Paris",
      options: ["Paris", "Rome", "Berlin"],
      explanation: "The Eiffel Tower is in Paris.",
      source: "curated",
    });
  });

  it("uses deck backs for an MCQ-cycle card without enrichment", () => {
    const [question] = buildTestQuestions(
      [
        createCardPreview("a", { front: "France", back: "Paris" }),
        createCardPreview("b", { back: "Madrid" }),
        createCardPreview("c", { back: "Rome" }),
      ],
      noShuffle,
    );

    expect(question).toMatchObject({
      type: "mcq",
      prompt: "France",
      correctAnswer: "Paris",
      options: ["Paris", "Madrid", "Rome"],
      source: "generic",
    });
    expect(question).not.toHaveProperty("explanation");
  });

  it("converts an MCQ-cycle card to written recall when it has no usable choices", () => {
    const [question] = buildTestQuestions([createCardPreview("solo")], noShuffle);

    expect(question).toMatchObject({
      type: "written",
      prompt: "front-solo",
      correctAnswer: "back-solo",
    });
    expect(question).not.toHaveProperty("options");
  });

  it("keeps the curated answer correct after options are shuffled", () => {
    const randomValues = [0.999999, 0, 0];
    let randomIndex = 0;
    const [question] = buildTestQuestions(
      [
        createCardPreview("a", {
          quiz: {
            prompt: "Pick the capital of France.",
            options: ["Paris", "Rome", "Berlin"],
            correctAnswer: "Paris",
            explanation: "Paris is France's capital.",
          },
        }),
        createCardPreview("b"),
      ],
      () => randomValues[randomIndex++] ?? 0,
    );

    expect(question?.options).toContain(question?.correctAnswer);
    expect(question?.correctAnswer).toBe("Paris");
  });

  it("keeps written and boolean cycle entries deck-derived", () => {
    const questions = buildTestQuestions(
      [
        createCardPreview("a", {
          quiz: {
            prompt: "Curated question",
            options: ["one", "two"],
            correctAnswer: "one",
            explanation: "Curated explanation.",
          },
        }),
        createCardPreview("b"),
        createCardPreview("c"),
      ],
      noShuffle,
    );

    expect(questions[1]).toMatchObject({
      id: "b-written",
      type: "written",
      prompt: "front-b",
      correctAnswer: "back-b",
    });
    expect(questions[2]).toMatchObject({
      id: "c-bool",
      type: "boolean",
      prompt: "front-c",
      correctAnswer: "true",
      statement: "back-c",
    });
    expect(questions[1]).not.toHaveProperty("source");
    expect(questions[2]).not.toHaveProperty("source");
  });
});
