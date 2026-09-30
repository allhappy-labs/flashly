import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { DeckStackParamList } from "../navigation/types";
import { useStore } from "../store/useStore";
import { usePalette } from "../theme";
import { normalizeTimeGradingConfig, type TimeGradingConfig } from "../utils/timeGrading";

type Props = Readonly<NativeStackScreenProps<DeckStackParamList, "TimeGradingSettings">>;

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export default function TimeGradingSettingsScreen(props: Props) {
  const navigation = props.navigation;
  const { t } = useTranslation();
  const colors = usePalette();
  const config = useStore((state) => state.timeGradingConfig);
  const setConfig = useStore((state) => state.setTimeGradingConfig);
  const [form, setForm] = useState<TimeGradingConfig>(config);

  useEffect(() => {
    navigation.setOptions({ title: t("timeGrading.title"), headerBackTitle: t("common.back") });
  }, [navigation, t]);

  useEffect(() => {
    setForm(config);
  }, [config]);

  const persist = (next: TimeGradingConfig) => {
    const normalized = normalizeTimeGradingConfig(next);
    setForm(normalized);
    void setConfig(normalized);
  };

  const updateThreshold = (key: "easy" | "good", value: string) => {
    const numeric = clampNumber(Number(value), 0.3, 2.5);
    const nextThresholds = {
      ...form.thresholds,
      [key]: numeric,
    };
    const easy = nextThresholds.easy;
    const good = Math.max(nextThresholds.good, easy + 0.1);
    persist({
      ...form,
      thresholds: { easy, good },
    });
  };

  const updateBaseTarget = (key: keyof TimeGradingConfig["baseTargetMs"], value: string) => {
    const seconds = clampNumber(Number(value), 1, 60);
    const nextMs = Math.round(seconds * 1000);
    persist({
      ...form,
      baseTargetMs: { ...form.baseTargetMs, [key]: nextMs },
    });
  };

  const updateAdaptWeight = (value: string) => {
    const pct = clampNumber(Number(value), 0, 100);
    persist({ ...form, adaptWeight: pct / 100 });
  };

  const seconds = useMemo(
    () => ({
      new: Math.round(form.baseTargetMs.new / 1000),
      learning: Math.round(form.baseTargetMs.learning / 1000),
      relearning: Math.round(form.baseTargetMs.relearning / 1000),
      review: Math.round(form.baseTargetMs.review / 1000),
    }),
    [form.baseTargetMs],
  );

  const adaptPercent = Math.round(form.adaptWeight * 100);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("timeGrading.overviewTitle")}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>{t("timeGrading.overviewBody")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("timeGrading.thresholdsTitle")}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.inputRow}>
              <View style={styles.inputCopy}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t("timeGrading.easyThreshold")}</Text>
                <Text style={[styles.help, { color: colors.muted }]}>{t("timeGrading.easyHint")}</Text>
              </View>
              <View style={[styles.inputShell, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  keyboardType="numeric"
                  value={String(form.thresholds.easy)}
                  onChangeText={(value) => updateThreshold("easy", value)}
                />
                <Text style={[styles.inputSuffix, { color: colors.muted }]}>×</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.inputRow}>
              <View style={styles.inputCopy}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t("timeGrading.goodThreshold")}</Text>
                <Text style={[styles.help, { color: colors.muted }]}>{t("timeGrading.goodHint")}</Text>
              </View>
              <View style={[styles.inputShell, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  keyboardType="numeric"
                  value={String(form.thresholds.good)}
                  onChangeText={(value) => updateThreshold("good", value)}
                />
                <Text style={[styles.inputSuffix, { color: colors.muted }]}>×</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("timeGrading.baseTargetTitle")}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>{t("timeGrading.baseTargetBody")}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {([
              { key: "new", label: t("timeGrading.stateNew") },
              { key: "learning", label: t("timeGrading.stateLearning") },
              { key: "relearning", label: t("timeGrading.stateRelearning") },
              { key: "review", label: t("timeGrading.stateReview") },
            ] as const).map((entry, index) => (
              <View key={entry.key}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.inputRow}>
                  <View style={styles.inputCopy}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{entry.label}</Text>
                    <Text style={[styles.help, { color: colors.muted }]}>{t("timeGrading.baseTargetHint")}</Text>
                  </View>
                  <View style={[styles.inputShell, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      keyboardType="numeric"
                      value={String(seconds[entry.key])}
                      onChangeText={(value) => updateBaseTarget(entry.key, value)}
                    />
                    <Text style={[styles.inputSuffix, { color: colors.muted }]}>{t("timeGrading.seconds")}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("timeGrading.adaptiveTitle")}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.inputRow}>
              <View style={styles.inputCopy}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t("timeGrading.adaptiveWeight")}</Text>
                <Text style={[styles.help, { color: colors.muted }]}>{t("timeGrading.adaptiveHint")}</Text>
              </View>
              <View style={[styles.inputShell, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  keyboardType="numeric"
                  value={String(adaptPercent)}
                  onChangeText={updateAdaptWeight}
                />
                <Text style={[styles.inputSuffix, { color: colors.muted }]}>%</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 16, paddingBottom: 28, gap: 20 },
  section: { gap: 12 },
  sectionTitle: { fontWeight: "700", fontSize: 18 },
  sectionSubtitle: { fontSize: 13 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  help: { fontSize: 12, lineHeight: 16 },
  inputRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  inputCopy: { flex: 1, gap: 6 },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 88,
    justifyContent: "space-between",
    gap: 8,
  },
  input: { minWidth: 36, textAlign: "right", fontWeight: "700", fontSize: 15 },
  inputSuffix: { fontSize: 12, fontWeight: "600" },
  divider: { height: 1, backgroundColor: "rgba(148, 163, 184, 0.2)" },
});
