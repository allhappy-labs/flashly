import type { Card } from "../../types/models";
import type { LearnFamiliarity, LearnOptions, LearnQuestionType } from "../../types/learn";
import { maskExample } from "../../utils/learn";
import { resolveMultipleChoiceQuestion } from "../quiz/resolve-multiple-choice-question";

export type LearnQuestion = {
  prompt: string;
  answer: string;
  directionLabel: string;
  type: LearnQuestionType;
  scheduledType: LearnQuestionType;
  answerSide: "front" | "back";
  options?: string[];
  explanation?: string;
  source?: "curated" | "generic";
};

type RandomFn = () => number;

type LearnQueueAdvanceInput = {
  queue: readonly string[];
  currentId: string | null;
  shouldRepeat: boolean;
  questionAttempt: number;
};

type LearnQueueAdvance = {
  queue: string[];
  currentId: string | null;
  questionAttempt: number;
};

export function shuffleValues<T>(values: T[], random: RandomFn = Math.random): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildLearnQuestion(
  card: Card,
  options: LearnOptions,
  type: LearnQuestionType,
  preferTerm: boolean,
  answerPool: readonly string[] = [],
  random: RandomFn = Math.random,
): LearnQuestion {
  const term = card.front;
  const definition = card.back;
  const direction =
    options.formatPreset === "Definition" || options.formatPreset === "Cloze"
      ? "term"
      : options.formatPreset === "Mixed"
        ? preferTerm
          ? "term"
          : "definition"
        : options.direction;

  const question: LearnQuestion =
    options.formatPreset === "Cloze" && card.example
      ? {
          prompt: maskExample(card.example, term),
          answer: term,
          directionLabel: "cloze",
          type,
          scheduledType: type,
          answerSide: "front",
        }
      : direction === "term"
        ? {
            prompt: definition,
            answer: term,
            directionLabel: "term",
            type,
            scheduledType: type,
            answerSide: "front",
          }
        : {
            prompt: term,
            answer: definition,
            directionLabel: "definition",
            type,
            scheduledType: type,
            answerSide: "back",
          };

  if (type !== "multiple_choice") {
    return question;
  }

  const resolved = resolveMultipleChoiceQuestion(
    {
      prompt: question.prompt,
      answer: question.answer,
      distractors: answerPool,
      quiz: card.quiz,
    },
    random,
  );

  if (resolved.kind === "written_fallback") {
    return {
      ...question,
      type: "written",
    };
  }

  if (resolved.explanation) {
    return {
      ...question,
      prompt: resolved.prompt,
      answer: resolved.answer,
      options: resolved.options,
      explanation: resolved.explanation,
      source: resolved.source,
    };
  }

  return {
    ...question,
    prompt: resolved.prompt,
    answer: resolved.answer,
    options: resolved.options,
    source: resolved.source,
  };
}

export function getLearnAnswerPool(
  cards: readonly Card[],
  currentCardId: string,
  answerSide: LearnQuestion["answerSide"],
): string[] {
  return cards
    .filter((card) => card.id !== currentCardId)
    .map((card) => (answerSide === "front" ? card.front : card.back));
}

export function consumeScheduledLearnQuestionType(
  questionTypes: readonly LearnQuestionType[],
  scheduledType: LearnQuestionType,
): LearnQuestionType[] {
  return questionTypes.filter((questionType) => questionType !== scheduledType);
}

export function advanceLearnQueue(input: LearnQueueAdvanceInput): LearnQueueAdvance {
  const queue = input.queue.slice(1);
  if (input.shouldRepeat && input.currentId) {
    queue.push(input.currentId);
  }
  return {
    queue,
    currentId: queue[0] ?? null,
    questionAttempt: input.questionAttempt + 1,
  };
}

export function pickLearnQuestionType(options: LearnOptions, random: RandomFn = Math.random): LearnQuestionType {
  const types = options.questionTypes;
  if (types.length === 1) {
    return types[0];
  }
  return types[Math.floor(random() * types.length)];
}

export function buildInitialLearnQueue(
  cards: Card[],
  familiarity: LearnFamiliarity,
  random: RandomFn = Math.random,
): string[] {
  if (familiarity === "new") {
    return shuffleValues(cards, random).map((card) => card.id);
  }
  if (familiarity === "some") {
    const sorted = [...cards];
    sorted.sort((a, b) => {
      const aPriority = a.learnState === "not_studied" ? 0 : 1;
      const bPriority = b.learnState === "not_studied" ? 0 : 1;
      return aPriority - bPriority;
    });
    return shuffleValues(sorted, random).map((card) => card.id);
  }
  const sorted = [...cards];
  sorted.sort((a, b) => {
    const aPriority = a.learnState === "mastered" ? 0 : 1;
    const bPriority = b.learnState === "mastered" ? 0 : 1;
    return aPriority - bPriority;
  });
  return shuffleValues(sorted, random).map((card) => card.id);
}

export function seedPendingLearnQuestionTypes(
  cards: Card[],
  questionTypes: LearnQuestionType[],
  random: RandomFn = Math.random,
): Map<string, LearnQuestionType[]> {
  return new Map(cards.map((card) => [card.id, shuffleValues([...questionTypes], random)]));
}
