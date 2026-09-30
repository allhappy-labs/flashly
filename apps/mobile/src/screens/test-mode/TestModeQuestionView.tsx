import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { TFunction } from "i18next";
import AnswerOptionList from "../../components/AnswerOptionList";
import AudioProgressButton from "../../components/AudioProgressButton";
import { APP_CAPABILITIES } from "../../config/app-mode";
import FeedbackTextInput from "../../components/FeedbackTextInput";
import MarkdownText from "../../components/MarkdownText";
import ProgressBar from "../../components/ProgressBar";
import { toggleAudioPlayback } from "../../services/audioPlayer";
import type { Palette } from "../../theme";
import { usableMediaUri } from "../../utils/media-policy";
import type { TestQuestion } from "./test-mode-utils";

type FeedbackState = "correct" | "incorrect" | null;

type Props = {
  colors: Palette;
  t: TFunction;
  question: TestQuestion;
  progress: number;
  index: number;
  totalQuestions: number;
  answered: boolean;
  feedback: FeedbackState;
  selectedOption: string | null;
  typedAnswer: string;
  setTypedAnswer: (text: string) => void;
  onSelectOption: (option: string) => void;
  onToggleStar: () => void;
  onOverrideCorrect: () => void;
  onDontKnow: () => void;
  onSubmit: () => void;
  onContinue: () => void;
  continueAnim: Animated.Value;
  showImmediateContinue: boolean;
};

export function TestModeQuestionView({
  colors,
  t,
  question,
  progress,
  index,
  totalQuestions,
  answered,
  feedback,
  selectedOption,
  typedAnswer,
  setTypedAnswer,
  onSelectOption,
  onToggleStar,
  onOverrideCorrect,
  onDontKnow,
  onSubmit,
  onContinue,
  continueAnim,
  showImmediateContinue,
}: Props) {
  const audioUri = usableMediaUri(question.audioUrl, APP_CAPABILITIES.remoteMedia);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={styles.progressWrap}>
        <View style={styles.progressRow}>
          <Text style={[styles.progressLabel, { color: colors.muted }]}>{t("test.progress")}</Text>
          <Text style={[styles.progressValue, { color: colors.muted }]}>{`${index + 1} / ${totalQuestions}`}</Text>
        </View>
        <ProgressBar progress={progress} trackColor={colors.border} fillColor={colors.primary} height={6} />
      </View>

      <View style={[styles.questionCard, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.typePill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Ionicons name="list" size={14} color={colors.primary} />
            <Text style={[styles.typeText, { color: colors.primary }]}>{t(`test.type.${question.type}`)}</Text>
          </View>
          <View style={styles.cardActions}>
            {audioUri ? (
              <AudioProgressButton
                uri={audioUri}
                backgroundColor={colors.card}
                borderColor={colors.border}
                iconColor={colors.primary}
                size={34}
                iconSize={16}
                onPress={() => void toggleAudioPlayback(audioUri)}
              />
            ) : null}
            <TouchableOpacity
              style={[styles.starButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={onToggleStar}
            >
              <Ionicons
                name={question.isStarred ? "star" : "star-outline"}
                size={18}
                color={question.isStarred ? colors.primary : colors.muted}
              />
            </TouchableOpacity>
          </View>
        </View>
        <MarkdownText
          value={question.prompt}
          color={answered ? colors.muted : colors.text}
          mutedColor={colors.muted}
          accentColor={colors.accent}
          textAlign="left"
          fontSize={22}
        />
        {question.type === "boolean" && question.statement ? (
          <MarkdownText
            value={question.statement}
            color={colors.text}
            mutedColor={colors.muted}
            accentColor={colors.accent}
            textAlign="left"
            fontSize={16}
          />
        ) : null}

        {question.type === "mcq" && question.options ? (
          <AnswerOptionList
            options={question.options}
            selectedOption={selectedOption}
            correctOption={question.correctAnswer}
            showFeedback={Boolean(feedback) || answered}
            disabled={Boolean(feedback) || answered}
            onSelect={onSelectOption}
            colors={colors}
          />
        ) : null}

        {question.type === "boolean" ? (
          <AnswerOptionList
            options={["true", "false"]}
            selectedOption={selectedOption}
            correctOption={question.correctAnswer}
            showFeedback={Boolean(feedback) || answered}
            disabled={Boolean(feedback) || answered}
            onSelect={onSelectOption}
            colors={colors}
          />
        ) : null}

        {question.type === "written" ? (
          <View style={styles.writtenBox}>
            <Text style={[styles.placeholder, { color: colors.muted }]}>{t("test.writeAnswer")}</Text>
            <FeedbackTextInput
              value={typedAnswer}
              onChangeText={setTypedAnswer}
              placeholder={t("learn.answerPlaceholder", { defaultValue: "Type your answer" })}
              placeholderTextColor={colors.muted}
              style={styles.userInput}
              editable={!answered}
              multiline
              textAlignVertical="top"
              feedback={feedback}
              colors={colors}
            />
          </View>
        ) : null}

        {answered && question.type === "written" && question.isCorrect === false ? (
          <>
            <Text style={[styles.answerReveal, { color: colors.text }]}>
              {t("learn.correctAnswer", { defaultValue: "Correct answer:" })} {question.correctAnswer}
            </Text>
            <TouchableOpacity style={styles.overrideButton} onPress={onOverrideCorrect}>
              <Text style={[styles.overrideText, { color: colors.primary }]}>{t("write.overrideCorrect")}</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {answered && question.explanation ? (
          <Text style={[styles.explanation, { color: colors.muted }]}>{question.explanation}</Text>
        ) : null}

        {!answered ? (
          question.type === "written" ? (
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: colors.secondary }]} onPress={onDontKnow}>
                <Text style={[styles.secondaryText, { color: colors.text }]}>
                  {t("learn.dontKnow", { defaultValue: "Don't know" })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.primaryButtonCompact, { backgroundColor: colors.primary }]}
                onPress={onSubmit}
              >
                <Text style={styles.primaryText}>{t("learn.submit", { defaultValue: "Check" })}</Text>
              </TouchableOpacity>
            </View>
          ) : null
        ) : feedback === "incorrect" || (feedback === "correct" && showImmediateContinue) ? (
          <Animated.View
            style={[
              styles.continueWrap,
              {
                opacity: showImmediateContinue ? 1 : continueAnim,
                transform: [
                  {
                    translateY: showImmediateContinue
                      ? 0
                      : continueAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [6, 0],
                        }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={onContinue}>
              <Text style={styles.primaryText}>{t("learn.continue")}</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  cardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 6,
  },
  progressWrap: { gap: 8 },
  progressRow: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { fontSize: 12, fontWeight: "600" },
  progressValue: { fontSize: 12, fontWeight: "600" },
  questionCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  starButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  typeText: { fontSize: 12, fontWeight: "700" },
  writtenBox: { gap: 6 },
  placeholder: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  userInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    minHeight: 90,
  },
  answerReveal: { fontSize: 14, fontWeight: "600" },
  explanation: { fontSize: 14, lineHeight: 20 },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  primaryButtonCompact: { alignSelf: "flex-end", paddingHorizontal: 24 },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontWeight: "700" },
  continueWrap: { width: "100%" },
  overrideButton: { alignSelf: "flex-end" },
  overrideText: { fontSize: 13, fontWeight: "600" },
});
