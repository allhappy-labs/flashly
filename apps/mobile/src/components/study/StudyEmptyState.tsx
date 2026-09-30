import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTranslation } from "react-i18next";

import type { usePalette } from "../../theme";

type Props = Readonly<{
  colors: ReturnType<typeof usePalette>;
}>;

export function StudyEmptyState(props: Props) {
  const { t } = useTranslation();
  return (
    <View style={[styles.centered, { backgroundColor: props.colors.background }]}>
      <Text style={[styles.emptyTitle, { color: props.colors.text }]}>{t("study.empty")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "600", textAlign: "center" },
});

export default StudyEmptyState;
