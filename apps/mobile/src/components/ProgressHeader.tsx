import React from "react";
import { StyleSheet, Text, View } from "react-native";
import ProgressBar from "./ProgressBar";

type Props = {
  current: number;
  total: number;
  trackColor: string;
  fillColor: string;
  label?: string;
  height?: number;
  textColor?: string;
};

export function ProgressHeader({ current, total, trackColor, fillColor, label, height = 8, textColor = "#6b7280" }: Props) {
  const ratio = total > 0 ? Math.min(Math.max(current / total, 0), 1) : 0;
  const display = label ?? `${Math.min(current, total)} / ${total}`;

  return (
    <View style={styles.row}>
      <ProgressBar progress={ratio} trackColor={trackColor} fillColor={fillColor} height={height} />
      <Text style={[styles.label, { color: textColor }]}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%", flexDirection: "row", alignItems: "center", gap: 8 },
  label: { minWidth: 56, textAlign: "right", fontSize: 14 },
});

export default ProgressHeader;
