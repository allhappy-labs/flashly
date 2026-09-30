import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Rating } from "ts-fsrs";
import { useFont } from "@shopify/react-native-skia";
import Ionicons from "@expo/vector-icons/Ionicons";
import { dayjs, setDayjsLocale } from "@flashly/shared";
import { APP_CAPABILITIES } from "../config/app-mode";
import { usePalette } from "../theme";
import type { DeckAnalytics } from "../types/models";
import type { DeckStackParamList } from "../navigation/types";
import { getDeckAnalytics } from "../db/deckRepositorySafe";
import { getCachedDeckAnalytics, setCachedDeckAnalytics } from "../db/analytics-cache";
import { useSyncStore } from "../store/sync-store";
import { useStore } from "../store/useStore";
import { DailyActivityChart } from "../components/analytics/DailyActivityChart";
import { CardStatesChart } from "../components/analytics/CardStatesChart";
import { TimeSpentChart } from "../components/analytics/TimeSpentChart";
import { type SeriesDatum } from "../components/analytics/chartUtils";
import { selectAnalyticsSource } from "../features/analytics/analytics-source";
import noto from "../../assets/NotoSans_Condensed-Thin.ttf";

type Props = NativeStackScreenProps<DeckStackParamList, "DeckAnalytics">;

function parseAnalyticsDate(date: string) {
  return dayjs.utc(date, "YYYY-MM-DD").local();
}

function formatDateLabel(date: string) {
  return parseAnalyticsDate(date).format("M/D");
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function getReviewStreak(entries: { date: string; total: number }[]) {
  if (!entries.length) return 0;
  const sorted = [...entries];
  sorted.sort((a, b) => parseAnalyticsDate(a.date).valueOf() - parseAnalyticsDate(b.date).valueOf());
  let streak = 0;
  let previousDate: dayjs.Dayjs | null = null;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const entry = sorted[i];
    if (entry.total <= 0) {
      if (streak === 0) return 0;
      break;
    }
    const entryDate = parseAnalyticsDate(entry.date).startOf("day");
    if (previousDate && previousDate.diff(entryDate, "day") !== 1) break;
    streak += 1;
    previousDate = entryDate;
  }
  return streak;
}

function getTrendPercent(entries: SeriesDatum[]) {
  if (entries.length < 2) return null;
  const previous = entries[entries.length - 2]?.value ?? 0;
  const current = entries[entries.length - 1]?.value ?? 0;
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export default function DeckAnalyticsScreen({ route, navigation }: Props) {
  const { deckId, windowDays: initialWindow } = route.params;
  const { t, i18n } = useTranslation();
  const colors = usePalette();
  const [analytics, setAnalytics] = useState<DeckAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<7 | 30 | 0>(initialWindow ?? 30);
  const userId = useStore((state) => state.userId);
  const analyticsSource = selectAnalyticsSource(APP_CAPABILITIES.remoteAnalytics, userId);
  const startSync = useSyncStore((state) => state.startSync);
  const isSyncing = useSyncStore((state) => state.isSyncing);
  const axisFont = useFont(noto, 12);

  useEffect(() => {
    setDayjsLocale(i18n.language);
    navigation.setOptions({ title: t("analytics.title") });
  }, [i18n.language, navigation, t]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (analyticsSource === "local" || !userId) {
        const result = await getDeckAnalytics(deckId, windowDays);
        if (result.isErr()) {
          const message = result.error.message || t("analytics.noAnalytics");
          setError(message);
          return;
        }
        setAnalytics(result.value);
        return;
      }

      const cachedResult = await getCachedDeckAnalytics(userId, deckId, windowDays);
      if (cachedResult.isOk() && cachedResult.value) {
        setAnalytics(cachedResult.value);
      }

      const { fetchDeckAnalytics } = await import("../services/analytics/analytics-service");
      const result = await fetchDeckAnalytics(deckId, windowDays);
      if (result.isErr()) {
        if (!cachedResult.isOk() || !cachedResult.value) {
          const message = result.error.message || t("analytics.noAnalytics");
          setError(message);
        }
        return;
      }

      setAnalytics(result.value);
      await setCachedDeckAnalytics(userId, deckId, windowDays, result.value);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("analytics.noAnalytics");
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [analyticsSource, deckId, t, windowDays, userId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useFocusEffect(
    useCallback(() => {
      if (APP_CAPABILITIES.sync && userId && !isSyncing) {
        startSync(userId);
      }
      loadAnalytics();
    }, [loadAnalytics, userId, isSyncing, startSync]),
  );

  const totals = analytics?.totals ?? {
    total: 0,
    dueToday: 0,
    newCount: 0,
    learningCount: 0,
    reviewCount: 0,
    relearningCount: 0,
  };
  const retention = analytics?.retention ?? 1;

  const dailyData = useMemo<SeriesDatum[]>(() => {
    return (analytics?.dailyHistory ?? []).map((entry, idx) => ({
      index: idx,
      value: entry.total,
      label: formatDateLabel(entry.date),
    }));
  }, [analytics]);

  const timeData = useMemo<SeriesDatum[]>(() => {
    return (analytics?.timeSpent ?? []).map((entry, idx) => ({
      index: idx,
      value: entry.minutes,
      label: formatDateLabel(entry.date),
    }));
  }, [analytics]);

  const maxDaily = dailyData.reduce((max, entry) => Math.max(max, entry.value), 0);
  const maxTime = timeData.reduce((max, entry) => Math.max(max, entry.value), 0);

  const ratingLabels: Record<Rating, string> = {
    [Rating.Again]: t("analytics.ratingAgain", "Again"),
    [Rating.Hard]: t("analytics.ratingHard", "Hard"),
    [Rating.Good]: t("analytics.ratingGood", "Good"),
    [Rating.Easy]: t("analytics.ratingEasy", "Easy"),
    [Rating.Manual]: t("analytics.ratingManual", "Manual"),
  };

  const ratingPalette: Record<Rating, string> = {
    [Rating.Again]: colors.danger,
    [Rating.Hard]: "#f59e0b",
    [Rating.Good]: colors.accent,
    [Rating.Easy]: colors.primary,
    [Rating.Manual]: colors.text,
  };

  const ratingSummary = useMemo(
    () =>
      [Rating.Easy, Rating.Good, Rating.Hard, Rating.Again].map((rating, idx) => {
        const count = analytics?.ratingCounts.find((r) => r.rating === rating)?.count ?? 0;
        return { index: idx, value: count, label: ratingLabels[rating], color: ratingPalette[rating] };
      }),
    [analytics?.ratingCounts, ratingLabels, ratingPalette],
  );
  const ratingTotal = ratingSummary.reduce((sum, entry) => sum + entry.value, 0);

  const cardStates = useMemo(() => {
    const data = [
      { key: "new", label: t("deck.new", "New"), value: totals.newCount, fill: colors.primary },
      { key: "learning", label: t("deck.learning", "Learning"), value: totals.learningCount, fill: "#f5c542" },
      { key: "review", label: t("deck.review", "Review"), value: totals.reviewCount, fill: "#22c55e" },
      { key: "lapsed", label: t("analytics.lapsed", "Lapsed"), value: totals.relearningCount, fill: colors.danger },
    ];
    const totalCount = data.reduce((sum, item) => sum + item.value, 0);
    return data.map((item) => ({
      ...item,
      percentage: totalCount ? Math.round((item.value / totalCount) * 100) : 0,
    }));
  }, [colors, t, totals.learningCount, totals.newCount, totals.reviewCount, totals.relearningCount]);

  const totalReviews = analytics?.dailyHistory?.reduce((sum, entry) => sum + entry.total, 0) ?? 0;
  const totalMinutes = timeData.reduce((sum, entry) => sum + entry.value, 0);
  const windowSpanDays = analytics?.windowDaysUsed ?? windowDays;
  const streakDays = getReviewStreak(analytics?.dailyHistory ?? []);
  const avgReviews = dailyData.length ? Math.round(totalReviews / dailyData.length) : 0;
  const trendPercent = getTrendPercent(dailyData);
  const timeSpentLabel = formatDuration(totalMinutes);
  const lastActivityLabel = useMemo(() => {
    const history = analytics?.dailyHistory ?? [];
    let lastActive: { date: string; total: number } | null = null;
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const entry = history[i];
      if (entry && entry.total > 0) {
        lastActive = entry;
        break;
      }
    }
    if (!lastActive) return null;
    return parseAnalyticsDate(lastActive.date).endOf("day").fromNow();
  }, [analytics]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
    >
      <View style={[styles.windowToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {[7, 30, 0].map((value) => {
          const active = windowDays === value;
          const label =
            value === 0
              ? t("analytics.allTime", "All time")
              : t("analytics.lastNDays", { count: value, defaultValue: "Last {{count}} days" });
          return (
            <TouchableOpacity
              key={value}
              onPress={() => setWindowDays(value as 7 | 30 | 0)}
              style={[
                styles.togglePill,
                {
                  backgroundColor: active ? colors.primary : "transparent",
                  borderColor: active ? colors.primary : "transparent",
                },
              ]}
            >
              <Text style={[styles.toggleLabel, { color: active ? "#fff" : colors.text }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? (
        <View style={[styles.analyticsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.danger }}>{error}</Text>
        </View>
      ) : null}

      <View style={[styles.analyticsCard, styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryItem, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>{t("analytics.summaryReviews")}</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{totalReviews.toLocaleString()}</Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>{t("analytics.summaryRetention")}</Text>
            <View style={styles.summaryValueRow}>
              <Text style={[styles.summaryValue, { color: colors.accent }]}>{Math.round(retention * 100)}%</Text>
              <Ionicons name="trending-up-outline" size={14} color={colors.accent} />
            </View>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>{t("analytics.summaryStreak")}</Text>
            <View style={styles.summaryValueRow}>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>{streakDays}</Text>
              <Text style={[styles.summaryUnit, { color: colors.primary }]}>{t("analytics.summaryDays")}</Text>
            </View>
          </View>
        </View>
        {lastActivityLabel ? (
          <Text style={[styles.summaryFootnote, { color: colors.muted }]}>
            {t("analytics.lastActivity", {
              defaultValue: "Last activity {{time}}",
              time: lastActivityLabel,
            })}
          </Text>
        ) : null}
      </View>

      <View style={[styles.analyticsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitle}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>{t("analytics.dailyActivity")}</Text>
            <View style={[styles.sectionPill, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.sectionPillText, { color: colors.muted }]}>
                {t("analytics.dailyAverage", { avg: avgReviews })}
              </Text>
            </View>
          </View>
          {trendPercent !== null ? (
            <View
              style={[
                styles.trendBadge,
                {
                  backgroundColor: trendPercent >= 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(248, 113, 113, 0.15)",
                },
              ]}
            >
              <Ionicons
                name={trendPercent >= 0 ? "arrow-up" : "arrow-down"}
                size={12}
                color={trendPercent >= 0 ? colors.accent : colors.danger}
              />
              <Text
                style={[
                  styles.trendLabel,
                  { color: trendPercent >= 0 ? colors.accent : colors.danger },
                ]}
              >
                {Math.abs(trendPercent)}%
              </Text>
            </View>
          ) : null}
        </View>
        {dailyData.length ? (
          <DailyActivityChart
            data={dailyData}
            maxY={maxDaily}
            colors={{ primary: colors.primary, border: colors.border, muted: colors.muted }}
            axisFont={axisFont}
            yLabel={t("analytics.axisYReviews", "Reviews/day")}
            height={220}
          />
        ) : (
          <Text style={{ color: colors.muted, marginTop: 10 }}>{t("analytics.noAnalytics")}</Text>
        )}
      </View>

      <View style={styles.gridStack}>
        <View style={[styles.analyticsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>{t("analytics.cardStates")}</Text>
          {cardStates.some((item) => item.value > 0) ? (
            <CardStatesChart
              data={cardStates}
              colors={{ text: colors.text, muted: colors.muted }}
              totalValue={totals.total}
              totalLabel={t("analytics.cardTotal", "Cards")}
            />
          ) : (
            <Text style={{ color: colors.muted, marginTop: 10 }}>{t("analytics.noAnalytics")}</Text>
          )}
        </View>

        <View style={[styles.analyticsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>{t("analytics.answerButtons")}</Text>
          <View style={styles.ratingStack}>
            {ratingSummary.map((entry) => {
              const percentage = ratingTotal ? Math.round((entry.value / ratingTotal) * 100) : 0;
              return (
                <View key={entry.label} style={styles.ratingRow}>
                  <View style={styles.ratingLabelRow}>
                    <Text style={[styles.ratingLabel, { color: colors.muted }]}>{entry.label}</Text>
                    <Text style={[styles.ratingValue, { color: colors.text }]}>{percentage}%</Text>
                  </View>
                  <View style={[styles.ratingTrack, { backgroundColor: colors.secondary }]}>
                    <View style={[styles.ratingFill, { width: `${percentage}%`, backgroundColor: entry.color }]} />
                  </View>
                </View>
              );
            })}
            {!ratingSummary.some((item) => item.value > 0) ? (
              <Text style={{ color: colors.muted, marginTop: 6 }}>{t("analytics.noAnalytics")}</Text>
            ) : null}
            <Text style={[styles.ratingNote, { color: colors.muted }]}>{t("analytics.timeBasedNote")}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.analyticsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>{t("analytics.studyTime")}</Text>
          <View style={styles.timeHeader}>
            <Text style={[styles.timeValue, { color: colors.text }]}>{timeSpentLabel}</Text>
            <View style={[styles.sectionPill, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.sectionPillText, { color: colors.muted }]}>
                {windowSpanDays
                  ? t("analytics.timeSpentWindowLabel", { count: windowSpanDays })
                  : t("analytics.timeSpentAllTimeLabel")}
              </Text>
            </View>
          </View>
        </View>
        {timeData.length ? (
          <TimeSpentChart
            data={timeData}
            maxY={maxTime}
            colors={{ accent: colors.accent, border: colors.border, muted: colors.muted }}
            axisFont={axisFont}
            yLabel={t("analytics.axisYMinutes", "Minutes")}
            height={200}
          />
        ) : (
          <Text style={{ color: colors.muted, marginTop: 10 }}>{t("analytics.noAnalytics")}</Text>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  analyticsCard: {
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
  },
  summaryCard: { paddingVertical: 14 },
  sectionLabel: { fontSize: 16, fontWeight: "700" },
  sectionSubtle: { fontSize: 12, fontWeight: "500" },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  sectionTitle: { gap: 6 },
  sectionPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  sectionPillText: { fontSize: 11, fontWeight: "600" },
  windowToggle: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: 1,
    padding: 5,
  },
  togglePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  toggleLabel: { fontSize: 12, fontWeight: "700" },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryItem: {
    flex: 1,
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  summaryLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  summaryValue: { fontSize: 22, fontWeight: "800" },
  summaryValueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  summaryUnit: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  summaryFootnote: { marginTop: 10, fontSize: 12 },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  trendLabel: { fontSize: 12, fontWeight: "700" },
  gridStack: { gap: 14 },
  ratingStack: { gap: 12, marginTop: 8 },
  ratingRow: { gap: 6 },
  ratingLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ratingLabel: { fontSize: 12, fontWeight: "600" },
  ratingValue: { fontSize: 12, fontWeight: "700" },
  ratingTrack: { height: 10, borderRadius: 999, overflow: "hidden" },
  ratingFill: { height: "100%", borderRadius: 999 },
  ratingNote: { fontSize: 12, marginTop: 8, lineHeight: 16 },
  timeHeader: { alignItems: "flex-end", gap: 6 },
  timeValue: { fontSize: 22, fontWeight: "800" },
  timeCaption: { fontSize: 11, fontWeight: "600" },
});
