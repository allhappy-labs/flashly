import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { DeckStackParamList } from "../navigation/types";
import { usePalette } from "../theme";
import { version as appVersion } from "../../package.json";
import LogoHorizontal from "@flashly/branding/assets/logo-horizontal.svg";

type Props = NativeStackScreenProps<DeckStackParamList, "About">;
const LOGO_WIDTH = 168;
const LOGO_ASPECT_RATIO = 1684.7 / 570.7;
const LOGO_HEIGHT = Math.round(LOGO_WIDTH / LOGO_ASPECT_RATIO);

export default function AboutScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = usePalette();

  useEffect(() => {
    navigation.setOptions({ title: t("about.title"), headerBackTitle: t("common.back") });
  }, [navigation, t]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.logo}>
          <LogoHorizontal width="100%" height="100%" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t("about.title")}</Text>
        <Text style={[styles.tagline, { color: colors.muted }]}>{t("about.tagline")}</Text>
        <Text style={[styles.version, { color: colors.muted }]}>{t("about.versionLabel", { version: appVersion })}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("about.missionTitle")}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{t("about.missionBody")}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("about.highlightsTitle")}</Text>
        {[t("about.highlight1"), t("about.highlight2"), t("about.highlight3")].map((item) => (
          <View key={item} style={styles.bulletRow}>
            <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
            <Text style={[styles.body, { color: colors.muted }]}>{item}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  heroCard: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    alignItems: "center",
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: "800" },
  tagline: { fontSize: 14, textAlign: "center" },
  version: { fontSize: 12, fontWeight: "600" },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  body: { fontSize: 13, lineHeight: 18 },
  bulletRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 999 },
});
