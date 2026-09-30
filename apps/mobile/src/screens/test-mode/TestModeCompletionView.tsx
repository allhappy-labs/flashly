import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { TFunction } from "i18next";
import { Pie, PolarChart } from "victory-native";
import type { Palette } from "../../theme";
import type { TestQuestion } from "./test-mode-utils";

type Props = {
  colors: Palette;
  t: TFunction;
  score: number;
  questions: TestQuestion[];
  onRestart: () => void;
  onBackToDeck: () => void;
};

export function TestModeCompletionView({ colors, t, score, questions, onRestart, onBackToDeck }: Props) {
  const correct = score;
  const incorrect = questions.filter((question) => question.isCorrect === false).length;
  const total = correct + incorrect;
  const chartData = [
    { label: t("test.correctLabel"), value: correct, color: colors.primary },
    { label: t("test.incorrectLabel", { count: incorrect }), value: incorrect, color: colors.secondary },
  ];
  const scorePercent = total ? Math.round((correct / total) * 100) : 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.resultCard, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t("test.completeTitle")}</Text>
        <View style={styles.chartWrap}>
          <View style={styles.chartCanvas}>
            <PolarChart data={chartData} labelKey="label" valueKey="value" colorKey="color">
              <Pie.Chart innerRadius={52} startAngle={-90} />
            </PolarChart>
          </View>
          <View style={styles.chartLabels}>
            <Text style={[styles.chartValue, { color: colors.text }]}>{`${scorePercent}%`}</Text>
            <Text style={[styles.chartLabel, { color: colors.muted }]}>{t("test.scoreLabel")}</Text>
          </View>
        </View>
        <View style={[styles.scorePill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.scoreItem}>
            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
            <Text style={[styles.scoreText, { color: colors.accent }]}>{correct}</Text>
          </View>
          <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />
          <View style={styles.scoreItem}>
            <Ionicons name="close-circle" size={16} color={colors.danger} />
            <Text style={[styles.scoreText, { color: colors.danger }]}>{incorrect}</Text>
          </View>
        </View>
        <View style={styles.resultActions}>
          <TouchableOpacity style={[styles.ghostButton, { borderColor: colors.border }]} onPress={onRestart}>
            <Ionicons name="refresh" size={16} color={colors.muted} />
            <Text style={[styles.ghostText, { color: colors.muted }]}>{t("test.restart")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, styles.primaryButtonCompact, { backgroundColor: colors.primary }]}
            onPress={onBackToDeck}
          >
            <Text style={styles.primaryText}>{t("study.backToDeck")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, justifyContent: "center", gap: 16 },
  cardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 6,
  },
  resultCard: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    gap: 16,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  chartWrap: { alignItems: "center", justifyContent: "center" },
  chartCanvas: { width: 200, height: 200 },
  chartLabels: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  chartValue: { fontSize: 32, fontWeight: "800" },
  chartLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  scoreItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  scoreDivider: { width: 1, height: 18 },
  scoreText: { fontSize: 13, fontWeight: "700" },
  resultActions: { flexDirection: "row", gap: 12, width: "100%" },
  ghostButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  ghostText: { fontWeight: "700" },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonCompact: { alignSelf: "flex-end", paddingHorizontal: 24 },
  primaryText: { color: "#fff", fontWeight: "700" },
});
