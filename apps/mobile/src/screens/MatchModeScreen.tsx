import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "@expo/vector-icons/Ionicons";
import { type CardPreview, completeStudySession, createStudySession, listCardSamples } from "../db/deckRepositorySafe";
import type { DeckStackParamList } from "../navigation/types";
import { useStore } from "../store/useStore";
import { usePalette } from "../theme";
import MarkdownText from "../components/MarkdownText";
import { triggerHaptic } from "../utils/haptics";
import { logger } from "../utils/logger";

type Props = NativeStackScreenProps<DeckStackParamList, "Match">;

type MatchItem = {
  cardId: string;
  label: string;
};

const MATCH_BEST_PREFIX = "flashly.matchBest";

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function withAlpha(hex: string, alphaHex: string) {
  if (hex.startsWith("#") && hex.length === 7) {
    return `${hex}${alphaHex}`;
  }
  return hex;
}

export default function MatchModeScreen({ navigation, route }: Props) {
  const { deckId } = route.params;
  const { t } = useTranslation();
  const colors = usePalette();
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState<MatchItem[]>([]);
  const [definitions, setDefinitions] = useState<MatchItem[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [selectedDefinition, setSelectedDefinition] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastTime, setLastTime] = useState<number | null>(null);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const cardsRef = useRef<CardPreview[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startRef = useRef<number | null>(null);
  const recordStudy = useStore((state) => state.recordStudy);
  const hapticsEnabled = useStore((state) => state.hapticsEnabled);
  const userId = useStore((state) => state.userId);
  const sessionIdRef = useRef<string | null>(null);
  const sessionEndedRef = useRef(false);
  const bestKey = useMemo(() => `${MATCH_BEST_PREFIX}.${deckId}`, [deckId]);

  const formatStopwatch = useCallback((ms: number | null, withTenths = false) => {
    if (ms === null) return "--:--";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    const base = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    return withTenths ? `${base}.${tenths}` : base;
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: t("match.title") });
  }, [navigation, t]);

  useEffect(() => {
    let active = true;
    const loadBest = async () => {
      const stored = await AsyncStorage.getItem(bestKey);
      if (!active) return;
      if (stored) {
        const parsed = Number(stored);
        if (!Number.isNaN(parsed)) {
          setBestTime(parsed);
          return;
        }
      }
      setBestTime(null);
    };
    loadBest();
    return () => {
      active = false;
    };
  }, [bestKey]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    const start = Date.now();
    startRef.current = start;
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - start);
    }, 100);
  }, [stopTimer]);

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
    async (hasCards: boolean) => {
      await finalizeSession();
      if (!hasCards) {
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

  const finalizeRound = useCallback(
    async (timeMs: number) => {
      stopTimer();
      startRef.current = null;
      setElapsed(timeMs);
      setLastTime(timeMs);
      setBestTime((prev) => {
        const next = prev === null ? timeMs : Math.min(prev, timeMs);
        if (next !== prev) {
          void AsyncStorage.setItem(bestKey, String(next));
        }
        return next;
      });
      await recordStudy(deckId);
      sessionEndedRef.current = false;
      await finalizeSession();
    },
    [bestKey, deckId, finalizeSession, recordStudy, stopTimer],
  );

  const buildRound = useCallback(
    (sourceCards: CardPreview[]) => {
      const selection = shuffle(sourceCards).slice(0, Math.min(10, sourceCards.length));
      if (!selection.length) {
        setTerms([]);
        setDefinitions([]);
        setMatched(new Set());
        setSelectedTerm(null);
        setSelectedDefinition(null);
        stopTimer();
        startRef.current = null;
        setElapsed(0);
        setLastTime(null);
        void startSession(false);
        return;
      }

      void startSession(true);
      const newTerms = selection.map((card) => ({ cardId: card.id, label: card.front }));
      const newDefinitions = shuffle(selection.map((card) => ({ cardId: card.id, label: card.back })));
      setTerms(newTerms);
      setDefinitions(newDefinitions);
      setMatched(new Set());
      setSelectedTerm(null);
      setSelectedDefinition(null);
      setLastTime(null);
      startTimer();
    },
    [startTimer, stopTimer],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const result = await listCardSamples(deckId, 20);
      if (result.isErr()) {
        logger.error('Failed to list card samples:', result.error.message);
        if (!active) return;
        setLoading(false);
        return;
      }
      const data = result.value;
      if (!active) return;
      cardsRef.current = data;
      setLoading(false);
      buildRound(data);
    };
    load();
    return () => {
      active = false;
      stopTimer();
      void finalizeSession();
    };
  }, [buildRound, deckId, finalizeSession, startSession, stopTimer]);

  useEffect(() => {
    const sub = navigation.addListener("beforeRemove", () => {
      void finalizeSession();
    });
    return sub;
  }, [finalizeSession, navigation]);

  const totalPairs = terms.length;
  const finished = matched.size === totalPairs && totalPairs > 0;
  const displayMs = finished ? lastTime ?? elapsed : elapsed;
  const displayMinutes = Math.floor(displayMs / 1000 / 60);
  const displaySeconds = Math.floor((displayMs / 1000) % 60);
  const progressRatio = totalPairs > 0 ? Math.min(matched.size / totalPairs, 1) : 0;

  const handleMatchCheck = useCallback(
    (termId: string | null, defId: string | null, lastSelected: "term" | "definition") => {
      if (!termId || !defId) return;
      const isMatch = termId === defId;
      if (isMatch) {
        triggerHaptic("correct", hapticsEnabled);
        setMatched((prev) => {
          const next = new Set(prev);
          next.add(termId);
          const completed = next.size === totalPairs;
          if (completed && startRef.current) {
            void finalizeRound(Date.now() - startRef.current);
          }
          return next;
        });
        setSelectedTerm(null);
        setSelectedDefinition(null);
        return;
      }
      triggerHaptic("wrong", hapticsEnabled);
      if (lastSelected === "term") {
        setSelectedDefinition(null);
      } else {
        setSelectedTerm(null);
      }
    },
    [finalizeRound, totalPairs],
  );

  const handleSelectTerm = (cardId: string) => {
    if (matched.has(cardId)) return;
    const newSelection = cardId === selectedTerm ? null : cardId;
    setSelectedTerm(newSelection);
    handleMatchCheck(newSelection, selectedDefinition, "term");
  };

  const handleSelectDefinition = (cardId: string) => {
    if (matched.has(cardId)) return;
    const newSelection = cardId === selectedDefinition ? null : cardId;
    setSelectedDefinition(newSelection);
    handleMatchCheck(selectedTerm, newSelection, "definition");
  };

  const handleReplay = useCallback(async () => {
    setLoading(true);
    const result = await listCardSamples(deckId, 20);
    if (result.isErr()) {
      logger.error('Failed to list card samples:', result.error.message);
      setLoading(false);
      return;
    }
    const data = result.value;
    cardsRef.current = data;
    setLoading(false);
    buildRound(data);
  }, [buildRound, deckId]);

  const progressText = useMemo(
    () => t("match.pairsValue", { current: matched.size, total: totalPairs }),
    [matched.size, t, totalPairs],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!terms.length) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>{t("study.empty")}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.timerRow}>
          <View style={[styles.timerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.timerValue, { color: colors.text }]}>{String(displayMinutes).padStart(2, "0")}</Text>
            <Text style={[styles.timerLabel, { color: colors.muted }]}>{t("match.minutesLabel")}</Text>
          </View>
          <Text style={[styles.timerSeparator, { color: colors.border }]}>:</Text>
          <View style={[styles.timerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.timerValue, { color: colors.text }]}>
              {String(displaySeconds).padStart(2, "0")}
            </Text>
            <Text style={[styles.timerLabel, { color: colors.muted }]}>{t("match.secondsLabel")}</Text>
          </View>
        </View>

        <View style={styles.bestRow}>
          <View style={[styles.bestPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Ionicons name="trophy" size={14} color={colors.primary} />
            <Text style={[styles.bestText, { color: colors.muted }]}>
              {t("match.bestTime", { time: formatStopwatch(bestTime, true) })}
            </Text>
          </View>
          <TouchableOpacity style={[styles.replayButton, { backgroundColor: colors.primary }]} onPress={handleReplay}>
            <Text style={styles.replayText}>{t("match.replay")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.muted }]}>{t("match.progressLabel")}</Text>
            <Text style={[styles.progressValue, { color: colors.primary }]}>{progressText}</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progressRatio * 100}%` }]} />
          </View>
          <Text style={[styles.progressHint, { color: colors.muted }]}>{t("match.tapPairs")}</Text>
        </View>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={[styles.columnTitle, { color: colors.muted }]}>{t("match.terms")}</Text>
            {terms
              .filter((item) => !matched.has(item.cardId))
              .map((item) => {
                const isMatched = matched.has(item.cardId);
                const isSelected = selectedTerm === item.cardId;
                const cardBackground = isMatched
                  ? withAlpha(colors.accent, "1A")
                  : isSelected
                    ? withAlpha(colors.primary, "1A")
                    : colors.card;
                const cardBorder = isMatched ? colors.accent : isSelected ? colors.primary : colors.border;
                return (
                  <TouchableOpacity
                    key={item.cardId}
                    style={[styles.cardButton, { borderColor: cardBorder, backgroundColor: cardBackground }]}
                    onPress={() => handleSelectTerm(item.cardId)}
                    disabled={isMatched}
                    activeOpacity={0.85}
                  >
                    {isSelected ? (
                      <View style={[styles.cardBadge, { backgroundColor: colors.primary }]}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    ) : null}
                    <MarkdownText
                      value={item.label}
                      color={isMatched ? colors.accent : isSelected ? colors.primary : colors.text}
                      mutedColor={colors.muted}
                      accentColor={colors.accent}
                      textAlign="center"
                      fontSize={15}
                      pointerEvents="none"
                    />
                  </TouchableOpacity>
                );
              })}
          </View>

          <View style={styles.column}>
            <Text style={[styles.columnTitle, { color: colors.muted }]}>{t("match.definitions")}</Text>
            {definitions
              .filter((item) => !matched.has(item.cardId))
              .map((item) => {
                const isMatched = matched.has(item.cardId);
                const isSelected = selectedDefinition === item.cardId;
                const cardBackground = isMatched
                  ? withAlpha(colors.accent, "1A")
                  : isSelected
                    ? withAlpha(colors.primary, "1A")
                    : colors.card;
                const cardBorder = isMatched ? colors.accent : isSelected ? colors.primary : colors.border;
                return (
                  <TouchableOpacity
                    key={item.cardId}
                    style={[styles.cardButton, { borderColor: cardBorder, backgroundColor: cardBackground }]}
                    onPress={() => handleSelectDefinition(item.cardId)}
                    disabled={isMatched}
                    activeOpacity={0.85}
                  >
                    {isSelected ? (
                      <View style={[styles.cardBadge, { backgroundColor: colors.primary }]}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    ) : null}
                    <MarkdownText
                      value={item.label}
                      color={isMatched ? colors.accent : isSelected ? colors.primary : colors.text}
                      mutedColor={colors.muted}
                      accentColor={colors.accent}
                      textAlign="center"
                      fontSize={15}
                      pointerEvents="none"
                    />
                  </TouchableOpacity>
                );
              })}
          </View>
        </View>
      </ScrollView>

      {finished ? (
        <View style={styles.overlay} pointerEvents="auto">
          <View style={[styles.overlayBackdrop, { backgroundColor: withAlpha(colors.background, "E6") }]} />
          <View style={[styles.overlayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.trophyWrap, { backgroundColor: withAlpha(colors.primary, "1A") }]}>
              <Ionicons name="trophy" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.overlayTitle, { color: colors.text }]}>{t("match.boardClearedTitle")}</Text>
            <Text style={[styles.overlaySubtitle, { color: colors.muted }]}>{t("match.boardClearedSubtitle")}</Text>
            <View style={[styles.statsRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <View style={styles.statsColumn}>
                <Text style={[styles.statsLabel, { color: colors.muted }]}>{t("match.finalTimeLabel")}</Text>
                <Text style={[styles.statsValue, { color: colors.text }]}>{formatStopwatch(lastTime, true)}</Text>
              </View>
              <View style={[styles.statsDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statsColumn}>
                {bestTime && lastTime && bestTime === lastTime ? (
                  <View style={[styles.recordPill, { backgroundColor: colors.accent }]}>
                    <Text style={styles.recordText}>{t("match.newRecord")}</Text>
                  </View>
                ) : null}
                <Text style={[styles.statsLabel, { color: colors.muted }]}>{t("match.best")}</Text>
                <Text style={[styles.statsValue, { color: colors.accent }]}>{formatStopwatch(bestTime, true)}</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={handleReplay}>
              <Ionicons name="reload" size={18} color="#fff" />
              <Text style={styles.primaryText}>{t("match.playAgain")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.secondary }]}
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate("DeckOverview", { deckId });
                }
              }}
            >
              <Text style={[styles.secondaryText, { color: colors.text }]}>{t("study.backToDeck")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 16, gap: 16, paddingBottom: 32 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  timerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  timerCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  timerValue: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  timerLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2, marginTop: 6 },
  timerSeparator: { fontSize: 24, fontWeight: "700" },
  bestRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  bestPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
  },
  bestText: { fontSize: 12, fontWeight: "600" },
  replayButton: {
    borderRadius: 14,
    paddingHorizontal: 18,
    justifyContent: "center",
    paddingVertical: 10,
    alignItems: "center",
  },
  replayText: { color: "#fff", fontWeight: "700" },
  progressSection: { gap: 10 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { fontSize: 13, fontWeight: "700" },
  progressValue: { fontSize: 13, fontWeight: "700" },
  progressTrack: { height: 8, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%" },
  progressHint: { fontSize: 13, textAlign: "center" },
  columns: { flexDirection: "row", gap: 12 },
  column: { flex: 1, gap: 10 },
  columnTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  cardButton: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    minHeight: 88,
    justifyContent: "center",
  },
  cardBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  overlayBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  overlayCard: {
    width: "100%",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
  },
  trophyWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  overlaySubtitle: { fontSize: 14, textAlign: "center" },
  statsRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  statsColumn: { flex: 1, alignItems: "center", gap: 6 },
  statsLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  statsValue: { fontSize: 20, fontWeight: "800" },
  statsDivider: { width: 1, marginHorizontal: 8 },
  recordPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  recordText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  primaryButton: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  secondaryButton: {
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    alignSelf: "stretch",
  },
  secondaryText: { fontWeight: "700" },
});
