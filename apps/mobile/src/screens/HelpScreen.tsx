import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { HostedDeckStackParamList } from "../navigation/types";
import { usePalette } from "../theme";
import Ionicons from "@expo/vector-icons/Ionicons";

type Props = NativeStackScreenProps<HostedDeckStackParamList, "Help">;

export default function HelpScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = usePalette();

  React.useEffect(() => {
    navigation.setOptions({ title: t("help.title"), headerBackTitle: t("common.back") });
  }, [navigation, t]);

  const steps = [
    {
      icon: "add-circle",
      title: t("help.gettingStartedStep1Title"),
      body: t("help.gettingStartedStep1Body"),
    },
    {
      icon: "albums-outline",
      title: t("help.gettingStartedStep2Title"),
      body: t("help.gettingStartedStep2Body"),
    },
    {
      icon: "play",
      title: t("help.gettingStartedStep3Title"),
      body: t("help.gettingStartedStep3Body"),
    },
  ] as const;

  const ratings = [
    {
      key: "again",
      title: t("help.ratingsAgainTitle"),
      body: t("help.ratingsAgainBody"),
      icon: "refresh",
      tint: { bg: "rgba(244, 63, 94, 0.16)", color: "#fb7185" },
    },
    {
      key: "hard",
      title: t("help.ratingsHardTitle"),
      body: t("help.ratingsHardBody"),
      icon: "sad-outline",
      tint: { bg: "rgba(251, 191, 36, 0.16)", color: "#fbbf24" },
    },
    {
      key: "good",
      title: t("help.ratingsGoodTitle"),
      body: t("help.ratingsGoodBody"),
      icon: "happy-outline",
      tint: { bg: "rgba(52, 211, 153, 0.16)", color: "#34d399" },
    },
    {
      key: "easy",
      title: t("help.ratingsEasyTitle"),
      body: t("help.ratingsEasyBody"),
      icon: "happy",
      tint: { bg: "rgba(59, 130, 246, 0.16)", color: "#60a5fa" },
    },
  ] as const;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.heroCover, { backgroundColor: colors.primary }]}>
          <View style={[styles.heroGlow, { backgroundColor: "rgba(255, 255, 255, 0.18)" }]} />
          <View style={[styles.heroOrb, { backgroundColor: "rgba(15, 23, 42, 0.2)" }]} />
          <View style={[styles.heroWave, { backgroundColor: colors.secondary }]} />
        </View>
        <View style={[styles.heroBadge, { backgroundColor: colors.card, borderColor: colors.background }]}>
          <Ionicons name="school-outline" size={26} color={colors.primary} />
        </View>
        <View style={styles.heroContent}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>{t("help.welcomeTitle")}</Text>
          <Text style={[styles.heroBody, { color: colors.muted }]}>{t("help.intro")}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("help.gettingStartedTitle")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {steps.map((step, index) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.stepIconColumn}>
                <View style={[styles.stepIconWrap, { backgroundColor: colors.secondary }]}>
                  <Ionicons name={step.icon} size={20} color={colors.primary} />
                </View>
                {index < steps.length - 1 ? <View style={[styles.stepLine, { backgroundColor: colors.border }]} /> : null}
              </View>
              <View style={styles.stepText}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>{step.title}</Text>
                <Text style={[styles.stepBody, { color: colors.muted }]}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("help.ratingsTitle")}</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>{t("help.ratingsTimeBody")}</Text>
        <View style={styles.ratingsGrid}>
          {ratings.map((rating) => (
            <View
              key={rating.key}
              style={[styles.ratingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.ratingIcon, { backgroundColor: rating.tint.bg }]}>
                <Ionicons name={rating.icon} size={20} color={rating.tint.color} />
              </View>
              <View style={styles.ratingText}>
                <Text style={[styles.ratingTitle, { color: colors.text }]}>{rating.title}</Text>
                <Text style={[styles.ratingBody, { color: colors.muted }]}>{rating.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.fsrsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="sparkles-outline" size={120} color={colors.border} style={styles.fsrsIcon} />
        <View style={styles.fsrsHeader}>
          <View style={[styles.fsrsBadge, { backgroundColor: colors.secondary }]}>
            <Ionicons name="trending-up-outline" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.fsrsTitle, { color: colors.text }]}>{t("help.fsrsTitle")}</Text>
        </View>
        <Text style={[styles.fsrsBody, { color: colors.muted }]}>{t("help.fsrsBody")}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, gap: 18, paddingBottom: 28 },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 4,
  },
  heroCover: { height: 120, position: "relative", overflow: "hidden" },
  heroGlow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    top: -140,
    left: -40,
  },
  heroOrb: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 999,
    right: -30,
    top: -30,
  },
  heroWave: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -30,
    height: 80,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    opacity: 0.9,
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    marginTop: -28,
    marginLeft: 18,
  },
  heroContent: { paddingHorizontal: 18, paddingBottom: 18, gap: 6, paddingTop: 10 },
  heroTitle: { fontSize: 20, fontWeight: "800" },
  heroBody: { fontSize: 13.5, lineHeight: 19 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sectionSubtitle: { fontSize: 13, lineHeight: 18 },
  card: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
  },
  stepRow: { flexDirection: "row", gap: 14 },
  stepIconColumn: { alignItems: "center" },
  stepIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: { width: 2, flex: 1, marginTop: 6, borderRadius: 999 },
  stepText: { flex: 1, gap: 4, paddingBottom: 6 },
  stepTitle: { fontSize: 15, fontWeight: "700" },
  stepBody: { fontSize: 13, lineHeight: 18 },
  ratingsGrid: { gap: 10 },
  ratingCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  ratingIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingText: { flex: 1, gap: 2 },
  ratingTitle: { fontSize: 15, fontWeight: "700" },
  ratingBody: { fontSize: 13, lineHeight: 18 },
  fsrsCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    gap: 8,
  },
  fsrsIcon: {
    position: "absolute",
    right: -24,
    bottom: -28,
    opacity: 0.35,
  },
  fsrsHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  fsrsBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fsrsTitle: { fontSize: 16, fontWeight: "700" },
  fsrsBody: { fontSize: 13, lineHeight: 18, maxWidth: "92%" },
});
