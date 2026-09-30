import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";

import type { usePalette } from "../../theme";
import { formatWaitLabel } from "../../utils/study";

type Props = Readonly<{
  colors: ReturnType<typeof usePalette>;
  nextReviewAt: number | null;
  onBrowse: () => void;
  onExplore: () => void;
}>;

export function StudyCaughtUpState(props: Props) {
  const { t } = useTranslation();
  const now = Date.now();
  const nextReviewLabel = props.nextReviewAt
    ? t("study.nextReviewIn", { value: formatWaitLabel(props.nextReviewAt, now, t) })
    : t("study.nextReviewSoon");

  return (
    <View style={[styles.screen, { backgroundColor: props.colors.background }]}>
      <ScrollView contentContainerStyle={styles.doneContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.doneArtwork, { backgroundColor: props.colors.secondary }]}>
          <Ionicons name="leaf-outline" size={40} color={props.colors.primary} />
        </View>
        <Text style={[styles.doneTitle, { color: props.colors.text }]}>{t("study.allCaughtUpTitle")}</Text>
        <Text style={[styles.doneSubtitle, { color: props.colors.muted }]}>{t("study.allCaughtUpSubtitle")}</Text>
        <View style={[styles.nextReviewPill, { backgroundColor: props.colors.card, borderColor: props.colors.border }]}>
          <Ionicons name="checkmark-circle" size={14} color={props.colors.accent} />
          <Text style={[styles.nextReviewText, { color: props.colors.text }]}>{nextReviewLabel}</Text>
        </View>
        <View style={styles.doneActions}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: props.colors.primary }]}
            onPress={props.onBrowse}
          >
            <Text style={styles.primaryText}>{t("study.browseAllCards")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: props.colors.border, backgroundColor: props.colors.card }]}
            onPress={props.onExplore}
          >
            <Text style={[styles.secondaryText, { color: props.colors.text }]}>{t("study.exploreDecks")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
  doneContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    alignItems: "center",
    gap: 16,
    flexGrow: 1,
    justifyContent: "center",
  },
  doneArtwork: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  doneSubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  nextReviewPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nextReviewText: { fontSize: 12, fontWeight: "600" },
  doneActions: { width: "100%", gap: 12, marginTop: 8 },
  primaryButton: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    width: "100%",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryButton: {
    borderWidth: 1,
    minHeight: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    width: "100%",
  },
  secondaryText: { fontWeight: "600", fontSize: 15 },
});

export default StudyCaughtUpState;
