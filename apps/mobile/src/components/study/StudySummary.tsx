import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";

import type { usePalette } from "../../theme";
import { formatDuration } from "../../utils/study";

type Tally = Readonly<{ again: number; hard: number; good: number; easy: number }>;

type Props = Readonly<{
  colors: ReturnType<typeof usePalette>;
  totalCards: number;
  sessionDurationMs: number | null;
  tally: Tally;
  isDeckFullyLearned: boolean | null;
  onRestart: () => void;
  onBack: () => void;
}>;

export function StudySummary(props: Props) {
  const { t } = useTranslation();
  const totalRated = props.tally.again + props.tally.hard + props.tally.good + props.tally.easy;
  const accuracyPercent = totalRated > 0 ? Math.round(((totalRated - props.tally.again) / totalRated) * 100) : 0;

  return (
    <View style={[styles.screen, { backgroundColor: props.colors.background }]}>
      <ScrollView contentContainerStyle={styles.summaryContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.trophyBadge, { backgroundColor: props.colors.primary }]}>
          <Ionicons name="trophy-outline" size={36} color="#fff" />
        </View>
        <Text style={[styles.summaryTitle, { color: props.colors.text }]}>{t("study.sessionCompleteTitle")}</Text>
        <Text style={[styles.summarySubtitle, { color: props.colors.muted }]}>{t("study.sessionCompleteSubtitle")}</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: props.colors.card, borderColor: props.colors.border }]}>
            <Text style={[styles.statValue, { color: props.colors.text }]}>{props.totalCards}</Text>
            <Text style={[styles.statLabel, { color: props.colors.muted }]}>{t("study.cardsLabel")}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: props.colors.card, borderColor: props.colors.border }]}>
            <Text style={[styles.statValue, { color: props.colors.text }]}>
              {props.sessionDurationMs ? formatDuration(props.sessionDurationMs, t) : t("study.timeShort", "0m")}
            </Text>
            <Text style={[styles.statLabel, { color: props.colors.muted }]}>{t("study.timeLabel")}</Text>
          </View>
        </View>
        <View style={[styles.accuracyCard, { backgroundColor: props.colors.card, borderColor: props.colors.border }]}>
          <View style={styles.accuracyHeader}>
            <Text style={[styles.accuracyTitle, { color: props.colors.text }]}>{t("study.accuracyLabel")}</Text>
            <Text style={[styles.accuracyValue, { color: props.colors.accent }]}>{accuracyPercent}%</Text>
          </View>
          {totalRated > 0 ? (
            <View style={styles.accuracyBar}>
              {props.tally.again > 0 ? (
                <View style={[styles.accuracySegment, { flex: props.tally.again, backgroundColor: "#f87171" }]} />
              ) : null}
              {props.tally.hard > 0 ? (
                <View style={[styles.accuracySegment, { flex: props.tally.hard, backgroundColor: "#f59e0b" }]} />
              ) : null}
              {props.tally.good > 0 ? (
                <View style={[styles.accuracySegment, { flex: props.tally.good, backgroundColor: props.colors.primary }]} />
              ) : null}
              {props.tally.easy > 0 ? (
                <View style={[styles.accuracySegment, { flex: props.tally.easy, backgroundColor: "#22d3ee" }]} />
              ) : null}
            </View>
          ) : (
            <View style={[styles.accuracyEmpty, { backgroundColor: props.colors.secondary }]} />
          )}
          <View style={styles.accuracyLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#f87171" }]} />
              <Text style={[styles.legendText, { color: props.colors.muted }]}>{t("study.again")}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#f59e0b" }]} />
              <Text style={[styles.legendText, { color: props.colors.muted }]}>{t("study.hard")}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: props.colors.primary }]} />
              <Text style={[styles.legendText, { color: props.colors.muted }]}>{t("study.good")}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#22d3ee" }]} />
              <Text style={[styles.legendText, { color: props.colors.muted }]}>{t("study.easy")}</Text>
            </View>
          </View>
        </View>
        <View style={styles.summaryActions}>
          {props.isDeckFullyLearned !== true ? (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: props.colors.primary }]}
              onPress={props.onRestart}
            >
              <Text style={styles.primaryText}>{t("study.restartSession")}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.secondaryButton, { borderColor: props.colors.border }]} onPress={props.onBack}>
            <Text style={[styles.secondaryText, { color: props.colors.text }]}>{t("study.backToDeck")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
  summaryContent: {
    paddingBottom: 24,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 16,
    flexGrow: 1,
    justifyContent: "center",
  },
  trophyBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTitle: { fontSize: 22, fontWeight: "700" },
  summarySubtitle: { fontSize: 14, textAlign: "center" },
  statsRow: { flexDirection: "row", gap: 12, width: "100%" },
  statCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: "center", gap: 4 },
  statValue: { fontSize: 22, fontWeight: "700" },
  statLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase" },
  accuracyCard: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  accuracyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accuracyTitle: { fontSize: 14, fontWeight: "700" },
  accuracyValue: { fontSize: 14, fontWeight: "700" },
  accuracyBar: { flexDirection: "row", height: 8, borderRadius: 999, overflow: "hidden" },
  accuracySegment: { height: "100%" },
  accuracyEmpty: { height: 8, borderRadius: 999, width: "100%" },
  accuracyLegend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 11, fontWeight: "600" },
  summaryActions: { width: "100%", gap: 12, marginTop: 8 },
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

export default StudySummary;
