import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { GestureDetector } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_CAPABILITIES } from "../config/app-mode";
import { setCardStarred } from "../db/deckRepositorySafe";
import type { DeckStackParamList } from "../navigation/types";
import { useStore } from "../store/useStore";
import { useAppColorScheme, usePalette } from "../theme";
import { Rating } from "ts-fsrs";
import { stopAudioPlayback, toggleAudioPlayback } from "../services/audioPlayer";
import { computeTimeGradingResult, updateTimeEmaMs } from "../utils/timeGrading";
import { loadDeckTimeGradingEma, saveDeckTimeGradingEma } from "../services/timeGrading";
import { STUDY_SWIPE_HINT_DISMISSED_KEY } from "../constants";
import StudyCard from "../components/study/StudyCard";
import StudyCaughtUpState from "../components/study/StudyCaughtUpState";
import StudyEmptyState from "../components/study/StudyEmptyState";
import StudySummary from "../components/study/StudySummary";
import { useSwipeCardStack } from "../hooks/useSwipeCardStack";
import { useSwipeHints } from "../hooks/useSwipeHints";
import { useStudySession } from "../hooks/useStudySession";
import { logger } from "../utils/logger";
import { usableMediaUri } from "../utils/media-policy";

type Props = NativeStackScreenProps<DeckStackParamList, "Study">;
type RateActionOptions = Readonly<{
  effectiveMs?: number;
}>;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function StudyScreen(props: Props) {
  const deckId = props.route.params.deckId;
  const navigation = props.navigation;
  const { t } = useTranslation();
  const [showBack, setShowBack] = useState(false);
  const recordStudy = useStore((state) => state.recordStudy);
  const dailyGoal = useStore((state) => state.dailyGoal);
  const allowExtraNew = useStore((state) => state.allowExtraNew);
  const timeGradingConfig = useStore((state) => state.timeGradingConfig);
  const colors = usePalette();
  const scheme = useAppColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = scheme === "dark";
  const [cardWidth, setCardWidth] = useState(0);
  const [ratingHint, setRatingHint] = useState<string | null>(null);
  const [scorePreview, setScorePreview] = useState<{ progress: number; rating: Rating } | null>(null);
  const shownAtRef = useRef<number | null>(null);
  const revealedAtRef = useRef<number | null>(null);
  const deckEmaMsRef = useRef<number | null>(null);
  const swipeLockedRef = useRef(false);
  const ratingHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scorePreviewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ratingHintOpacity = useSharedValue(0);
  const ratingHintTranslate = useSharedValue(8);
  const ratingHintScale = useSharedValue(0.96);
  const { showSwipeHints, registerSwipe } = useSwipeHints({ storageKey: STUDY_SWIPE_HINT_DISMISSED_KEY });

  const handlePlayAudio = useCallback((uri: string) => {
    const playableUri = usableMediaUri(uri, APP_CAPABILITIES.remoteMedia);
    if (playableUri) {
      void toggleAudioPlayback(playableUri);
    }
  }, []);
  const {
    loading,
    sessionCards,
    currentCard,
    index,
    totalCards,
    tally,
    deckName,
    nextReviewAt,
    deckCardCount,
    isDeckFullyLearned,
    sessionDurationMs,
    finished,
    handleRate,
    restartSession,
    finalizeSession,
    answeredCountRef,
    updateCard,
  } = useStudySession({ deckId, dailyGoal, allowExtraNew });

  useEffect(() => {
    void stopAudioPlayback();
    return () => {
      void stopAudioPlayback();
    };
  }, [currentCard?.id]);

  useEffect(() => {
    let active = true;
    loadDeckTimeGradingEma(deckId).then((value) => {
      if (!active) return;
      deckEmaMsRef.current = value;
    });
    return () => {
      active = false;
    };
  }, [deckId]);

  useEffect(() => {
    if (!currentCard) return;
    shownAtRef.current = Date.now();
    revealedAtRef.current = null;
    setShowBack(false);
  }, [currentCard?.id, index]);

  useEffect(() => {
    if (!ratingHint) {
      ratingHintOpacity.value = 0;
      ratingHintTranslate.value = 8;
      ratingHintScale.value = 0.96;
      return;
    }
    ratingHintOpacity.value = 0;
    ratingHintTranslate.value = 8;
    ratingHintScale.value = 0.96;
    ratingHintOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    ratingHintTranslate.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    ratingHintScale.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [ratingHint, ratingHintOpacity, ratingHintScale, ratingHintTranslate]);

  useEffect(() => {
    return () => {
      if (ratingHintTimerRef.current) {
        clearTimeout(ratingHintTimerRef.current);
        ratingHintTimerRef.current = null;
      }
      if (scorePreviewIntervalRef.current) {
        clearInterval(scorePreviewIntervalRef.current);
        scorePreviewIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    navigation.setOptions({ headerShown: true, title: deckName ?? t("study.title") });
  }, [deckName, navigation, t]);

  useEffect(() => {
    const sub = navigation.addListener("beforeRemove", () => {
      void (async () => {
        if (answeredCountRef.current > 0) {
          await recordStudy(deckId);
        }
        await finalizeSession();
      })();
    });
    return sub;
  }, [deckId, finalizeSession, navigation, recordStudy]);

  const handleRestart = useCallback(() => {
    void restartSession();
  }, [restartSession]);

  const updateScorePreview = useCallback(
    (now?: number) => {
      if (!currentCard || !timeGradingConfig.enabled) {
        setScorePreview(null);
        return;
      }
      const timestamp = now ?? Date.now();
      const shownAt = shownAtRef.current ?? timestamp;
      const revealAt = revealedAtRef.current ?? timestamp;
      const elapsedMs = Math.max(0, revealAt - shownAt);
      const result = computeTimeGradingResult({
        cardState: currentCard.state,
        answerTimeMs: elapsedMs,
        deckEmaMs: deckEmaMsRef.current,
        config: timeGradingConfig,
      });
      const windowMs = Math.max(1, result.targetMs * timeGradingConfig.thresholds.good * 1.4);
      const progress = 1 - clampNumber(result.effectiveMs / windowMs, 0, 1);
      setScorePreview({ progress, rating: result.rating });
    },
    [currentCard, timeGradingConfig],
  );

  const handleToggleCard = useCallback(() => {
    if (!currentCard) return;
    if (!revealedAtRef.current) {
      const revealedAt = Date.now();
      revealedAtRef.current = revealedAt;
      updateScorePreview(revealedAt);
      if (scorePreviewIntervalRef.current) {
        clearInterval(scorePreviewIntervalRef.current);
        scorePreviewIntervalRef.current = null;
      }
    }
    setShowBack((prev) => !prev);
  }, [currentCard, updateScorePreview]);

  const handleToggleStar = useCallback(async (cardId: string, nextStarred: boolean) => {
    const result = await setCardStarred(cardId, nextStarred);
    if (result.isErr()) {
      logger.error('Failed to set card starred:', result.error.message);
      return;
    }
    updateCard(cardId, (card) => ({ ...card, isStarred: nextStarred }));
  }, [updateCard]);

  const getRatingLabel = useCallback((rating: Rating) => {
    if (rating === Rating.Again) return t("study.again");
    if (rating === Rating.Hard) return t("study.hard");
    if (rating === Rating.Good) return t("study.good");
    return t("study.easy");
  }, [t]);

  const showRatingHintMessage = useCallback((rating: Rating) => {
    setRatingHint(t("study.ratingHint", { rating: getRatingLabel(rating) }));
    if (ratingHintTimerRef.current) clearTimeout(ratingHintTimerRef.current);
    ratingHintTimerRef.current = setTimeout(() => {
      setRatingHint(null);
    }, 900);
  }, [getRatingLabel, t]);

  const commitRating = useCallback(
    async (rating: Rating, rateOptions?: RateActionOptions) => {
      if (swipeLockedRef.current || finished || !currentCard) return;
      swipeLockedRef.current = true;
      registerSwipe();
      showRatingHintMessage(rating);

      if (timeGradingConfig.enabled && typeof rateOptions?.effectiveMs === "number" && Number.isFinite(rateOptions.effectiveMs)) {
        const nextEma = updateTimeEmaMs(deckEmaMsRef.current, rateOptions.effectiveMs, timeGradingConfig.emaAlpha);
        deckEmaMsRef.current = nextEma;
        if (nextEma) {
          void saveDeckTimeGradingEma(deckId, nextEma);
        }
      }

      try {
        await handleRate(rating, { onAfterRate: () => setShowBack(false) });
      } finally {
        swipeLockedRef.current = false;
      }
    },
    [currentCard, deckId, finished, handleRate, registerSwipe, showRatingHintMessage, timeGradingConfig],
  );

  const handleRatePress = useCallback(async (rating: Rating) => {
    if (!currentCard) return;
    if (rating === Rating.Again || !timeGradingConfig.enabled) {
      await commitRating(rating);
      return;
    }
    const now = Date.now();
    const shownAt = shownAtRef.current ?? now;
    const revealAt = revealedAtRef.current ?? now;
    const answerTimeMs = Math.max(0, revealAt - shownAt);
    const result = computeTimeGradingResult({
      cardState: currentCard.state,
      answerTimeMs,
      deckEmaMs: deckEmaMsRef.current,
      config: timeGradingConfig,
    });
    await commitRating(rating, { effectiveMs: result.effectiveMs });
  }, [commitRating, currentCard, timeGradingConfig]);

  const handleSwipe = useCallback(
    async (direction: "left" | "right") => {
      if (finished || !currentCard) return;
      if (direction === "left") {
        await commitRating(Rating.Again);
        return;
      }
      if (!timeGradingConfig.enabled) {
        await commitRating(Rating.Good);
        return;
      }
      const now = Date.now();
      const shownAt = shownAtRef.current ?? now;
      const revealAt = revealedAtRef.current ?? now;
      const answerTimeMs = Math.max(0, revealAt - shownAt);
      const result = computeTimeGradingResult({
        cardState: currentCard.state,
        answerTimeMs,
        deckEmaMs: deckEmaMsRef.current,
        config: timeGradingConfig,
      });
      await commitRating(result.rating, { effectiveMs: result.effectiveMs });
    },
    [commitRating, currentCard, finished, timeGradingConfig],
  );

  useEffect(() => {
    if (!currentCard || !timeGradingConfig.enabled) {
      setScorePreview(null);
      if (scorePreviewIntervalRef.current) {
        clearInterval(scorePreviewIntervalRef.current);
        scorePreviewIntervalRef.current = null;
      }
      return;
    }
    if (scorePreviewIntervalRef.current) {
      clearInterval(scorePreviewIntervalRef.current);
    }
    updateScorePreview();
    scorePreviewIntervalRef.current = setInterval(() => {
      if (revealedAtRef.current) {
        if (scorePreviewIntervalRef.current) {
          clearInterval(scorePreviewIntervalRef.current);
          scorePreviewIntervalRef.current = null;
        }
        return;
      }
      updateScorePreview();
    }, 60);
    return () => {
      if (scorePreviewIntervalRef.current) {
        clearInterval(scorePreviewIntervalRef.current);
        scorePreviewIntervalRef.current = null;
      }
    };
  }, [currentCard?.id, timeGradingConfig, updateScorePreview]);

  const {
    gesture: swipeGesture,
    activeCardStyle,
    nextCardStyle,
    isAnimating,
    translateX,
    swipeThreshold,
  } = useSwipeCardStack({
    enabled: Boolean(currentCard) && !finished && !loading,
    cardWidth,
    onSwipe: handleSwipe,
    currentIndex: index,
    totalCards,
    enforceBounds: false,
    resetKey: currentCard ? `${currentCard.id}-${index}` : index,
  });

  const progressRatio = totalCards > 0 ? Math.min((Math.min(index + 1, totalCards)) / totalCards, 1) : 0;
  const progressCount = `${Math.min(index + 1, totalCards)} / ${totalCards}`;
  const [previewCard, setPreviewCard] = useState<typeof currentCard | null>(null);
  const desiredPreviewCard = useMemo(() => sessionCards[index + 1] ?? null, [index, sessionCards]);
  const ratingHintAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ratingHintOpacity.value,
    transform: [{ translateY: ratingHintTranslate.value }, { scale: ratingHintScale.value }],
  }));
  const swipeBorderStyle = useAnimatedStyle(() => {
    const threshold = Math.max(1, swipeThreshold);
    const clamped = Math.max(-threshold, Math.min(threshold, translateX.value));
    const borderColor = interpolateColor(
      clamped,
      [-threshold, 0, threshold],
      [colors.danger, "rgba(0,0,0,0)", "#34d399"],
    );
    return { borderColor };
  }, [colors.danger, swipeThreshold, translateX]);
  const scoreLineColor = useMemo(() => {
    if (!scorePreview) return colors.border;
    switch (scorePreview.rating) {
      case Rating.Easy:
        return colors.primary;
      case Rating.Good:
        return "#34d399";
      case Rating.Hard:
        return "#f59e0b";
      case Rating.Again:
        return colors.danger;
      default:
        return colors.primary;
    }
  }, [colors, scorePreview]);
  const showScoreLine = timeGradingConfig.enabled && Boolean(scorePreview);

  useEffect(() => {
    if (isAnimating) return;
    setPreviewCard(desiredPreviewCard);
  }, [desiredPreviewCard, isAnimating]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!sessionCards.length) {
    if (deckCardCount === 0) {
      return <StudyEmptyState colors={colors} />;
    }
    return (
      <StudyCaughtUpState
        colors={colors}
        nextReviewAt={nextReviewAt}
        onBrowse={() => navigation.navigate("Browse", { deckId })}
        onExplore={() => navigation.navigate("DeckList")}
      />
    );
  }

  if (finished) {
    return (
      <StudySummary
        colors={colors}
        totalCards={totalCards}
        sessionDurationMs={sessionDurationMs}
        tally={tally}
        isDeckFullyLearned={isDeckFullyLearned}
        onRestart={handleRestart}
        onBack={async () => {
          if (answeredCountRef.current > 0) {
            await recordStudy(deckId);
          }
          await finalizeSession();
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate("DeckOverview", { deckId });
          }
        }}
      />
    );
  }

  return (
    <View
      style={[styles.screen, { backgroundColor: colors.background }]}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        setCardWidth(width > 32 ? width - 32 : width);
      }}
    >
      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={[styles.progressLabel, { color: colors.muted }]}>{t("study.progressLabel")}</Text>
          <Text style={[styles.progressCount, { color: colors.muted }]}>{progressCount}</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: isDark ? colors.secondary : "#cbd5e1" }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progressRatio * 100}%` }]} />
        </View>
      </View>

      <View style={styles.cardStack}>
        {previewCard ? (
          <Animated.View key={previewCard.id} style={[styles.cardShell, nextCardStyle]}>
            <StudyCard
              card={previewCard}
              showBack={false}
              colors={colors}
              onToggle={handleToggleCard}
              onToggleStar={handleToggleStar}
              onPlayAudio={handlePlayAudio}
              interactive={false}
              showSwipeHints={false}
              showScoreLine={false}
            />
          </Animated.View>
        ) : null}
        {currentCard ? (
          <GestureDetector gesture={swipeGesture}>
            <Animated.View key={currentCard.id} style={[styles.cardShell, activeCardStyle]}>
              <StudyCard
                card={currentCard}
                showBack={showBack}
                colors={colors}
                onToggle={handleToggleCard}
                onToggleStar={handleToggleStar}
                onPlayAudio={handlePlayAudio}
                interactive
                showSwipeHints={showSwipeHints && !ratingHint}
                showScoreLine={showScoreLine}
                scoreProgress={scorePreview?.progress}
                scoreColor={scoreLineColor}
                swipeBorderStyle={swipeBorderStyle}
              />
            </Animated.View>
          </GestureDetector>
        ) : null}
        {ratingHint ? (
          <Animated.View
            style={[
              styles.ratingHintPill,
              ratingHintAnimatedStyle,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.ratingHintText, { color: colors.text }]}>{ratingHint}</Text>
          </Animated.View>
        ) : null}
      </View>

      {currentCard ? (
        <View
          style={[
            styles.gradingDock,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.background,
              paddingBottom: Math.max(10, insets.bottom + 4),
            },
          ]}
        >
          <View style={styles.gradingRow}>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.gradeButton, { borderColor: colors.danger, backgroundColor: "rgba(248, 113, 113, 0.14)" }]}
              onPress={() => {
                void handleRatePress(Rating.Again);
              }}
              activeOpacity={0.85}
              hitSlop={6}
            >
              <Text style={[styles.gradeButtonText, { color: colors.text }]}>{t("study.again")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.gradeButton, { borderColor: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.14)" }]}
              onPress={() => {
                void handleRatePress(Rating.Hard);
              }}
              activeOpacity={0.85}
              hitSlop={6}
            >
              <Text style={[styles.gradeButtonText, { color: colors.text }]}>{t("study.hard")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.gradeButton, { borderColor: "#34d399", backgroundColor: "rgba(52, 211, 153, 0.14)" }]}
              onPress={() => {
                void handleRatePress(Rating.Good);
              }}
              activeOpacity={0.85}
              hitSlop={6}
            >
              <Text style={[styles.gradeButtonText, { color: colors.text }]}>{t("study.good")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.gradeButton, { borderColor: colors.primary, backgroundColor: "rgba(59, 130, 246, 0.14)" }]}
              onPress={() => {
                void handleRatePress(Rating.Easy);
              }}
              activeOpacity={0.85}
              hitSlop={6}
            >
              <Text style={[styles.gradeButtonText, { color: colors.text }]}>{t("study.easy")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingBottom: 0 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  progressWrap: { gap: 8, marginBottom: 8, marginTop: 12 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
  progressCount: { fontSize: 12, fontWeight: "600" },
  progressTrack: { width: "100%", height: 6, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  cardStack: { flex: 1, position: "relative", marginBottom: 8 },
  cardShell: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  gradingDock: {
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 2,
  },
  gradingRow: { flexDirection: "row", gap: 10 },
  gradeButton: {
    flex: 1,
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  gradeButtonText: { fontSize: 13, fontWeight: "700" },
  ratingHintPill: {
    position: "absolute",
    bottom: 14,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  ratingHintText: { fontSize: 12, fontWeight: "700" },
});
