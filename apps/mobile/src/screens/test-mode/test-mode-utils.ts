import type { CardPreview } from "../../db/deckRepositorySafe";
import { resolveMultipleChoiceQuestion } from "../quiz/resolve-multiple-choice-question";

export type TestQuestionType = "mcq" | "written" | "boolean";

export type TestQuestion = {
  id: string;
  cardId: string;
  type: TestQuestionType;
  prompt: string;
  correctAnswer: string;
  isStarred: boolean;
  audioUrl?: string | null;
  options?: string[];
  explanation?: string;
  source?: "curated" | "generic";
  statement?: string;
  userAnswer?: string;
  isCorrect?: boolean;
};

type RandomFn = () => number;

export function shuffleItems<T>(items: T[], random: RandomFn = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildTestQuestions(cards: CardPreview[], random: RandomFn = Math.random): TestQuestion[] {
  if (!cards.length) return [];
  const pool = shuffleItems(cards, random);
  const questions: TestQuestion[] = [];

  pool.forEach((card, idx) => {
    const typeCycle: TestQuestionType[] = ["mcq", "written", "boolean"];
    const type = typeCycle[idx % typeCycle.length];

    if (type === "mcq") {
      const resolved = resolveMultipleChoiceQuestion(
        {
          prompt: card.front,
          answer: card.back,
          distractors: cards.filter((candidate) => candidate.id !== card.id).map((candidate) => candidate.back),
          quiz: card.quiz,
        },
        random,
      );

      if (resolved.kind === "written_fallback") {
        questions.push({
          id: card.id,
          cardId: card.id,
          type: "written",
          prompt: resolved.prompt,
          correctAnswer: resolved.answer,
          isStarred: Boolean(card.isStarred),
          audioUrl: card.audioUrl ?? null,
        });
        return;
      }

      const question = {
        id: card.id,
        cardId: card.id,
        type,
        prompt: resolved.prompt,
        correctAnswer: resolved.answer,
        isStarred: Boolean(card.isStarred),
        audioUrl: card.audioUrl ?? null,
        options: resolved.options,
        source: resolved.source,
      };

      if (resolved.explanation) {
        questions.push({ ...question, explanation: resolved.explanation });
        return;
      }

      questions.push({
        ...question,
      });
      return;
    }

    if (type === "boolean") {
      const canLie = cards.length > 1;
      const useCorrect = !canLie ? true : random() > 0.5;
      const randomBack = useCorrect
        ? card.back
        : shuffleItems(cards.filter((candidate) => candidate.id !== card.id), random).at(0)?.back;
      questions.push({
        id: `${card.id}-bool`,
        cardId: card.id,
        type,
        prompt: card.front,
        correctAnswer: useCorrect ? "true" : "false",
        isStarred: Boolean(card.isStarred),
        audioUrl: card.audioUrl ?? null,
        statement: randomBack ?? card.back,
      });
      return;
    }

    questions.push({
      id: `${card.id}-written`,
      cardId: card.id,
      type,
      prompt: card.front,
      correctAnswer: card.back,
      isStarred: Boolean(card.isStarred),
      audioUrl: card.audioUrl ?? null,
    });
  });

  return questions;
}
