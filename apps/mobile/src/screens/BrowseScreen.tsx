import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";
import { GestureDetector } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import { APP_CAPABILITIES } from "../config/app-mode";
import { listCards, setCardStarred } from "../db/deckRepositorySafe";
import type { DeckStackParamList } from "../navigation/types";
import type { Card } from "../types/models";
import { usePalette } from "../theme";
import ProgressHeader from "../components/ProgressHeader";
import Ionicons from "@expo/vector-icons/Ionicons";
import { stopAudioPlayback, toggleAudioPlayback } from "../services/audioPlayer";
import StudyCard from "../components/study/StudyCard";
import { useSwipeCardStack } from "../hooks/useSwipeCardStack";
import { useSwipeHints } from "../hooks/useSwipeHints";
import { BROWSE_SWIPE_HINT_DISMISSED_KEY } from "../constants";
import { logger } from "../utils/logger";
import { usableMediaUri } from "../utils/media-policy";

type Props = NativeStackScreenProps<DeckStackParamList, "Browse">;

export default function BrowseScreen(props: Readonly<Props>) {
  const deckId = props.route.params.deckId;
  const navigation = props.navigation;
  const { t } = useTranslation();
  const colors = usePalette();
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cardWidth, setCardWidth] = useState(0);
  const { showSwipeHints, registerSwipe } = useSwipeHints({ storageKey: BROWSE_SWIPE_HINT_DISMISSED_KEY });

  const handlePlayAudio = useCallback((uri: string) => {
    const playableUri = usableMediaUri(uri, APP_CAPABILITIES.remoteMedia);
    if (playableUri) {
      void toggleAudioPlayback(playableUri);
    }
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: t("browse.title") });
  }, [navigation, t]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const result = await listCards(deckId);
      if (!active) return;
      if (result.isErr()) {
        logger.error('Failed to load cards:', result.error.message);
        setCards([]);
        setLoading(false);
        return;
      }
      setCards(result.value);
      setIndex(0);
      setShowBack(false);
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [deckId]);

  useEffect(() => {
    void stopAudioPlayback();
    return () => {
      void stopAudioPlayback();
    };
  }, [index]);

  useEffect(() => {
    if (!cards.length) return;
    if (index <= cards.length - 1) return;
    setIndex(cards.length - 1);
    setShowBack(false);
  }, [cards.length, index]);

  const currentCard = cards[index];
  const desiredPreviewCard = cards[index + 1] ?? cards[index - 1] ?? null;
  const [previewCard, setPreviewCard] = useState<typeof currentCard | null>(null);

  const handleNext = useCallback(() => {
    if (index >= cards.length - 1) return;
    setIndex(index + 1);
    setShowBack(false);
  }, [cards.length, index]);

  const handlePrevious = useCallback(() => {
    if (index <= 0) return;
    setIndex(index - 1);
    setShowBack(false);
  }, [index]);

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      registerSwipe();
      if (direction === "left") {
        handleNext();
      } else {
        handlePrevious();
      }
    },
    [handleNext, handlePrevious, registerSwipe],
  );
  const { gesture: swipeGesture, activeCardStyle, nextCardStyle, isAnimating } = useSwipeCardStack({
    enabled: !loading && Boolean(currentCard),
    cardWidth,
    onSwipe: handleSwipe,
    currentIndex: index,
    totalCards: cards.length,
    enforceBounds: true,
    resetKey: currentCard?.id ?? null,
  });

  useEffect(() => {
    if (isAnimating) return;
    setPreviewCard(desiredPreviewCard);
  }, [desiredPreviewCard, isAnimating]);

  const handleFlip = useCallback(() => {
    if (!currentCard) return;
    setShowBack((prev) => !prev);
  }, [currentCard]);

  const handleToggleStar = useCallback(async (cardId: string, nextStarred: boolean) => {
    const result = await setCardStarred(cardId, nextStarred);
    if (result.isErr()) {
      logger.error('Failed to set card starred:', result.error.message);
      return;
    }
    setCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, isStarred: nextStarred } : card)),
    );
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!cards.length) {
    return (
      <View style={[styles.emptyWrap, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("browse.emptyTitle")}</Text>
        <Text style={[styles.emptyBody, { color: colors.muted }]}>{t("browse.emptyBody")}</Text>
        <TouchableOpacity
          style={[styles.emptyButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate("CardEdit", { deckId })}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.emptyButtonText}>{t("browse.createCard")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentCard) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        setCardWidth(width > 32 ? width - 32 : width);
      }}
    >
      <ProgressHeader
        current={index + 1}
        total={cards.length}
        trackColor={colors.secondary}
        fillColor={colors.primary}
        textColor={colors.muted}
      />

      <View style={styles.cardStack}>
        {previewCard ? (
          <Animated.View key={previewCard.id} style={[styles.cardShell, nextCardStyle]}>
            <StudyCard
              card={previewCard}
              showBack={false}
              colors={colors}
              onToggle={handleFlip}
              onToggleStar={handleToggleStar}
              onPlayAudio={handlePlayAudio}
              interactive={false}
              showSwipeHints={false}
            />
          </Animated.View>
        ) : null}
        <GestureDetector gesture={swipeGesture}>
          <Animated.View key={currentCard.id} style={[styles.cardShell, activeCardStyle]}>
            <StudyCard
              card={currentCard}
              showBack={showBack}
              colors={colors}
              onToggle={handleFlip}
              onToggleStar={handleToggleStar}
              onPlayAudio={handlePlayAudio}
              interactive
              showSwipeHints={showSwipeHints}
            />
          </Animated.View>
        </GestureDetector>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, gap: 12 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  emptyTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyButton: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  cardStack: { flex: 1, position: "relative" },
  cardShell: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
});
