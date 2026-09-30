import { StyleSheet, Text, View, TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";
import React from "react";

type Stat = { label: string; value: number };

type Props = {
  title: string;
  subtitleLeft: string;
  subtitleRight?: string;
  progress: number; // 0-1
  stats: Stat[];
  backgroundColor: string;
  borderColor: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  mutedColor: string;
  rightActionLabel?: string;
  onPressRightAction?: () => void;
  actionButtonLabel?: string;
  onPressActionButton?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function ProgressCard({
  title,
  subtitleLeft,
  subtitleRight,
  progress,
  stats,
  backgroundColor,
  borderColor,
  primaryColor,
  secondaryColor,
  textColor,
  mutedColor,
  rightActionLabel,
  onPressRightAction,
  actionButtonLabel,
  onPressActionButton,
  style,
  children,
}: Props) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const trackColor = secondaryColor === backgroundColor ? borderColor : secondaryColor;
  return (
    <View style={[styles.card, { backgroundColor, borderColor }, style]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        {rightActionLabel && onPressRightAction ? (
          <TouchableOpacity onPress={onPressRightAction} accessibilityRole="button">
            <Text style={{ color: textColor, fontWeight: "700" }}>{rightActionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={[styles.progressBar, { backgroundColor: trackColor }]}>
        <View style={[styles.progressFill, { width: `${clamped * 100}%`, backgroundColor: primaryColor }]} />
      </View>

      <View style={styles.summaryRow}>
        <Text style={{ color: textColor }}>{subtitleLeft}</Text>
        {subtitleRight ? <Text style={{ color: mutedColor }}>{subtitleRight}</Text> : null}
      </View>

      {children}

      {actionButtonLabel && onPressActionButton ? (
        <TouchableOpacity
          style={[styles.actionButton, { borderColor }]}
          onPress={onPressActionButton}
          accessibilityRole="button"
        >
          <Text style={{ color: textColor, fontWeight: "700" }}>{actionButtonLabel}</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.statGrid}>
        {stats.map((stat, statIndex) => (
          <View
            key={stat.label}
            style={[
              styles.statItem,
              {
                backgroundColor: secondaryColor,
                borderRightColor: borderColor,
                borderRightWidth: statIndex === stats.length - 1 ? 0 : StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Text style={[styles.statValue, { color: textColor }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: mutedColor }]}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, borderRadius: 14, borderWidth: 1, gap: 6 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "700" },
  progressBar: { height: 10, borderRadius: 10, overflow: "hidden", marginVertical: 6 },
  progressFill: { height: "100%" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  actionButton: {
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  statGrid: { flexDirection: "row", flexWrap: "nowrap", gap: 6, marginTop: 6, justifyContent: "space-between" },
  statItem: { flex: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 8 },
  statValue: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "600" },
});
