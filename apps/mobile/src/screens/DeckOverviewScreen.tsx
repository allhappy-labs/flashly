import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { InteractionManager, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { HeaderButton } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getDeckAnalytics } from "../db/deckRepositorySafe";
import { getCachedDeckAnalytics, setCachedDeckAnalytics } from "../db/analytics-cache";
import { useSyncStore } from "../store/sync-store";
import { APP_CAPABILITIES } from "../config/app-mode";
import type { DeckStackParamList } from "../navigation/types";
import { useStore } from "../store/useStore";
import type { DeckAnalytics, DeckWithStats } from "../types/models";
import { formatRelative } from "../utils/format";
import { usePalette } from "../theme";

type Props = NativeStackScreenProps<DeckStackParamList, "DeckOverview">;

export default function DeckOverviewScreen({ navigation, route }: Props) {
  const { deckId } = route.params;
  const { t } = useTranslation();
  const colors = usePalette();
  const refreshDeckById = useStore((state) => state.refreshDeckById);
  const decks = useStore((state) => state.decks);
  const studySyncToken = useStore((state) => state.studySyncToken);
  const userId = useStore((state) => state.userId);
  const startSync = useSyncStore((state) => state.startSync);
  const isSyncing = useSyncStore((state) => state.isSyncing);
  const [deck, setDeck] = useState<DeckWithStats | null>(null);
  const [analytics, setAnalytics] = useState<DeckAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const lastDeckUpdateRef = useRef<{ updatedAt: number; lastStudiedAt: number | null } | null>(null);
  const analyticsRequestRef = useRef(0);
  const isFocused = useIsFocused();

  useEffect(() => {
    const existing = decks.find((d) => d.id === deckId) ?? null;
    if (existing) setDeck(existing);
  }, [deckId, decks]);

  useLayoutEffect(() => {
    if (!deck) {
      navigation.setOptions({ title: "", headerRight: undefined });
      return;
    }
    navigation.setOptions({
      title: "",
      headerBackTitle: t("deckList.title"),
      headerTintColor: colors.text,
      headerRight: () => (
        <HeaderButton
          onPress={() => navigation.navigate("DeckDetail", { deckId })}
          accessibilityLabel={t("deck.editDeck")}
          pressOpacity={0.6}
        >
          <Ionicons name="pencil" size={20} color={colors.text} />
        </HeaderButton>
      ),
    });
  }, [navigation, deck, t, deckId, colors.text]);

  const loadAnalytics = useCallback(async () => {
    const requestId = analyticsRequestRef.current + 1;
    analyticsRequestRef.current = requestId;
    setAnalyticsLoading(true);
    InteractionManager.runAfterInteractions(async () => {
      if (!APP_CAPABILITIES.remoteAnalytics || !userId) {
        const detailsResult = await getDeckAnalytics(deckId);
        if (analyticsRequestRef.current !== requestId) return;
        if (detailsResult.isOk()) {
          setAnalytics(detailsResult.value);
        }
        setAnalyticsLoading(false);
        return;
      }

      const cachedResult = await getCachedDeckAnalytics(userId, deckId, 30);
      if (analyticsRequestRef.current !== requestId) return;
      if (cachedResult.isOk() && cachedResult.value) {
        setAnalytics(cachedResult.value);
      }

      const { fetchDeckAnalytics } = await import("../services/analytics/analytics-service");
      const result = await fetchDeckAnalytics(deckId, 30);
      if (analyticsRequestRef.current !== requestId) return;
      if (result.isOk()) {
        setAnalytics(result.value);
        await setCachedDeckAnalytics(userId, deckId, 30, result.value);
      }
      setAnalyticsLoading(false);
    });
  }, [deckId, userId]);

  const load = useCallback(async () => {
    setAnalyticsLoading(true);
    await refreshDeckById(deckId);
    const current = useStore.getState().decks.find((candidate) => candidate.id === deckId) ?? null;
    setDeck(current);
    await loadAnalytics();
  }, [deckId, loadAnalytics, refreshDeckById]);

  useFocusEffect(
    useCallback(() => {
      if (APP_CAPABILITIES.sync && userId && !isSyncing) {
        startSync(userId);
      }
      load();
    }, [load, userId, isSyncing, startSync]),
  );

  useEffect(() => {
    if (!isFocused || !deck || analyticsLoading) return;
    const snapshot = { updatedAt: deck.updatedAt, lastStudiedAt: deck.lastStudiedAt ?? null };
    const previous = lastDeckUpdateRef.current;
    if (previous && previous.updatedAt === snapshot.updatedAt && previous.lastStudiedAt === snapshot.lastStudiedAt) {
      return;
    }
    lastDeckUpdateRef.current = snapshot;
    void loadAnalytics();
  }, [analyticsLoading, deck, isFocused, loadAnalytics, studySyncToken]);

  if (!deck) {
    return (
      <View style={[styles.container, { paddingTop: 12, backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>{t("deckList.empty")}</Text>
      </View>
    );
  }

  const totals = analytics?.totals ?? {
    total: deck.cardCount,
    dueToday: deck.dueCount,
    newCount: deck.newCount,
    learningCount: deck.learningCount,
    reviewCount: deck.reviewCount,
    relearningCount: deck.relearningCount,
  };
  const retention = analytics?.retention ?? deck.retention ?? 1;
  const retentionPercent = Math.round(retention * 100);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: 8, paddingBottom: 28 }]}
    >
      <View style={styles.headerBlock}>
        <Text style={[styles.title, { color: colors.text }]}>{deck.name}</Text>
        {deck.description ? <Text style={[styles.description, { color: colors.muted }]}>{deck.description}</Text> : null}
        <View style={styles.metaRow}>
          <View style={[styles.metaPill, { backgroundColor: colors.secondary }]}>
            <Ionicons name="albums-outline" size={14} color={colors.muted} />
            <Text style={[styles.metaText, { color: colors.muted }]}>
              {t("deckList.cardCount", { count: deck.cardCount })}
            </Text>
          </View>
          <View style={[styles.metaPill, { backgroundColor: colors.secondary }]}>
            <Ionicons name="time-outline" size={14} color={colors.muted} />
            <Text style={[styles.metaText, { color: colors.muted }]}>
              {deck.lastStudiedAt ? formatRelative(deck.lastStudiedAt) : t("deckList.neverStudied")}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.progressBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={[styles.progressLabel, { color: colors.muted }]}>
              {t("deck.dailyGoal", { defaultValue: "Daily goal" })}
            </Text>
            <View style={styles.dueRow}>
              <Text style={[styles.dueCount, { color: colors.text }]}>{totals.dueToday}</Text>
              <Text style={[styles.dueLabel, { color: colors.muted }]}>
                {t("deckList.dueShort", { defaultValue: "Due" })}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.analyticsLink}
            onPress={() => navigation.navigate("DeckAnalytics", { deckId })}
          >
            <Text style={[styles.analyticsText, { color: colors.primary }]}>{t("deck.analytics")}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.retentionRow}>
          <Text style={[styles.retentionLabel, { color: colors.muted }]}>
            {t("deck.retentionLabel", { defaultValue: "Retention" })}
          </Text>
          <Text style={[styles.retentionValue, { color: colors.primary }]}>{retentionPercent}%</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${retentionPercent}%` }]} />
        </View>
        <View style={styles.statRow}>
          {[
            { label: t("deck.totalCards", { defaultValue: "Total cards" }), value: totals.total },
            { label: t("deck.new", { defaultValue: "New" }), value: totals.newCount },
            { label: t("deck.learning", { defaultValue: "Learning" }), value: totals.learningCount },
            { label: t("deck.review", { defaultValue: "Review" }), value: totals.reviewCount + totals.relearningCount },
          ].map((stat, index) => (
            <View
              key={stat.label}
              style={[
                styles.statChip,
                {
                  backgroundColor: colors.secondary,
                  borderRightColor: colors.border,
                  borderRightWidth: index === 3 ? 0 : StyleSheet.hairlineWidth,
                },
              ]}
            >
              <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.studyCard, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate("Study", { deckId })}
        activeOpacity={0.9}
      >
        <View style={styles.studyRow}>
          <View style={styles.studyIconWrap}>
            <Ionicons name="play" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.studyTitle}>{t("deck.study")}</Text>
            <Text style={styles.studySubtitle}>{t("deck.studySubtitle")}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.studyCard, styles.learnCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => navigation.navigate("LearnSetup", { deckId })}
        activeOpacity={0.9}
      >
        <View style={styles.studyRow}>
          <View style={[styles.studyIconWrap, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
            <Ionicons name="school-outline" size={20} color="#60a5fa" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modeTitle, { color: colors.text }]}>{t("learn.title")}</Text>
            <Text style={[styles.modeSubtitle, { color: colors.muted }]}>{t("learn.subtitle")}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={colors.muted} />
        </View>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t("deck.practiceModes", { defaultValue: "Practice modes" })}
      </Text>
      <View style={styles.modeGrid}>
        <TouchableOpacity
          style={[styles.modeTile, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.navigate("Browse", { deckId })}
        >
          <View style={[styles.modeIcon, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
            <Ionicons name="grid-outline" size={18} color="#34d399" />
          </View>
          <Text style={[styles.modeTitle, { color: colors.text }]}>{t("deck.browse")}</Text>
          <Text style={[styles.modeSubtitle, { color: colors.muted }]}>{t("deck.browseSubtitle")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTile, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.navigate("Match", { deckId })}
        >
          <View style={[styles.modeIcon, { backgroundColor: "rgba(249, 115, 22, 0.15)" }]}>
            <Ionicons name="game-controller-outline" size={18} color="#fb923c" />
          </View>
          <Text style={[styles.modeTitle, { color: colors.text }]}>{t("match.title")}</Text>
          <Text style={[styles.modeSubtitle, { color: colors.muted }]}>{t("match.subtitle")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTile, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.navigate("Write", { deckId })}
        >
          <View style={[styles.modeIcon, { backgroundColor: "rgba(139, 92, 246, 0.15)" }]}>
            <Ionicons name="create-outline" size={18} color="#a78bfa" />
          </View>
          <Text style={[styles.modeTitle, { color: colors.text }]}>{t("write.title")}</Text>
          <Text style={[styles.modeSubtitle, { color: colors.muted }]}>{t("write.subtitle")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTile, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.navigate("Test", { deckId })}
        >
          <View style={[styles.modeIcon, { backgroundColor: "rgba(244, 63, 94, 0.15)" }]}>
            <Ionicons name="help-outline" size={18} color="#fb7185" />
          </View>
          <Text style={[styles.modeTitle, { color: colors.text }]}>{t("test.title")}</Text>
          <Text style={[styles.modeSubtitle, { color: colors.muted }]}>{t("test.subtitle")}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 16 },
  headerBlock: { gap: 6 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  description: { fontSize: 16 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  metaText: { fontSize: 13, fontWeight: "600" },
  progressBlock: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  progressLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  dueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 },
  dueCount: { fontSize: 32, fontWeight: "800", lineHeight: 36 },
  dueLabel: { fontSize: 12, fontWeight: "600", lineHeight: 16 },
  analyticsLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  analyticsText: { fontSize: 13, fontWeight: "700" },
  retentionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  retentionLabel: { fontSize: 12, fontWeight: "600" },
  retentionValue: { fontSize: 12, fontWeight: "700" },
  progressTrack: { height: 8, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  statRow: { flexDirection: "row", gap: 6 },
  statChip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  statValue: { fontSize: 15, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "600" },
  studyCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  learnCard: { borderWidth: 1, shadowOpacity: 0.12, elevation: 2 },
  studyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  studyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  studyTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  studySubtitle: { color: "rgba(255,255,255,0.8)", marginTop: 2, fontSize: 12, fontWeight: "600" },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: 6 },
  modeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  modeTile: {
    width: "47.5%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  modeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modeTitle: { fontSize: 15, fontWeight: "700" },
  modeSubtitle: { fontSize: 12 },
});
