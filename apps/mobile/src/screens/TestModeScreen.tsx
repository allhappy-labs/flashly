import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  type CardPreview,
  completeStudySession,
  countCards,
  createStudySession,
  listCardSamples,
  setCardStarred,
} from "../db/deckRepositorySafe";
import type { DeckStackParamList } from "../navigation/types";
import { usePalette } from "../theme";
import { useStore } from "../store/useStore";
import { triggerHaptic } from "../utils/haptics";
import { useAnswerController } from "../hooks/useAnswerController";
import { useAnswerProgression } from "../hooks/useAnswerProgression";
import { stopAudioPlayback } from "../services/audioPlayer";
import { logger } from "../utils/logger";
import { buildTestQuestions, type TestQuestion as Question } from "./test-mode/test-mode-utils";
import { TestModeSetupView } from "./test-mode/TestModeSetupView";
import { TestModeCompletionView } from "./test-mode/TestModeCompletionView";
import { TestModeQuestionView } from "./test-mode/TestModeQuestionView";

type Props = NativeStackScreenProps<DeckStackParamList, "Test">;

export default function TestModeScreen({ navigation, route }: Props) {
  const { deckId } = route.params;
  const { t } = useTranslation();
  const colors = usePalette();
  const [setupLoading, setSetupLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [questionCount, setQuestionCount] = useState(20);
  const [hasStarted, setHasStarted] = useState(false);
  const cardsRef = useRef<CardPreview[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const sessionEndedRef = useRef(false);
  const recordStudy = useStore((state) => state.recordStudy);
  const hapticsEnabled = useStore((state) => state.hapticsEnabled);
  const userId = useStore((state) => state.userId);
  const primaryTint = "rgba(47, 107, 255, 0.12)";

  const currentQuestion = questions[index];

  useEffect(() => {
    void stopAudioPlayback();
    return () => {
      void stopAudioPlayback();
    };
  }, [currentQuestion?.id ?? index]);

  const handleAnswered = useCallback(
    ({ answer, isCorrect }: { answer: string | null; isCorrect: boolean }) => {
      if (!currentQuestion || currentQuestion.isCorrect !== undefined) return;
      triggerHaptic(isCorrect ? "correct" : "wrong", hapticsEnabled);
      setQuestions((prev) =>
        prev.map((q, idx) =>
          idx === index ? { ...q, userAnswer: answer ?? undefined, isCorrect } : q,
        ),
      );
      if (isCorrect) {
        setScore((s) => s + 1);
      }
    },
    [currentQuestion, hapticsEnabled, index],
  );

  const {
    typedAnswer,
    setTypedAnswer,
    selectedOption,
    feedback,
    submitOption,
    submitWritten,
    dontKnow,
    markCorrect,
  } = useAnswerController({
    correctAnswer: currentQuestion?.correctAnswer ?? "",
    grading: "smart",
    resetKey: currentQuestion?.id ?? index,
    onAnswered: handleAnswered,
  });

  useEffect(() => {
    navigation.setOptions({ title: t("test.title") });
  }, [navigation, t]);

  const finalizeSession = useCallback(async () => {
    if (!sessionIdRef.current || sessionEndedRef.current) return;
    const result = await completeStudySession(sessionIdRef.current, userId);
    if (result.isErr()) {
      logger.error('Failed to complete study session:', result.error.message);
    }
    sessionEndedRef.current = true;
    sessionIdRef.current = null;
  }, [userId]);

  const startSession = useCallback(
    async (hasQuestions: boolean) => {
      await finalizeSession();
      if (!hasQuestions) {
        sessionEndedRef.current = true;
        sessionIdRef.current = null;
        return;
      }
      const result = await createStudySession(deckId);
      if (result.isErr()) {
        logger.error('Failed to create study session:', result.error.message);
        sessionEndedRef.current = true;
        sessionIdRef.current = null;
        return;
      }
      const id = result.value;
      sessionIdRef.current = id;
      sessionEndedRef.current = false;
    },
    [deckId, finalizeSession],
  );

  const load = useCallback(async () => {
    const limit = Math.min(questionCount, totalCards);
    if (limit <= 0) {
      setQuestions([]);
      setLoading(false);
      await startSession(false);
      return;
    }
    setLoading(true);
    const result = await listCardSamples(deckId, limit);
    if (result.isErr()) {
      logger.error('Failed to list card samples:', result.error.message);
      setLoading(false);
      return;
    }
    const data = result.value;
    cardsRef.current = data;
    const built = buildTestQuestions(data);
    setQuestions(built);
    setIndex(0);
    setScore(0);
    setFinished(false);
    await startSession(built.length > 0);
    setLoading(false);
  }, [deckId, questionCount, startSession, totalCards]);

  useEffect(() => {
    let active = true;
    const loadCount = async () => {
      setSetupLoading(true);
      const result = await countCards(deckId);
      if (result.isErr()) {
        logger.error('Failed to count cards:', result.error.message);
        if (!active) return;
        setTotalCards(0);
        setQuestionCount(0);
        setSetupLoading(false);
        return;
      }
      const count = result.value;
      if (!active) return;
      setTotalCards(count);
      setQuestionCount(Math.min(20, count));
      setQuestions([]);
      setIndex(0);
      setScore(0);
      setFinished(false);
      setHasStarted(false);
      setSetupLoading(false);
    };
    loadCount();
    return () => {
      active = false;
      void finalizeSession();
    };
  }, [deckId, finalizeSession]);

  const handleSubmit = () => {
    submitWritten();
  };

  const handleToggleStar = useCallback(async () => {
    if (!currentQuestion) return;
    const nextStarred = !currentQuestion.isStarred;
    const result = await setCardStarred(currentQuestion.cardId, nextStarred);
    if (result.isErr()) {
      logger.error('Failed to set card starred:', result.error.message);
      return;
    }
    setQuestions((prev) =>
      prev.map((question) =>
        question.cardId === currentQuestion.cardId ? { ...question, isStarred: nextStarred } : question,
      ),
    );
    cardsRef.current = cardsRef.current.map((card) =>
      card.id === currentQuestion.cardId ? { ...card, isStarred: nextStarred } : card,
    );
  }, [currentQuestion]);

  const handleOverrideCorrect = useCallback(() => {
    if (!currentQuestion) return;
    if (currentQuestion.type !== "written" || currentQuestion.isCorrect !== false) return;
    markCorrect();
    setQuestions((prev) => prev.map((q, idx) => (idx === index ? { ...q, isCorrect: true } : q)));
    setScore((s) => s + 1);
  }, [currentQuestion, index, markCorrect]);

  const handleNext = useCallback(() => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
  }, [index, questions.length]);

  const handleDontKnow = () => {
    if (!currentQuestion || currentQuestion.isCorrect !== undefined) return;
    dontKnow();
  };

  const handleContinue = useCallback(() => {
    if (!currentQuestion || !feedback) return;
    handleNext();
  }, [currentQuestion, feedback, handleNext]);

  const answered = currentQuestion?.isCorrect !== undefined;
  const showImmediateContinue =
    (feedback === "incorrect" && currentQuestion?.type === "written") ||
    (feedback !== null && currentQuestion?.source === "curated" && Boolean(currentQuestion.explanation));
  const { continueAnim } = useAnswerProgression({
    feedback,
    showImmediateContinue,
    onContinue: handleContinue,
  });

  useEffect(() => {
    if (finished) {
      void recordStudy(deckId);
      void finalizeSession();
    }
  }, [deckId, finalizeSession, finished, recordStudy]);

  useEffect(() => {
    const sub = navigation.addListener("beforeRemove", () => {
      void finalizeSession();
    });
    return sub;
  }, [finalizeSession, navigation]);

  if (setupLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!totalCards) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>{t("study.empty")}</Text>
      </View>
    );
  }

  if (!hasStarted) {
    const minCount = Math.min(1, totalCards);
    return (
      <TestModeSetupView
        colors={colors}
        t={t}
        primaryTint={primaryTint}
        questionCount={questionCount}
        totalCards={totalCards}
        minCount={minCount}
        onDecrease={() => setQuestionCount((prev) => Math.max(minCount, prev - 1))}
        onIncrease={() => setQuestionCount((prev) => Math.min(totalCards, prev + 1))}
        onStart={() => {
          setHasStarted(true);
          void load();
        }}
      />
    );
  }

  if (finished) {
    return (
      <TestModeCompletionView
        colors={colors}
        t={t}
        score={score}
        questions={questions}
        onRestart={() => {
          void load();
        }}
        onBackToDeck={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
            return;
          }
          navigation.navigate("DeckOverview", { deckId });
        }}
      />
    );
  }

  const progress = questions.length ? Math.min((index + 1) / questions.length, 1) : 0;

  if (!currentQuestion) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <TestModeQuestionView
      colors={colors}
      t={t}
      question={currentQuestion}
      progress={progress}
      index={index}
      totalQuestions={questions.length}
      answered={answered}
      feedback={feedback}
      selectedOption={selectedOption}
      typedAnswer={typedAnswer}
      setTypedAnswer={setTypedAnswer}
      onSelectOption={submitOption}
      onToggleStar={handleToggleStar}
      onOverrideCorrect={handleOverrideCorrect}
      onDontKnow={handleDontKnow}
      onSubmit={handleSubmit}
      onContinue={handleContinue}
      continueAnim={continueAnim}
      showImmediateContinue={showImmediateContinue}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
});
