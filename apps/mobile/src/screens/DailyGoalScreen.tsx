import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { DeckStackParamList } from "../navigation/types";
import { usePalette } from "../theme";
import { useStore } from "../store/useStore";

type Props = NativeStackScreenProps<DeckStackParamList, "DailyGoal">;

const MIN_DAILY_GOAL = 1;
const MAX_DAILY_GOAL = 500;

function clampGoal(value: number) {
  if (Number.isNaN(value)) return MIN_DAILY_GOAL;
  return Math.min(Math.max(value, MIN_DAILY_GOAL), MAX_DAILY_GOAL);
}

export default function DailyGoalScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = usePalette();
  const dailyGoal = useStore((state) => state.dailyGoal);
  const allowExtraNew = useStore((state) => state.allowExtraNew);
  const setDailyGoal = useStore((state) => state.setDailyGoal);
  const setAllowExtraNew = useStore((state) => state.setAllowExtraNew);
  const [goalText, setGoalText] = useState(String(dailyGoal));

  useEffect(() => {
    navigation.setOptions({
      title: t("dailyGoal.title"),
      headerBackTitle: t("common.back"),
    });
  }, [navigation, t]);

  useEffect(() => {
    setGoalText(String(dailyGoal));
  }, [dailyGoal]);

  const handleSaveGoal = (value: string) => {
    const cleaned = value.replace(/[^\d]/g, "");
    if (!cleaned) {
      setGoalText(String(dailyGoal));
      return;
    }
    const next = clampGoal(Number(cleaned));
    setGoalText(String(next));
    void setDailyGoal(next);
  };

  const step = useMemo(() => (dailyGoal >= 100 ? 10 : 5), [dailyGoal]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t("dailyGoal.title")}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{t("dailyGoal.description")}</Text>

        <View style={styles.inputBlock}>
          <Text style={[styles.label, { color: colors.muted }]}>{t("dailyGoal.goalLabel")}</Text>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[styles.stepButton, { borderColor: colors.border, backgroundColor: colors.secondary }]}
              onPress={() => {
                const next = clampGoal(dailyGoal - step);
                setGoalText(String(next));
                void setDailyGoal(next);
              }}
            >
              <Text style={[styles.stepText, { color: colors.text }]}>-</Text>
            </TouchableOpacity>
            <TextInput
              value={goalText}
              onChangeText={setGoalText}
              onBlur={() => handleSaveGoal(goalText)}
              onSubmitEditing={() => handleSaveGoal(goalText)}
              keyboardType="number-pad"
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              textAlign="center"
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.stepButton, { borderColor: colors.border, backgroundColor: colors.secondary }]}
              onPress={() => {
                const next = clampGoal(dailyGoal + step);
                setGoalText(String(next));
                void setDailyGoal(next);
              }}
            >
              <Text style={[styles.stepText, { color: colors.text }]}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.helper, { color: colors.muted }]}>{t("dailyGoal.helper")}</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={[styles.toggleTitle, { color: colors.text }]}>{t("dailyGoal.allowExtraTitle")}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>{t("dailyGoal.allowExtraHelp")}</Text>
          </View>
          <Switch
            value={allowExtraNew}
            onValueChange={(value) => void setAllowExtraNew(value)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: "700" },
  body: { fontSize: 13, lineHeight: 18 },
  inputBlock: { gap: 8, marginTop: 6 },
  label: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    fontSize: 18,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontSize: 18, fontWeight: "700" },
  helper: { fontSize: 12 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleCopy: { flex: 1, gap: 6 },
  toggleTitle: { fontSize: 15, fontWeight: "700" },
});
