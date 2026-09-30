import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { DeckStackParamList } from "../navigation/types";
import { usePalette } from "../theme";
import { estimateDeckFamiliarity } from "../db/deckRepositorySafe";
import type {
  LearnDirection,
  LearnFamiliarity,
  LearnFormatPreset,
  LearnGoal,
  LearnGrading,
  LearnOptions,
  LearnQuestionType,
  LearnScope,
} from "../types/learn";
import { logger } from "../utils/logger";

type Props = NativeStackScreenProps<DeckStackParamList, "LearnSetup">;

function OptionChips<T extends string>({
  label,
  options,
  value,
  onChange,
  colors,
}: {
  label: string;
  options: { value: T; label: string; description?: string }[];
  value: T;
  onChange: (value: T) => void;
  colors: { text: string; muted: string; border: string; primary: string; secondary: string };
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.chip,
                { borderColor: colors.border, backgroundColor: colors.secondary },
                selected && { borderColor: colors.primary, backgroundColor: colors.primary },
              ]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[styles.chipText, { color: selected ? "#fff" : colors.text }]}>
                {option.label}
              </Text>
              {option.description ? (
                <Text style={[styles.chipDescription, { color: selected ? "rgba(255, 255, 255, 0.8)" : colors.muted }]}>
                  {option.description}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function LearnSetupScreen({ navigation, route }: Props) {
  const { deckId } = route.params;
  const { t } = useTranslation();
  const colors = usePalette();
  const [goal, setGoal] = useState<LearnGoal>("cram");
  const [familiarity, setFamiliarity] = useState<LearnFamiliarity>("new");
  const [questionTypes, setQuestionTypes] = useState<LearnQuestionType[]>([
    "multiple_choice",
    "written",
  ]);
  const [grading, setGrading] = useState<LearnGrading>("smart");
  const [retypeAfterMiss, setRetypeAfterMiss] = useState(false);
  const [direction, setDirection] = useState<LearnDirection>("definition");
  const [scope, setScope] = useState<LearnScope>("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [formatPreset, setFormatPreset] = useState<LearnFormatPreset>("QA");

  const goalOptions = useMemo(
    () => [
      {
        value: "cram" as const,
        label: t("learn.goalCram", { defaultValue: "Cram for a test" }),
        description: t("learn.goalCramHint", { defaultValue: "Fast coverage and quick reinforcement." }),
      },
      {
        value: "memorize" as const,
        label: t("learn.goalMemorize", { defaultValue: "Memorize it all" }),
        description: t("learn.goalMemorizeHint", { defaultValue: "Full coverage with repeated mastery." }),
      },
    ],
    [t],
  );

  useEffect(() => {
    let active = true;
    estimateDeckFamiliarity(deckId).then((result) => {
      if (!active) return;
      if (result.isErr()) {
        logger.error('Failed to estimate deck familiarity:', result.error.message);
        setFamiliarity('new');
        return;
      }
      setFamiliarity(result.value.familiarity);
    });
    return () => {
      active = false;
    };
  }, [deckId]);

  const gradingOptions = useMemo(
    () => [
      {
        value: "strict" as const,
        label: t("learn.gradingStrict", { defaultValue: "Strict" }),
        description: t("learn.gradingStrictHint", { defaultValue: "Requires perfect answers." }),
      },
      {
        value: "smart" as const,
        label: t("learn.gradingSmart", { defaultValue: "Smart" }),
        description: t("learn.gradingSmartHint", { defaultValue: "Allows minor typos." }),
      },
    ],
    [t],
  );

  const directionOptions = useMemo(
    () => [
      { value: "definition" as const, label: t("learn.answerWithDefinition", { defaultValue: "Answer with definition" }) },
      { value: "term" as const, label: t("learn.answerWithTerm", { defaultValue: "Answer with term" }) },
    ],
    [t],
  );

  const scopeOptions = useMemo(
    () => [
      { value: "all" as const, label: t("common.all", { defaultValue: "All" }) },
      { value: "not_studied" as const, label: t("learn.scopeNotStudied", { defaultValue: "Not studied" }) },
      { value: "learning" as const, label: t("learn.scopeLearning", { defaultValue: "Still learning" }) },
      { value: "mastered" as const, label: t("learn.scopeMastered", { defaultValue: "Mastered" }) },
    ],
    [t],
  );

  const formatOptions = useMemo(
    () => [
      { value: "QA" as const, label: "QA" },
      { value: "Cloze" as const, label: "Cloze" },
      { value: "Definition" as const, label: "Definition" },
      { value: "Mixed" as const, label: "Mixed" },
    ],
    [],
  );

  const toggleQuestionType = (type: LearnQuestionType) => {
    setQuestionTypes((current) => {
      const has = current.includes(type);
      const next = has ? current.filter((t) => t !== type) : [...current, type];
      return next.length ? next : current;
    });
  };

  const handleStart = () => {
    const options: LearnOptions = {
      goal,
      familiarity,
      questionTypes,
      grading,
      retypeAfterMiss,
      direction,
      scope,
      starredOnly,
      formatPreset,
    };
    navigation.navigate("Learn", { deckId, options });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.screen}>
      <OptionChips
        label={t("learn.goalLabel", { defaultValue: "Goal" })}
        options={goalOptions}
        value={goal}
        onChange={setGoal}
        colors={colors}
      />
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>
          {t("learn.questionTypes", { defaultValue: "Question types" })}
        </Text>
        <View style={styles.chipRow}>
          {[
            { value: "multiple_choice" as const, label: t("learn.questionMultipleChoice", { defaultValue: "Multiple choice" }) },
            { value: "written" as const, label: t("learn.questionWritten", { defaultValue: "Written" }) },
          ].map((option) => {
            const selected = questionTypes.includes(option.value);
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.chip,
                  { borderColor: colors.border, backgroundColor: colors.secondary },
                  selected && { borderColor: colors.primary, backgroundColor: colors.primary },
                ]}
                onPress={() => toggleQuestionType(option.value)}
              >
                <Text style={[styles.chipText, { color: selected ? "#fff" : colors.text }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <OptionChips
        label={t("learn.answerDirection", { defaultValue: "Answer with" })}
        options={directionOptions}
        value={direction}
        onChange={setDirection}
        colors={colors}
      />

      <OptionChips
        label={t("learn.gradingLabel", { defaultValue: "Grading" })}
        options={gradingOptions}
        value={grading}
        onChange={setGrading}
        colors={colors}
      />

      <View style={[styles.settingRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <View style={styles.settingText}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>
            {t("learn.retypeLabel", { defaultValue: "Retype after miss" })}
          </Text>
          <Text style={[styles.sectionHint, { color: colors.muted }]}>
            {t("learn.retypeHint", { defaultValue: "Require typing the correct answer before continuing." })}
          </Text>
        </View>
        <Switch
          value={retypeAfterMiss}
          onValueChange={setRetypeAfterMiss}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#ffffff"
        />
      </View>

      <OptionChips
        label={t("learn.scopeLabel", { defaultValue: "Study scope" })}
        options={scopeOptions}
        value={scope}
        onChange={setScope}
        colors={colors}
      />

      <View style={[styles.settingRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <View style={styles.settingText}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>
            {t("learn.starredOnly", { defaultValue: "Starred only" })}
          </Text>
          <Text style={[styles.sectionHint, { color: colors.muted }]}>
            {t("learn.starredOnlyHint", { defaultValue: "Focus only on starred cards." })}
          </Text>
        </View>
        <Switch
          value={starredOnly}
          onValueChange={setStarredOnly}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#ffffff"
        />
      </View>

      <OptionChips
        label={t("learn.formatPreset", { defaultValue: "Format preset" })}
        options={formatOptions}
        value={formatPreset}
        onChange={setFormatPreset}
        colors={colors}
      />

      <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={handleStart}>
        <Text style={styles.primaryButtonText}>{t("learn.start", { defaultValue: "Start Learn" })}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 32, gap: 16 },
  section: { gap: 10 },
  sectionLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  sectionHint: { fontSize: 12, opacity: 0.7, marginTop: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    minWidth: "46%",
  },
  chipText: { fontSize: 13, fontWeight: "700" },
  chipDescription: { fontSize: 11, marginTop: 4 },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  settingText: { flex: 1 },
  primaryButton: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
