import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { TFunction } from "i18next";
import type { Palette } from "../../theme";

type Props = {
  colors: Palette;
  t: TFunction;
  primaryTint: string;
  questionCount: number;
  totalCards: number;
  minCount: number;
  onDecrease: () => void;
  onIncrease: () => void;
  onStart: () => void;
};

export function TestModeSetupView({
  colors,
  t,
  primaryTint,
  questionCount,
  totalCards,
  minCount,
  onDecrease,
  onIncrease,
  onStart,
}: Props) {
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.setupCard, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.iconBadge, { backgroundColor: primaryTint }]}>
          <Ionicons name="options" size={22} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t("test.setupTitle")}</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>{t("test.setupSubtitle")}</Text>
        <View style={[styles.settingRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{t("test.questionCount")}</Text>
          <View style={[styles.stepperWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.stepperButton,
                { backgroundColor: colors.secondary },
                questionCount <= minCount && styles.stepperDisabled,
              ]}
              onPress={onDecrease}
              disabled={questionCount <= minCount}
            >
              <Text style={[styles.stepperText, { color: colors.text }]}>-</Text>
            </TouchableOpacity>
            <Text style={[styles.setupValue, { color: colors.text }]}>{questionCount}</Text>
            <TouchableOpacity
              style={[
                styles.stepperButton,
                { backgroundColor: colors.secondary },
                questionCount >= totalCards && styles.stepperDisabled,
              ]}
              onPress={onIncrease}
              disabled={questionCount >= totalCards}
            >
              <Text style={[styles.stepperText, { color: colors.text }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.primaryButton, styles.primaryButtonFull, { backgroundColor: colors.primary }]}
          onPress={onStart}
        >
          <Text style={styles.primaryText}>{t("test.start")}</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.helperText, { color: colors.muted }]}>{t("test.availableCount", { count: totalCards })}</Text>
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
  setupCard: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    alignItems: "center",
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center" },
  helperText: { fontSize: 12, textAlign: "center" },
  settingRow: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingLabel: { fontSize: 14, fontWeight: "600" },
  stepperWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 8,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperDisabled: { opacity: 0.5 },
  stepperText: { fontSize: 18, fontWeight: "700" },
  setupValue: { fontSize: 18, fontWeight: "800", minWidth: 32, textAlign: "center" },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonFull: { width: "100%", paddingVertical: 14 },
  primaryText: { color: "#fff", fontWeight: "700" },
});
