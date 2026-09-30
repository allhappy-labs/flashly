import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimatedStyle,
} from "react-native-reanimated";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";

import AudioProgressButton from "../AudioProgressButton";
import ImageBottomGradient from "../ImageBottomGradient";
import MarkdownText from "../MarkdownText";
import { APP_CAPABILITIES } from "../../config/app-mode";
import { useLocalFileAvailability } from "../../hooks/useLocalFileAvailability";
import type { Card } from "../../types/models";
import { usableMediaUri } from "../../utils/media-policy";
import type { usePalette } from "../../theme";

type Props = Readonly<{
  card: Card;
  showBack: boolean;
  colors: ReturnType<typeof usePalette>;
  onToggle: () => void;
  onToggleStar: (cardId: string, nextStarred: boolean) => void;
  onPlayAudio?: (uri: string) => void;
  interactive: boolean;
  showSwipeHints: boolean;
  showScoreLine?: boolean;
  scoreProgress?: number;
  scoreColor?: string;
  swipeBorderStyle?: AnimatedStyle<ViewStyle>;
}>;

type GenderIconButtonProps = Readonly<{
  gender: string;
  colors: ReturnType<typeof usePalette>;
  size?: number;
}>;

function GenderIconButton(props: GenderIconButtonProps) {
  const size = props.size ?? 34;
  const trimmed = props.gender.trim();
  const lower = trimmed.toLowerCase();
  let letter = trimmed.slice(0, 1).toUpperCase();

  if (["m", "masc", "masculine"].includes(lower)) letter = "M";
  else if (["f", "fem", "feminine"].includes(lower)) letter = "F";
  else if (["n", "neut", "neuter", "neutral"].includes(lower)) letter = "N";
  else if (["c", "com", "common"].includes(lower)) letter = "C";

  let label = trimmed;
  if (["m", "masc", "masculine"].includes(lower)) label = "Masculine";
  else if (["f", "fem", "feminine"].includes(lower)) label = "Feminine";
  else if (["n", "neut", "neuter", "neutral"].includes(lower)) label = "Neuter";
  else if (["c", "com", "common"].includes(lower)) label = "Common";

  return (
    <View
      style={[
        styles.genderIconButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: props.colors.card,
          borderColor: props.colors.border,
        },
      ]}
      accessibilityLabel={`Gender: ${label}`}
    >
      <Text style={[styles.genderIconText, { color: props.colors.primary }]}>{letter}</Text>
    </View>
  );
}

const StudyCard = React.memo(function StudyCard(props: Props) {
  const { t } = useTranslation();
  const trimmedImageUrl = usableMediaUri(props.card.imageUrl, APP_CAPABILITIES.remoteMedia) ?? "";
  const trimmedAudioUrl = usableMediaUri(props.card.audioUrl, APP_CAPABILITIES.remoteMedia) ?? "";
  const imageAvailable = useLocalFileAvailability(trimmedImageUrl);
  const hasImage = Boolean(trimmedImageUrl && imageAvailable);
  const hasAudio = Boolean(trimmedAudioUrl);
  const hasGender = Boolean(props.card.gender?.trim());
  const scoreProgress = Math.max(0, Math.min(1, props.scoreProgress ?? 0));
  const [scoreTrackWidth, setScoreTrackWidth] = useState(0);
  const scoreProgressValue = useSharedValue(scoreProgress);

  useEffect(() => {
    scoreProgressValue.value = withTiming(scoreProgress, {
      duration: 140,
      easing: Easing.out(Easing.quad),
    });
  }, [scoreProgress, scoreProgressValue]);

  const scoreFillAnimatedStyle = useAnimatedStyle(() => ({
    width: scoreTrackWidth * scoreProgressValue.value,
  }));

  return (
    <View style={styles.cardContentShell}>
      <Pressable
        onPress={props.onToggle}
        accessibilityRole="button"
        accessibilityLabel={t("study.tapToReveal")}
        style={styles.cardPressable}
        pointerEvents={props.interactive ? "auto" : "none"}
      >
        <View
          style={[
            styles.cardSurface,
            { backgroundColor: props.colors.card, borderColor: props.colors.border },
          ]}
        >
          <View style={styles.cardActions}>
            {hasAudio ? (
              <AudioProgressButton
                uri={trimmedAudioUrl}
                backgroundColor={props.colors.card}
                borderColor={props.colors.border}
                iconColor={props.colors.primary}
                size={34}
                iconSize={16}
                disabled={!props.interactive}
                onPress={() => {
                  props.onPlayAudio?.(trimmedAudioUrl);
                }}
              />
            ) : null}
            {hasGender ? (
              <GenderIconButton gender={props.card.gender ?? ""} colors={props.colors} size={34} />
            ) : null}
            <TouchableOpacity
              style={[styles.starButton, { backgroundColor: props.colors.card, borderColor: props.colors.border }]}
              onPress={(event) => {
                event.stopPropagation();
                props.onToggleStar(props.card.id, !props.card.isStarred);
              }}
              disabled={!props.interactive}
            >
              <Ionicons
                name={props.card.isStarred ? "star" : "star-outline"}
                size={18}
                color={props.card.isStarred ? props.colors.primary : props.colors.muted}
              />
            </TouchableOpacity>
          </View>
          {props.showBack ? (
            <View style={styles.answerWrap}>
              {hasImage ? (
                <View
                  style={[
                    styles.imageFrame,
                    styles.imageFrameWithStar,
                    { backgroundColor: props.colors.secondary },
                  ]}
                >
                  <Image source={{ uri: trimmedImageUrl }} style={styles.image} resizeMode="cover" />
                  <ImageBottomGradient />
                </View>
              ) : null}
              <View style={styles.answerContent}>
                <Text style={[styles.sectionLabel, { color: props.colors.muted }]}>
                  {t("study.questionLabel")}
                </Text>
                <MarkdownText
                  value={props.card.front}
                  color={props.colors.muted}
                  mutedColor={props.colors.muted}
                  accentColor={props.colors.accent}
                  textAlign="left"
                  fontSize={16}
                />
                <View style={styles.answerDivider} />
                <Text style={[styles.sectionLabel, { color: props.colors.muted }]}>
                  {t("study.answerLabel")}
                </Text>
                <MarkdownText
                  value={props.card.back}
                  color={props.colors.text}
                  mutedColor={props.colors.muted}
                  accentColor={props.colors.accent}
                  textAlign="left"
                  fontSize={26}
                />
                {props.card.example ? (
                  <Text style={[styles.example, { color: props.colors.muted }]}>"{props.card.example}"</Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.questionWrap}>
              {props.card.category ? (
                <Text style={[styles.category, { color: props.colors.muted }]}>{props.card.category}</Text>
              ) : null}
              <MarkdownText
                value={props.card.front}
                color={props.colors.text}
                mutedColor={props.colors.muted}
                accentColor={props.colors.accent}
                textAlign="center"
                fontSize={28}
              />
              <Text style={[styles.tapHint, { color: props.colors.muted }]}>{t("study.tapToReveal")}</Text>
            </View>
          )}
          {props.interactive && props.showSwipeHints ? (
            <View style={styles.swipeHintRow} pointerEvents="none">
              <View style={[styles.swipeHintPill, { backgroundColor: props.colors.secondary }]}>
                <Text style={[styles.swipeHintText, { color: props.colors.muted }]}>
                  {`${t("study.swipeLeftHint")} · ${t("study.swipeRightHint")}`}
                </Text>
              </View>
            </View>
          ) : null}
          {props.showScoreLine ? (
            <View style={styles.scoreLineWrap} pointerEvents="none">
              <View
                style={[styles.scoreLineTrack, { backgroundColor: props.colors.border }]}
                onLayout={(event) => {
                  setScoreTrackWidth(event.nativeEvent.layout.width);
                }}
              >
                <Animated.View
                  style={[
                    styles.scoreLineFill,
                    scoreFillAnimatedStyle,
                    {
                      backgroundColor: props.scoreColor ?? props.colors.primary,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}
          {props.swipeBorderStyle ? (
            <Animated.View style={[styles.swipeBorder, props.swipeBorderStyle]} pointerEvents="none" />
          ) : null}
        </View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  cardContentShell: { flex: 1 },
  cardSurface: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    width: "100%",
    overflow: "hidden",
  },
  cardActions: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    gap: 8,
    zIndex: 2,
  },
  starButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  genderIconButton: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  genderIconText: { fontSize: 11, fontWeight: "700" },
  cardPressable: { flex: 1, width: "100%" },
  questionWrap: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 16 },
  category: { fontSize: 12, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" },
  tapHint: { fontSize: 12, fontWeight: "500" },
  swipeHintRow: {
    position: "absolute",
    bottom: 14,
    left: 16,
    right: 16,
    alignItems: "center",
  },
  swipeHintPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    opacity: 0.85,
  },
  swipeHintText: { fontSize: 11, fontWeight: "600" },
  scoreLineWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  scoreLineTrack: {
    height: 4,
    borderRadius: 0,
    overflow: "hidden",
  },
  scoreLineFill: {
    height: "100%",
    borderRadius: 0,
  },
  swipeBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent",
  },
  answerWrap: { flex: 1 },
  imageFrame: { width: "100%", height: 160, position: "relative" },
  imageFrameWithStar: { marginTop: 30 },
  image: { width: "100%", height: "100%" },
  answerContent: { padding: 20, gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  answerDivider: { height: 1, backgroundColor: "rgba(148, 163, 184, 0.2)" },
  example: { fontStyle: "italic", fontSize: 13 },
});

export default StudyCard;
