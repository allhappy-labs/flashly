import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import Markdown from "react-native-markdown-display";
import { APP_CAPABILITIES } from "../config/app-mode";
import { markdownImagePolicy } from "../utils/markdown-image-policy";

type Props = {
  value: string;
  color: string;
  mutedColor?: string;
  accentColor?: string;
  textAlign?: "left" | "center";
  fontSize?: number;
  fontWeight?: "400" | "500" | "600" | "700";
  compact?: boolean;
  pointerEvents?: ViewProps["pointerEvents"];
};

export default function MarkdownText({
  value,
  color,
  mutedColor,
  accentColor,
  textAlign = "left",
  fontSize = 16,
  fontWeight,
  compact = false,
  pointerEvents,
}: Props) {
  if (!value) return null;

  const styles = buildStyles({ color, mutedColor, accentColor, textAlign, fontSize, fontWeight, compact });
  const imagePolicy = markdownImagePolicy(APP_CAPABILITIES.remoteMedia);

  const content = (
    <Markdown
      style={styles}
      mergeStyle
      allowedImageHandlers={imagePolicy.allowedImageHandlers}
      defaultImageHandler={imagePolicy.defaultImageHandler}
    >
      {value}
    </Markdown>
  );

  if (pointerEvents) {
    return <View pointerEvents={pointerEvents}>{content}</View>;
  }

  return content;
}

function buildStyles({
  color,
  mutedColor,
  accentColor,
  textAlign,
  fontSize,
  fontWeight,
  compact,
}: {
  color: string;
  mutedColor?: string;
  accentColor?: string;
  textAlign: "left" | "center";
  fontSize: number;
  fontWeight?: "400" | "500" | "600" | "700";
  compact: boolean;
}) {
  const lineHeight = Math.round(fontSize * 1.35);
  const headingLineHeight = Math.round((fontSize + 6) * 1.35);
  const codeBackground = mutedColor ? `${mutedColor}22` : "#f3f4f6";

  return StyleSheet.create({
    body: { color, fontSize, lineHeight, textAlign, fontWeight },
    paragraph: { marginTop: 0, marginBottom: compact ? 0 : 6 },
    text: { color, fontSize, lineHeight, textAlign, fontWeight },
    strong: { fontWeight: "700" },
    em: { fontStyle: "italic" },
    s: { textDecorationLine: "line-through" },
    link: { color: accentColor ?? color, textDecorationLine: "underline" },
    code_inline: {
      fontFamily: "Courier",
      backgroundColor: codeBackground,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    code_block: {
      fontFamily: "Courier",
      backgroundColor: codeBackground,
      padding: 10,
      borderRadius: 8,
    },
    heading1: { fontSize: fontSize + 8, lineHeight: headingLineHeight, fontWeight: "700" },
    heading2: { fontSize: fontSize + 6, lineHeight: headingLineHeight, fontWeight: "700" },
    heading3: { fontSize: fontSize + 4, lineHeight: headingLineHeight, fontWeight: "700" },
    bullet_list: { marginBottom: compact ? 0 : 6 },
    ordered_list: { marginBottom: compact ? 0 : 6 },
    list_item: { flexDirection: "row", alignItems: "flex-start" },
    bullet_list_icon: { color: color, marginRight: 6, lineHeight },
    ordered_list_icon: { color: color, marginRight: 6, lineHeight },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: mutedColor ?? "#e5e7eb",
      paddingLeft: 10,
      opacity: 0.9,
    },
  });
}
