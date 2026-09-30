import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { completeStudySession, createStudySession, listCards, logStudyResult } from "../db/deckRepositorySafe";
import { Rating } from "ts-fsrs";
import type { DeckStackParamList } from "../navigation/types";
import { useStore } from "../store/useStore";
import type { Card } from "../types/models";
import { usePalette } from "../theme";
import ProgressHeader from "../components/ProgressHeader";
import MarkdownText from "../components/MarkdownText";
import FeedbackTextInput from "../components/FeedbackTextInput";
import Ionicons from "@expo/vector-icons/Ionicons";
import { HeaderButton } from "@react-navigation/elements";
import { triggerHaptic } from "../utils/haptics";
import { logger } from "../utils/logger";

type Props = NativeStackScreenProps<DeckStackParamList, "Write">;

function shuffleCards(cards: Card[]) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeAnswer(value: string) {
  const stripped = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return stripped.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function maskExample(example: string, term: string) {
  if (!example.trim() || !term.trim()) return example;
  const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
  return example.replace(pattern, "_____");
}

export default function WriteModeScreen({ navigation, route }: Props) {
  const { deckId } = route.params;
  const { t } = useTranslation();
  const colors = usePalette();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [pendingRating, setPendingRating] = useState<Rating | null>(null);
  const [pendingCorrect, setPendingCorrect] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const recordStudy = useStore((state) => state.recordStudy);
  const hapticsEnabled = useStore((state) => state.hapticsEnabled);
  const userId = useStore((state) => state.userId);
  const cardsRef = useRef<Card[]>([]);
  const answeredRef = useRef(0);
  const sessionEndedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const recordedRef = useRef(false);

  const currentCard = cards[index];
  const finished = index >= cards.length;

  const handleShuffle = useCallback(() => {
    if (!cards.length || finished) return;
    const currentIndex = Math.min(index, cards.length - 1);
    const head = cards.slice(0, currentIndex + 1);
    const remaining = shuffleCards(cards.slice(currentIndex + 1));
    setCards([...head, ...remaining]);
  }, [cards, finished, index]);

  useEffect(() => {
    navigation.setOptions({
      title: t("write.title"),
      headerRight: ({ tintColor }) => (
        <HeaderButton
          onPress={handleShuffle}
          accessibilityLabel={t("study.shuffle")}
          pressOpacity={0.6}
        >
          <Ionicons name="shuffle" size={22} color={tintColor ?? colors.text} />
        </HeaderButton>
      ),
    });
  }, [colors.text, handleShuffle, navigation, t]);

  const finalizeSession = useCallback(async () => {
    if (!sessionIdRef.current || sessionEndedRef.current) return;
    const result = await completeStudySession(sessionIdRef.current, userId);
    if (result.isErr()) {
      logger.error('Failed to complete study session:', result.error.message);
    }
    sessionEndedRef.current = true;
    sessionIdRef.current = null;
  }, [userId]);

  const loadCards = useCallback(async () => {
    await finalizeSession();
    setLoading(true);
    const dataResult = await listCards(deckId);
    if (dataResult.isErr()) {
      logger.error('Failed to load cards:', dataResult.error.message);
      setCards([]);
      setLoading(false);
      return;
    }
    const data = dataResult.value;
    cardsRef.current = data;
    setCards([...data]);
    setIndex(0);
    setInput("");
    setFeedback(null);
    setShowAnswer(false);
    setPendingRating(null);
    setPendingCorrect(null);
    setCorrectCount(0);
    setWrongCount(0);
    if (data.length) {
      const sessionResult = await createStudySession(deckId);
      if (sessionResult.isErr()) {
        logger.error('Failed to create study session:', sessionResult.error.message);
        setSessionId(null);
        sessionIdRef.current = null;
        sessionEndedRef.current = true;
        setLoading(false);
        return;
      }
      const id = sessionResult.value;
      setSessionId(id);
      sessionIdRef.current = id;
      sessionEndedRef.current = false;
    } else {
      setSessionId(null);
      sessionIdRef.current = null;
      sessionEndedRef.current = true;
    }
    answeredRef.current = 0;
    recordedRef.current = false;
    setLoading(false);
  }, [deckId, finalizeSession]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleSubmit = useCallback(() => {
    if (!currentCard || !input.trim() || feedback) return;
    const userNormalized = normalizeAnswer(input);
    const targetNormalized = normalizeAnswer(currentCard.back);
    const isCorrect = userNormalized === targetNormalized;
    triggerHaptic(isCorrect ? "correct" : "wrong", hapticsEnabled);
    setFeedback(isCorrect ? "correct" : "incorrect");
    setShowAnswer(!isCorrect);
    setPendingRating(isCorrect ? Rating.Good : Rating.Again);
    setPendingCorrect(isCorrect);
    answeredRef.current += 1;
    sessionEndedRef.current = false;
  }, [currentCard, feedback, input]);

  const commitPending = useCallback(async () => {
    if (!currentCard || pendingRating === null || pendingCorrect === null) return;
    const result = await logStudyResult({
      card: currentCard,
      deckId,
      rating: pendingRating,
      sessionId,
      userId,
    });
    if (result.isErr()) {
      logger.error('Failed to log study result:', result.error.message);
      return;
    }
    if (pendingCorrect) setCorrectCount((c) => c + 1);
    else setWrongCount((w) => w + 1);
    setPendingRating(null);
    setPendingCorrect(null);
  }, [currentCard, deckId, pendingCorrect, pendingRating, sessionId, userId]);

  const handleNext = useCallback(async () => {
    if (finished || !feedback) return;
    await commitPending();
    setIndex((i) => i + 1);
    setInput("");
    setFeedback(null);
    setShowAnswer(false);
  }, [commitPending, feedback, finished]);

  const handleOverrideCorrect = useCallback(() => {
    if (feedback !== "incorrect") return;
    setFeedback("correct");
    setShowAnswer(false);
    setPendingRating(Rating.Good);
    setPendingCorrect(true);
  }, [feedback]);

  useEffect(() => {
    const sub = navigation.addListener("beforeRemove", async () => {
      await commitPending();
      if (answeredRef.current > 0 && !recordedRef.current) {
        await recordStudy(deckId);
        recordedRef.current = true;
      }
      await finalizeSession();
    });
    return sub;
  }, [commitPending, deckId, finalizeSession, navigation, recordStudy]);

  useEffect(() => {
    return () => {
      void commitPending();
      void finalizeSession();
    };
  }, [commitPending, finalizeSession]);

  const handleRestart = useCallback(async () => {
    await finalizeSession();
    setCards([...cardsRef.current]);
    setIndex(0);
    setInput("");
    setFeedback(null);
    setShowAnswer(false);
    setPendingRating(null);
    setPendingCorrect(null);
    setCorrectCount(0);
    setWrongCount(0);
    answeredRef.current = 0;
    recordedRef.current = false;
    createStudySession(deckId).then((result) => {
      if (result.isErr()) {
        logger.error('Failed to create study session:', result.error.message);
        setSessionId(null);
        sessionIdRef.current = null;
        sessionEndedRef.current = true;
        return;
      }
      const id = result.value;
      setSessionId(id);
      sessionIdRef.current = id;
      sessionEndedRef.current = false;
    });
  }, [deckId, finalizeSession]);

  useEffect(() => {
    if (!finished || recordedRef.current || answeredRef.current <= 0) return;
    recordedRef.current = true;
    void recordStudy(deckId);
  }, [deckId, finished, recordStudy]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!cards.length) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>{t("study.empty")}</Text>
      </View>
    );
  }

  if (finished) {
    const total = cards.length;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <View style={styles.summaryWrap}>
          <View style={styles.summaryHeader}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>{t("write.completeTitle")}</Text>
            <Text style={[styles.summarySubtitle, { color: colors.muted }]}>
              {t("write.completeSubtitle", { total })}
            </Text>
          </View>
          <View style={[styles.progressRing, { borderColor: colors.secondary }]}>
            <View style={[styles.progressRingInner, { borderColor: colors.primary }]} />
            <View style={styles.progressContent}>
              <Text style={[styles.progressValue, { color: colors.text }]}>{accuracy}%</Text>
              <View style={[styles.progressBadge, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.progressBadgeText, { color: colors.primary }]}>{t("write.greatJob")}</Text>
              </View>
            </View>
          </View>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.summaryCount, { color: colors.text }]}>{correctCount}</Text>
              <Text style={[styles.summaryLabel, { color: colors.muted }]}>{t("write.masteredLabel")}</Text>
            </View>
            <View style={[styles.summaryTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.summaryCount, { color: colors.text }]}>{wrongCount}</Text>
              <Text style={[styles.summaryLabel, { color: colors.muted }]}>{t("write.learningLabel")}</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={handleRestart}>
            <Text style={styles.actionButtonText}>{t("write.restart")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.outlineButton, { borderColor: colors.border }]}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("DeckOverview", { deckId });
              }
            }}
          >
            <Text style={[styles.outlineButtonText, { color: colors.text }]}>{t("study.backToDeck")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <ProgressHeader
            current={index + 1}
            total={cards.length}
            trackColor={colors.secondary}
            fillColor={colors.primary}
            textColor={colors.muted}
          />
        </View>

        <View style={[styles.promptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.promptContent}>
            <View style={styles.promptHeader}>
              <Text style={[styles.promptLabel, { color: colors.primary }]}>{t("write.termLabel")}</Text>
            </View>
            <MarkdownText
              value={currentCard.front}
              color={colors.text}
              mutedColor={colors.muted}
              accentColor={colors.accent}
              textAlign="left"
              fontSize={30}
            />
            {currentCard.pos ? <Text style={[styles.posText, { color: colors.muted }]}>{currentCard.pos}</Text> : null}
            {currentCard.example ? (
              <View style={[styles.exampleBlock, { borderTopColor: colors.border }]}>
                <Text style={[styles.exampleLabel, { color: colors.muted }]}>{t("write.exampleLabel")}</Text>
                <Text style={[styles.exampleText, { color: colors.muted }]}>
                  {maskExample(currentCard.example, currentCard.front)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {feedback ? (
          <View style={styles.feedbackStack}>
            <View style={styles.feedbackRow}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: feedback === "correct" ? colors.accent : colors.danger,
                  },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {feedback === "correct" ? t("write.correctLabel") : t("write.incorrectLabel")}
                </Text>
              </View>
              {feedback === "incorrect" ? (
                <Text style={[styles.feedbackHint, { color: colors.muted }]}>{t("write.keepGoing")}</Text>
              ) : null}
            </View>
            {showAnswer ? (
              <View
                style={[
                  styles.correctionCard,
                  { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.primary },
                ]}
              >
                <Text style={[styles.correctionLabel, { color: colors.muted }]}>{t("write.expected")}</Text>
                <MarkdownText
                  value={currentCard.back}
                  color={colors.text}
                  mutedColor={colors.muted}
                  accentColor={colors.accent}
                  textAlign="left"
                  fontSize={18}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.answerSection}>
          <Text style={[styles.answerLabel, { color: colors.muted }]}>{t("write.yourAnswer")}</Text>
          <View style={styles.answerInputWrap}>
            <FeedbackTextInput
              value={input}
              onChangeText={setInput}
              placeholder={t("write.placeholder")}
              editable={!feedback}
              style={styles.answerInput}
              feedback={feedback}
              colors={colors}
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: colors.muted }]}>
              {t("write.charCount", { count: input.length })}
            </Text>
          </View>
          {feedback === "incorrect" ? (
            <TouchableOpacity style={styles.overrideButton} onPress={handleOverrideCorrect}>
              <Text style={[styles.overrideText, { color: colors.primary }]}>{t("write.overrideCorrect")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.footerButton,
            {
              backgroundColor: colors.primary,
              opacity: feedback ? 1 : input.trim().length > 0 ? 1 : 0.6,
            },
          ]}
          onPress={feedback ? handleNext : handleSubmit}
          disabled={!feedback && !input.trim()}
        >
          <Text style={styles.footerButtonText}>{feedback ? t("write.next") : t("write.check")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: { gap: 12 },
  promptCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  promptContent: { padding: 18, gap: 8 },
  promptHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  promptLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  posText: { fontSize: 14, fontStyle: "italic" },
  exampleBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, gap: 6 },
  exampleLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  exampleText: { fontSize: 14, lineHeight: 20 },
  feedbackStack: { gap: 12 },
  feedbackRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: { color: "#fff", fontWeight: "700", fontSize: 12, textTransform: "uppercase" },
  feedbackHint: { fontSize: 12, fontWeight: "500" },
  correctionCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  correctionLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  answerSection: { gap: 10 },
  answerLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  answerInputWrap: { gap: 6 },
  answerInput: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    minHeight: 120,
    fontSize: 16,
  },
  charCount: { textAlign: "right", fontSize: 12 },
  overrideButton: { alignSelf: "flex-end" },
  overrideText: { fontSize: 13, fontWeight: "600" },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  footerButton: {
    borderRadius: 16,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  footerButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  summaryWrap: {
    width: "100%",
    maxWidth: 520,
    padding: 20,
    gap: 18,
    alignItems: "center",
  },
  summaryHeader: { alignItems: "center", gap: 6 },
  summaryTitle: { fontSize: 26, fontWeight: "800" },
  summarySubtitle: { fontSize: 14, textAlign: "center" },
  progressRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRingInner: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 10,
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
  },
  progressContent: { alignItems: "center", gap: 6 },
  progressValue: { fontSize: 36, fontWeight: "800" },
  progressBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  progressBadgeText: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  summaryGrid: { flexDirection: "row", gap: 14 },
  summaryTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 6,
    minWidth: 140,
  },
  summaryCount: { fontSize: 24, fontWeight: "700" },
  summaryLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  actionButton: {
    width: "100%",
    borderRadius: 16,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  outlineButton: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineButtonText: { fontSize: 16, fontWeight: "700" },
});
