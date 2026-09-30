import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import MarkdownText from "./MarkdownText";
import type { Palette } from "../theme";

export type AnswerOptionState = "default" | "selected" | "correct" | "incorrect";

type Props = {
  options: string[];
  selectedOption: string | null;
  onSelect: (option: string) => void;
  colors: Palette;
  correctOption?: string;
  showFeedback?: boolean;
  disabled?: boolean;
  optionBackgroundColor?: string;
  containerStyle?: StyleProp<ViewStyle>;
  optionStyle?: StyleProp<ViewStyle>;
  reserveTrailingSpace?: boolean;
  renderLabel?: (option: string, state: AnswerOptionState) => React.ReactNode;
  renderLeading?: (option: string, state: AnswerOptionState) => React.ReactNode;
  renderTrailing?: (option: string, state: AnswerOptionState) => React.ReactNode;
};

function getOptionState({
  selected,
  showFeedback,
  isCorrect,
}: {
  selected: boolean;
  showFeedback: boolean;
  isCorrect: boolean;
}): AnswerOptionState {
  if (showFeedback) {
    if (isCorrect) return "correct";
    if (selected) return "incorrect";
  }
  if (selected) return "selected";
  return "default";
}

function getBorderColor(state: AnswerOptionState, colors: Palette) {
  if (state === "correct") return colors.accent;
  if (state === "incorrect") return colors.danger;
  if (state === "selected") return colors.primary;
  return colors.border;
}

function isBooleanOptions(options: string[]) {
  if (options.length !== 2) return false;
  const normalized = options.map((option) => option.trim().toLowerCase());
  return normalized.includes("true") && normalized.includes("false");
}

export default function AnswerOptionList({
  options,
  selectedOption,
  onSelect,
  colors,
  correctOption,
  showFeedback = false,
  disabled = false,
  optionBackgroundColor,
  containerStyle,
  optionStyle,
  reserveTrailingSpace = true,
  renderLabel,
  renderLeading,
  renderTrailing,
}: Props) {
  if (isBooleanOptions(options)) {
    return (
      <View style={[styles.booleanRow, containerStyle]}>
        {options.map((option) => {
          const normalized = option.trim().toLowerCase();
          const selected = selectedOption === option;
          const isCorrect = correctOption === option;
          const state = getOptionState({ selected, showFeedback, isCorrect });
          const borderColor = getBorderColor(state, colors);
          const iconName = normalized === "true" ? "checkmark" : "close";
          const iconColor = normalized === "true" ? colors.accent : colors.danger;
          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.booleanButton,
                {
                  borderColor,
                  backgroundColor: optionBackgroundColor ?? colors.card,
                },
                optionStyle,
              ]}
              onPress={() => {
                if (disabled) return;
                onSelect(option);
              }}
              disabled={disabled}
            >
              <Ionicons name={iconName} size={18} color={iconColor} />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {options.map((option) => {
        const selected = selectedOption === option;
        const isCorrect = correctOption === option;
        const state = getOptionState({ selected, showFeedback, isCorrect });
        const borderColor = getBorderColor(state, colors);
        const trailing = renderTrailing
          ? renderTrailing(option, state)
          : showFeedback
            ? isCorrect
              ? <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
              : selected
                ? <Ionicons name="close-circle" size={18} color={colors.danger} />
                : null
            : null;

        return (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionButton,
              {
                borderColor,
                backgroundColor: optionBackgroundColor ?? colors.card,
              },
              optionStyle,
            ]}
            onPress={() => {
              if (disabled) return;
              onSelect(option);
            }}
            disabled={disabled}
          >
            {renderLeading ? <View style={styles.leading}>{renderLeading(option, state)}</View> : null}
            <View style={styles.labelWrap}>
              {renderLabel ? (
                renderLabel(option, state)
              ) : (
                <MarkdownText
                  value={option}
                  color={colors.text}
                  mutedColor={colors.muted}
                  accentColor={colors.accent}
                  textAlign="left"
                  fontSize={15}
                  fontWeight="600"
                  compact
                />
              )}
            </View>
            {reserveTrailingSpace || trailing ? (
              <View style={styles.trailing}>{trailing}</View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  optionButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leading: { marginRight: 4 },
  labelWrap: { flex: 1, marginRight: 8 },
  trailing: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  booleanRow: { flexDirection: "row", gap: 12 },
  booleanButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
