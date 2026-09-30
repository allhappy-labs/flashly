import { useCallback, useEffect, useState } from "react";

import { isAnswerCorrect } from "../utils/learn";

type FeedbackState = "correct" | "incorrect" | null;

type AnswerPayload = {
  answer: string | null;
  isCorrect: boolean;
};

type Options = {
  correctAnswer: string;
  grading?: "strict" | "smart";
  resetKey?: string | number | null;
  onAnswered?: (payload: AnswerPayload) => void;
};

export function useAnswerController({ correctAnswer, grading = "strict", resetKey, onAnswered }: Options) {
  const [typedAnswer, setTypedAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const reset = useCallback(() => {
    setTypedAnswer("");
    setSelectedOption(null);
    setFeedback(null);
  }, []);

  useEffect(() => {
    reset();
  }, [reset, resetKey]);

  const submitOption = useCallback(
    (option: string) => {
      if (feedback) return null;
      setSelectedOption(option);
      const isCorrect = isAnswerCorrect(option, correctAnswer, grading);
      setFeedback(isCorrect ? "correct" : "incorrect");
      onAnswered?.({ answer: option, isCorrect });
      return isCorrect;
    },
    [correctAnswer, feedback, grading, onAnswered],
  );

  const submitWritten = useCallback(() => {
    if (feedback) return null;
    const trimmed = typedAnswer.trim();
    if (!trimmed) return null;
    const isCorrect = isAnswerCorrect(trimmed, correctAnswer, grading);
    setFeedback(isCorrect ? "correct" : "incorrect");
    onAnswered?.({ answer: trimmed, isCorrect });
    return isCorrect;
  }, [correctAnswer, feedback, grading, onAnswered, typedAnswer]);

  const dontKnow = useCallback(() => {
    if (feedback) return null;
    setFeedback("incorrect");
    onAnswered?.({ answer: null, isCorrect: false });
    return false;
  }, [feedback, onAnswered]);

  const markCorrect = useCallback(() => {
    setFeedback("correct");
  }, []);

  return {
    typedAnswer,
    setTypedAnswer,
    selectedOption,
    feedback,
    reset,
    submitOption,
    submitWritten,
    dontKnow,
    markCorrect,
  };
}
