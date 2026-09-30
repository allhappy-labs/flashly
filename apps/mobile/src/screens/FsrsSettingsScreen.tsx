import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { FSRSParameters } from "ts-fsrs";
import type { DeckStackParamList } from "../navigation/types";
import { useStore } from "../store/useStore";
import { usePalette } from "../theme";
import { getFsrsParameters } from "../services/fsrsScheduler";
import Ionicons from "@expo/vector-icons/Ionicons";

type Props = NativeStackScreenProps<DeckStackParamList, "FsrsSettings">;
type PresetId = "gentle" | "balanced" | "fast";

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export default function FsrsSettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = usePalette();
  const params = useStore((state) => state.fsrsParams);
  const setParams = useStore((state) => state.setFsrsParams);
  const defaults = useMemo<FSRSParameters>(() => getFsrsParameters(), []);
  const initialParams = Object.keys(params).length ? params : defaults;
  const [form, setForm] = useState<Partial<FSRSParameters>>(initialParams);
  const [spacingStyle, setSpacingStyle] = useState<PresetId | "custom">("balanced");

  const presets: Record<PresetId, Pick<FSRSParameters, "request_retention" | "maximum_interval" | "enable_short_term" | "enable_fuzz">> =
    useMemo(
      () => ({
        gentle: { request_retention: 0.92, maximum_interval: 180, enable_short_term: true, enable_fuzz: true },
        balanced: { request_retention: 0.9, maximum_interval: 365, enable_short_term: true, enable_fuzz: true },
        fast: { request_retention: 0.85, maximum_interval: 730, enable_short_term: false, enable_fuzz: true },
      }),
      [],
    );

  const detectPreset = (data: Partial<FSRSParameters>): PresetId | "custom" => {
    const retention = data.request_retention ?? defaults.request_retention;
    const maxInterval = data.maximum_interval ?? defaults.maximum_interval;
    const shortTerm = data.enable_short_term ?? defaults.enable_short_term;
    const fuzz = data.enable_fuzz ?? defaults.enable_fuzz;
    const matches = (preset: typeof presets[PresetId]) =>
      Math.abs(preset.request_retention - retention) < 0.005 &&
      Math.abs(preset.maximum_interval - maxInterval) < 1 &&
      preset.enable_short_term === shortTerm &&
      preset.enable_fuzz === fuzz;
    if (matches(presets.gentle)) return "gentle";
    if (matches(presets.balanced)) return "balanced";
    if (matches(presets.fast)) return "fast";
    return "custom";
  };

  useEffect(() => {
    navigation.setOptions({ title: t("fsrs.title"), headerBackTitle: t("common.back") });
  }, [navigation, t]);

  useEffect(() => {
    const next = Object.keys(params).length ? params : defaults;
    setForm(next);
    setSpacingStyle(detectPreset(next));
  }, [params, defaults]);

  const sanitizeParams = (next: Partial<FSRSParameters>) => ({
    ...next,
    request_retention: clampNumber(Number(next.request_retention ?? defaults.request_retention), 0.7, 0.99),
    maximum_interval: clampNumber(Number(next.maximum_interval ?? defaults.maximum_interval), 30, 36500),
  });

  const persistParams = (next: Partial<FSRSParameters>) => {
    const sanitized = sanitizeParams(next);
    setForm(sanitized);
    setSpacingStyle(detectPreset(sanitized));
    void setParams(sanitized);
  };

  const applyPreset = (id: PresetId) => {
    const preset = presets[id];
    const updated = { ...form, ...preset };
    persistParams(updated);
  };

  const updateRetentionPct = (val: string) => {
    const pct = clampNumber(Number(val), 70, 99);
    const next = { ...form, request_retention: pct / 100 };
    persistParams(next);
  };

  const updateMaxInterval = (val: string) => {
    const nextDays = clampNumber(Number(val), 30, 36500);
    const next = { ...form, maximum_interval: nextDays };
    persistParams(next);
  };

  const retentionPct = Math.round((form.request_retention ?? defaults.request_retention) * 100);
  const maxIntervalDays = Math.round(form.maximum_interval ?? defaults.maximum_interval);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("fsrs.presetTitle")}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>{t("fsrs.presetSubtitle")}</Text>
          <View style={styles.presetRow}>
            {(["gentle", "balanced", "fast"] as const).map((id) => {
              const isActive = spacingStyle === id;
              const iconName =
                id === "gentle" ? "leaf-outline" : id === "balanced" ? "scale-outline" : "rocket-outline";
              return (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.presetButton,
                    {
                      borderColor: isActive ? colors.primary : colors.border,
                      backgroundColor: isActive ? colors.secondary : colors.card,
                    },
                  ]}
                  onPress={() => applyPreset(id)}
                >
                  <Ionicons name={iconName} size={20} color={isActive ? colors.primary : colors.muted} />
                  <Text style={[styles.presetTitle, { color: colors.text }]}>{t(`fsrs.preset.${id}.label` as const)}</Text>
                  <Text style={[styles.presetHelp, { color: colors.muted }]}>{t(`fsrs.preset.${id}.help` as const)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("fsrs.parametersTitle")}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t("fsrs.retention")}</Text>
              <View style={[styles.pill, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.pillText, { color: colors.primary }]}>{t("fsrs.retentionRange")}</Text>
              </View>
            </View>
            <View style={[styles.inputShell, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                keyboardType="numeric"
                value={String(retentionPct)}
                onChangeText={updateRetentionPct}
              />
              <Text style={[styles.inputSuffix, { color: colors.muted }]}>%</Text>
            </View>
            <Text style={[styles.help, { color: colors.muted }]}>{t("fsrs.retentionHelp")}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t("fsrs.maxInterval")}</Text>
              <Text style={[styles.cardMeta, { color: colors.muted }]}>{t("fsrs.daysLabel")}</Text>
            </View>
            <View style={[styles.inputShell, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                keyboardType="numeric"
                value={String(maxIntervalDays)}
                onChangeText={updateMaxInterval}
              />
              <Ionicons name="calendar-outline" size={18} color={colors.muted} />
            </View>
            <Text style={[styles.help, { color: colors.muted }]}>{t("fsrs.maxIntervalHelp")}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("fsrs.advancedTitle")}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t("fsrs.fuzz")}</Text>
                <Text style={[styles.help, { color: colors.muted }]}>{t("fsrs.fuzzHelp")}</Text>
              </View>
              <Switch
                value={form.enable_fuzz ?? defaults.enable_fuzz}
                onValueChange={(value) => {
                  const next = { ...form, enable_fuzz: value };
                  persistParams(next);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t("fsrs.shortTerm")}</Text>
                <Text style={[styles.help, { color: colors.muted }]}>{t("fsrs.shortTermHelp")}</Text>
              </View>
              <Switch
                value={form.enable_short_term ?? defaults.enable_short_term}
                onValueChange={(value) => {
                  const next = { ...form, enable_short_term: value };
                  persistParams(next);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#ffffff"
              />
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
  help: { fontSize: 12, marginTop: 6, lineHeight: 16 },
  presetRow: { flexDirection: "row", gap: 10 },
  presetButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 6,
  },
  presetTitle: { fontWeight: "700", fontSize: 13 },
  presetHelp: { fontSize: 11, textAlign: "center" },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 14, fontWeight: "600" },
  cardMeta: { fontSize: 12 },
  pill: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: "600" },
  inputShell: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  input: { flex: 1, fontSize: 18, fontWeight: "600", paddingVertical: 6 },
  inputSuffix: { fontSize: 16, fontWeight: "600" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  switchCopy: { flex: 1 },
});
