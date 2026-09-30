import React from "react";
import { TextInput, type StyleProp, type TextStyle } from "react-native";
import { type Palette } from "../theme";

type FeedbackState = "correct" | "incorrect" | null;

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  colors: Palette;
  feedback?: FeedbackState;
  placeholder?: string;
  placeholderTextColor?: string;
  editable?: boolean;
  multiline?: boolean;
  textAlignVertical?: TextStyle["textAlignVertical"];
  style?: StyleProp<TextStyle>;
};

export default function FeedbackTextInput({
  value,
  onChangeText,
  colors,
  feedback = null,
  placeholder,
  placeholderTextColor,
  editable = true,
  multiline = false,
  textAlignVertical,
  style,
}: Props) {
  const borderColor =
    feedback === "correct" ? colors.accent : feedback === "incorrect" ? colors.danger : colors.border;

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      editable={editable}
      multiline={multiline}
      textAlignVertical={textAlignVertical}
      style={[
        style,
        {
          backgroundColor: colors.card,
          color: colors.text,
          borderColor,
        },
      ]}
    />
  );
}
