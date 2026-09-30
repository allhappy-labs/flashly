import { normalizeQuizEnrichment } from '@flashly/shared';

export type ResolvedMultipleChoiceQuestion =
    | {
          kind: 'multiple_choice';
          prompt: string;
          answer: string;
          options: string[];
          explanation?: string;
          source: 'curated' | 'generic';
      }
    | {
          kind: 'written_fallback';
          prompt: string;
          answer: string;
      };

type ResolveMultipleChoiceQuestionInput = {
    prompt: string;
    answer: string;
    distractors: readonly string[];
    quiz?: unknown;
};

type RandomFn = () => number;

function shuffleValues<T>(values: readonly T[], random: RandomFn): T[] {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
}

function resolveGenericOptions(answer: string, distractors: readonly string[], random: RandomFn): string[] {
    const options = new Set<string>([answer]);
    for (const distractor of shuffleValues(distractors, random)) {
        if (options.size >= 4) {
            break;
        }
        if (distractor) {
            options.add(distractor);
        }
    }
    return shuffleValues([...options], random);
}

export function resolveMultipleChoiceQuestion(
    input: ResolveMultipleChoiceQuestionInput,
    random: RandomFn = Math.random,
): ResolvedMultipleChoiceQuestion {
    const quiz = normalizeQuizEnrichment(input.quiz);
    if (quiz) {
        return {
            kind: 'multiple_choice',
            prompt: quiz.prompt,
            answer: quiz.correctAnswer,
            options: shuffleValues(quiz.options, random),
            explanation: quiz.explanation,
            source: 'curated',
        };
    }

    const options = resolveGenericOptions(input.answer, input.distractors, random);
    if (options.length < 2) {
        return {
            kind: 'written_fallback',
            prompt: input.prompt,
            answer: input.answer,
        };
    }

    return {
        kind: 'multiple_choice',
        prompt: input.prompt,
        answer: input.answer,
        options,
        source: 'generic',
    };
}
