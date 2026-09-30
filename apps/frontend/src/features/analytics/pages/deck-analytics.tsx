import * as React from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Pencil,
  RefreshCw,
  Smartphone,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { setDayjsLocale } from '@flashly/shared';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { openNativeDeckLearning } from '@/features/decks/utils/native-learning';
import type { DeckAnalyticsDetail } from '@/lib/api/analytics-service';
import {
  formatShortAnalyticsDate,
  getReviewStreak,
  getRollingWindowTrendPercent,
  getTrendPercent,
  parseAnalyticsDate,
} from '../utils/deck-analytics-utils';
import { useDeckAnalyticsDetail, useDeckStats } from '../hooks/use-analytics';

type DeckAnalyticsWindow = 7 | 30 | 0;

type Totals = {
  total: number;
  dueToday: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  relearningCount: number;
};

type DailyPoint = {
  date: string;
  shortLabel: string;
  reviews: number;
};

type TimePoint = {
  date: string;
  shortLabel: string;
  minutes: number;
};

type SummaryCardProps = {
  accentClassName?: string;
  label: string;
  value: React.ReactNode;
};

type EmptySectionProps = {
  description?: string;
  title: string;
};

const LazyDeckDailyActivityChart = React.lazy(() =>
  import('../components/deck-analytics-charts').then((module) => ({ default: module.DeckDailyActivityChart })),
);
const LazyDeckTimeSpentChart = React.lazy(() =>
  import('../components/deck-analytics-charts').then((module) => ({ default: module.DeckTimeSpentChart })),
);
const LazyDeckCardStatesChart = React.lazy(() =>
  import('../components/deck-analytics-charts').then((module) => ({ default: module.DeckCardStatesChart })),
);
const LazyDeckRatingsChart = React.lazy(() =>
  import('../components/deck-analytics-charts').then((module) => ({ default: module.DeckRatingsChart })),
);
const LazyDeckDueForecastChart = React.lazy(() =>
  import('../components/deck-analytics-charts').then((module) => ({ default: module.DeckDueForecastChart })),
);
const LazyDeckEaseSpreadChart = React.lazy(() =>
  import('../components/deck-analytics-charts').then((module) => ({ default: module.DeckEaseSpreadChart })),
);

const WINDOW_OPTIONS: DeckAnalyticsWindow[] = [7, 30, 0];
const EMPTY_TOTALS: Totals = {
  total: 0,
  dueToday: 0,
  newCount: 0,
  learningCount: 0,
  reviewCount: 0,
  relearningCount: 0,
};
const EMPTY_CACHE: Record<DeckAnalyticsWindow, DeckAnalyticsDetail | null> = {
  0: null,
  7: null,
  30: null,
};

function ChartFallback(props: Readonly<{ heightClassName?: string }>) {
  return <div className={`w-full animate-pulse rounded-xl bg-muted ${props.heightClassName ?? 'h-56'}`} />;
}

function SummaryMetricCard(props: Readonly<SummaryCardProps>) {
  return (
    <div className="rounded-2xl border bg-muted/30 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {props.label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${props.accentClassName ?? ''}`}>{props.value}</div>
    </div>
  );
}

function EmptySection(props: Readonly<EmptySectionProps>) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-5 text-center">
      <div className="text-sm font-medium">{props.title}</div>
      {props.description ? <div className="mt-1 text-xs text-muted-foreground">{props.description}</div> : null}
    </div>
  );
}

function getFallbackAnalytics(
  cache: Record<DeckAnalyticsWindow, DeckAnalyticsDetail | null>,
  preferredWindow: DeckAnalyticsWindow,
) {
  if (cache[preferredWindow]) {
    return cache[preferredWindow];
  }

  return cache[30] ?? cache[7] ?? cache[0] ?? null;
}

export function DeckAnalyticsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const deckId = typeof params.id === 'string' ? params.id : null;
  const [windowDays, setWindowDays] = React.useState<DeckAnalyticsWindow>(30);
  const [isSwitchPending, startSwitchTransition] = React.useTransition();
  const [analyticsCache, setAnalyticsCache] = React.useState<Record<DeckAnalyticsWindow, DeckAnalyticsDetail | null>>(EMPTY_CACHE);

  React.useEffect(() => {
    setDayjsLocale(i18n.language);
  }, [i18n.language]);

  const analyticsQuery = useDeckAnalyticsDetail(deckId ?? '', windowDays, Boolean(deckId));
  const deckStatsQuery = useDeckStats(deckId ?? '');

  React.useEffect(() => {
    if (!analyticsQuery.data) {
      return;
    }

    setAnalyticsCache((previous) => ({
      ...previous,
      [windowDays]: analyticsQuery.data,
    }));
  }, [analyticsQuery.data, windowDays]);

  const activeAnalytics = analyticsCache[windowDays];
  const visibleAnalytics = getFallbackAnalytics(analyticsCache, windowDays);
  const isShowingCachedWindowFallback = !activeAnalytics && Boolean(visibleAnalytics) && analyticsQuery.isLoading;
  const hasCurrentWindowCache = Boolean(activeAnalytics);
  const isLoadingInitialState = analyticsQuery.isLoading && !visibleAnalytics;

  const analytics = visibleAnalytics;
  const totals = analytics?.totals ?? EMPTY_TOTALS;
  const retention = analytics?.retention ?? 1;

  const dailyData = React.useMemo<DailyPoint[]>(
    () =>
      (analytics?.dailyHistory ?? []).map((entry) => ({
        date: parseAnalyticsDate(entry.date).format('MMM D, YYYY'),
        shortLabel: formatShortAnalyticsDate(entry.date),
        reviews: entry.total,
      })),
    [analytics?.dailyHistory],
  );

  const timeData = React.useMemo<TimePoint[]>(
    () =>
      (analytics?.timeSpent ?? []).map((entry) => ({
        date: parseAnalyticsDate(entry.date).format('MMM D, YYYY'),
        shortLabel: formatShortAnalyticsDate(entry.date),
        minutes: entry.minutes,
      })),
    [analytics?.timeSpent],
  );

  const dueForecastData = React.useMemo(
    () =>
      (analytics?.dueForecast ?? []).map((entry) => ({
        count: entry.count,
        date: parseAnalyticsDate(entry.date).format('MMM D, YYYY'),
        shortLabel: formatShortAnalyticsDate(entry.date),
      })),
    [analytics?.dueForecast],
  );

  const easeBucketsData = React.useMemo(
    () =>
      (analytics?.easeBuckets ?? []).map((entry) => ({
        bucket: entry.bucket,
        count: entry.count,
      })),
    [analytics?.easeBuckets],
  );

  const ratingCountsByValue = React.useMemo(() => {
    const map = new Map<number, number>();

    for (const item of analytics?.ratingCounts ?? []) {
      map.set(item.rating, item.count);
    }

    return map;
  }, [analytics?.ratingCounts]);

  const ratingsData = React.useMemo(() => {
    const entries = [
      { fill: 'hsl(var(--primary))', key: 'easy', label: t('analytics.ratingEasy'), rating: 4 },
      { fill: '#22c55e', key: 'good', label: t('analytics.ratingGood'), rating: 3 },
      { fill: '#f59e0b', key: 'hard', label: t('analytics.ratingHard'), rating: 2 },
      { fill: 'hsl(var(--destructive))', key: 'again', label: t('analytics.ratingAgain'), rating: 1 },
    ];

    const total = entries.reduce((sum, item) => sum + (ratingCountsByValue.get(item.rating) ?? 0), 0);

    return entries.map((item) => {
      const count = ratingCountsByValue.get(item.rating) ?? 0;
      return {
        count,
        fill: item.fill,
        label: item.label,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });
  }, [ratingCountsByValue, t]);

  const ratingsTotal = ratingsData.reduce((sum, item) => sum + item.count, 0);

  const cardStatesData = React.useMemo(() => {
    const items = [
      { fill: 'hsl(var(--primary))', label: t('deck.new'), value: totals.newCount },
      { fill: '#f5c542', label: t('deck.learning'), value: totals.learningCount },
      { fill: '#22c55e', label: t('deck.review'), value: totals.reviewCount },
      { fill: 'hsl(var(--destructive))', label: t('analytics.lapsed'), value: totals.relearningCount },
    ];

    const totalCards = items.reduce((sum, item) => sum + item.value, 0);

    return items.map((item) => ({
      ...item,
      percentage: totalCards > 0 ? Math.round((item.value / totalCards) * 100) : 0,
    }));
  }, [t, totals.learningCount, totals.newCount, totals.relearningCount, totals.reviewCount]);

  const totalReviews = React.useMemo(
    () => (analytics?.dailyHistory ?? []).reduce((sum, entry) => sum + entry.total, 0),
    [analytics?.dailyHistory],
  );
  const passedReviews = React.useMemo(
    () => (analytics?.dailyHistory ?? []).reduce((sum, entry) => sum + entry.passed, 0),
    [analytics?.dailyHistory],
  );
  const totalMinutes = React.useMemo(
    () => timeData.reduce((sum, entry) => sum + entry.minutes, 0),
    [timeData],
  );
  const avgReviews = dailyData.length > 0 ? Math.round(totalReviews / dailyData.length) : 0;
  const streakDays = getReviewStreak(analytics?.dailyHistory ?? []);
  const trendPercent = getTrendPercent(dailyData);
  const weeklyTrendPercent = getRollingWindowTrendPercent(dailyData, 7);
  const windowDaysUsed = analytics?.windowDaysUsed ?? windowDays;

  const lastActivityLabel = React.useMemo(() => {
    const items = analytics?.dailyHistory ?? [];

    for (let index = items.length - 1; index >= 0; index -= 1) {
      const entry = items[index];
      if (entry && entry.total > 0) {
        return parseAnalyticsDate(entry.date).endOf('day').fromNow();
      }
    }

    return null;
  }, [analytics?.dailyHistory]);

  const dueForecastTotal = dueForecastData.reduce((sum, entry) => sum + entry.count, 0);
  const hasAnyActivity = totalReviews > 0 || totalMinutes > 0 || ratingsTotal > 0;
  const deckName = deckStatsQuery.data?.deckName ?? t('analytics.title');

  if (!deckId) {
    return null;
  }

  const handleRefresh = () => {
    void analyticsQuery.refetch();
  };

  const handleOpenNativeStudy = () => {
    toast.info(t('decks.learnInApp.openingToast'));
    openNativeDeckLearning(deckId);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border bg-muted/30 p-2">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold">{deckName}</h1>
                <p className="text-sm text-muted-foreground">{t('analytics.title')}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border bg-muted/30 px-2 py-1">
                    {totals.dueToday.toLocaleString()} {t('analytics.dueForecast')}
                  </span>
                  <span className="rounded-full border bg-muted/30 px-2 py-1">
                    {totals.total.toLocaleString()} {t('analytics.cardTotal')}
                  </span>
                  {deckStatsQuery.data ? (
                    <span className="rounded-full border bg-muted/30 px-2 py-1">
                      {Math.round(deckStatsQuery.data.totalStudyTime).toLocaleString()} {t('analytics.axisYMinutes')}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => navigate({ to: '/my-decks' })}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('analytics.backToDecks')}
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: `/deck-editor/${deckId}` })}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('decks.edit')}
              </Button>
              <Button variant="outline" onClick={handleOpenNativeStudy}>
                <Smartphone className="mr-2 h-4 w-4" />
                {t('decks.learnInApp.action')}
              </Button>
              <Button variant="outline" onClick={handleRefresh} disabled={analyticsQuery.isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${analyticsQuery.isLoading ? 'animate-spin' : ''}`} />
                {t('common.retry')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              aria-label={t('analytics.title')}
              className="inline-flex w-full rounded-2xl border bg-card p-1 sm:w-auto"
              role="radiogroup"
            >
              {WINDOW_OPTIONS.map((value) => {
                const active = windowDays === value;
                const label = value === 0 ? t('analytics.allTime') : t('analytics.lastNDays', { count: value });

                return (
                  <button
                    key={value}
                    aria-checked={active}
                    role="radio"
                    type="button"
                    onClick={() => {
                      startSwitchTransition(() => {
                        setWindowDays(value);
                      });
                    }}
                    className={[
                      'rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {(isSwitchPending || isShowingCachedWindowFallback || (analyticsQuery.isLoading && hasCurrentWindowCache)) ? (
              <div className="inline-flex items-center gap-2 rounded-full border bg-muted/20 px-3 py-1 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                {t('common.loading')}
              </div>
            ) : null}
          </div>

          {analyticsQuery.error ? (
            <Card className="border-destructive/30">
              <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-destructive">{analyticsQuery.error.message}</p>
                <Button variant="outline" onClick={handleRefresh}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('common.retry')}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {isLoadingInitialState ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="h-28 animate-pulse rounded-2xl bg-muted" />
                <div className="h-28 animate-pulse rounded-2xl bg-muted" />
                <div className="h-28 animate-pulse rounded-2xl bg-muted" />
                <div className="h-28 animate-pulse rounded-2xl bg-muted" />
              </div>
              <div className="h-72 animate-pulse rounded-2xl bg-muted" />
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="h-80 animate-pulse rounded-2xl bg-muted" />
                <div className="h-80 animate-pulse rounded-2xl bg-muted" />
              </div>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="h-72 animate-pulse rounded-2xl bg-muted" />
                <div className="h-72 animate-pulse rounded-2xl bg-muted" />
              </div>
            </div>
          ) : null}

          {analytics ? (
            <>
              {!hasAnyActivity ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border bg-muted/20 p-2">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{t('analytics.noAnalytics')}</div>
                        <p className="mt-1 text-sm text-muted-foreground">{t('analytics.dailyActivityDescription')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <SummaryMetricCard label={t('analytics.summaryReviews')} value={totalReviews.toLocaleString()} />
                    <SummaryMetricCard
                      accentClassName="text-emerald-600 dark:text-emerald-400"
                      label={t('analytics.summaryRetention')}
                      value={`${Math.round(retention * 100)}%`}
                    />
                    <SummaryMetricCard
                      accentClassName="text-primary"
                      label={t('analytics.summaryStreak')}
                      value={
                        <span className="inline-flex items-baseline gap-1">
                          <span>{streakDays}</span>
                          <span className="text-sm font-semibold uppercase text-primary/90">{t('analytics.summaryDays')}</span>
                        </span>
                      }
                    />
                    <SummaryMetricCard
                      label={t('analytics.totalStudyTime')}
                      value={`${Math.round(totalMinutes).toLocaleString()} ${t('analytics.axisYMinutes')}`}
                    />
                  </div>
                  {lastActivityLabel ? (
                    <div className="mt-4 text-sm text-muted-foreground">
                      {t('analytics.lastActivity', { time: lastActivityLabel })}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <h2 className="text-base font-semibold">{t('analytics.dailyActivity')}</h2>
                      <div className="flex flex-wrap gap-2">
                        <div className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                          {t('analytics.dailyAverage', { avg: avgReviews })}
                        </div>
                        {weeklyTrendPercent !== null ? (
                          <div className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                            {t('analytics.lastNDays', { count: 7 })} {weeklyTrendPercent > 0 ? '+' : ''}
                            {weeklyTrendPercent}%
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {trendPercent !== null ? (
                      <div
                        className={[
                          'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
                          trendPercent >= 0
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'bg-destructive/10 text-destructive',
                        ].join(' ')}
                      >
                        {trendPercent >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {Math.abs(trendPercent)}%
                      </div>
                    ) : null}
                  </div>
                  <p className="sr-only">
                    {t('analytics.dailySummary', { passed: passedReviews, total: totalReviews })}
                  </p>
                  {dailyData.length > 0 ? (
                    <React.Suspense fallback={<ChartFallback heightClassName="h-56" />}>
                      <LazyDeckDailyActivityChart data={dailyData} reviewsLabel={t('analytics.axisYReviews')} />
                    </React.Suspense>
                  ) : (
                    <EmptySection
                      title={t('analytics.noAnalytics')}
                      description={t('analytics.dailyActivityDescription')}
                    />
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card>
                  <CardContent className="p-4 md:p-6">
                    <h2 className="mb-1 text-base font-semibold">{t('analytics.cardStates')}</h2>
                    <p className="mb-4 text-xs text-muted-foreground">{t('analytics.cardStatesDescription')}</p>
                    <p className="sr-only">
                      {t('analytics.cardStatesSummary', {
                        l: totals.learningCount,
                        n: totals.newCount,
                        r: totals.reviewCount,
                        total: totals.total,
                      })}
                    </p>
                    {cardStatesData.some((item) => item.value > 0) ? (
                      <React.Suspense fallback={<ChartFallback heightClassName="h-56" />}>
                        <LazyDeckCardStatesChart
                          cardsLabel={t('analytics.cardTotal')}
                          data={cardStatesData}
                          totalLabel={t('analytics.cardTotal')}
                          totalValue={totals.total}
                        />
                      </React.Suspense>
                    ) : (
                      <EmptySection title={t('analytics.noAnalytics')} description={t('analytics.cardStatesDescription')} />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 md:p-6">
                    <h2 className="text-base font-semibold">{t('analytics.answerButtons')}</h2>
                    <div className="mt-1 text-xs text-muted-foreground">{t('analytics.timeBasedNote')}</div>
                    <p className="sr-only">{t('analytics.ratingsSummary')}</p>
                    {ratingsTotal > 0 ? (
                      <div className="mt-4">
                        <React.Suspense fallback={<ChartFallback heightClassName="h-56" />}>
                          <LazyDeckRatingsChart data={ratingsData} ratingsLabel={t('analytics.answerButtons')} />
                        </React.Suspense>
                        <div className="mt-4 space-y-2">
                          {ratingsData.map((item) => (
                            <div key={item.label} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{item.label}</span>
                              <span className="font-medium">
                                {item.count.toLocaleString()} ({item.percentage}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <EmptySection title={t('analytics.noAnalytics')} description={t('analytics.ratingsDescription')} />
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card>
                  <CardContent className="p-4 md:p-6">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold">{t('analytics.dueForecast')}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">{t('analytics.dueForecastDescription')}</p>
                      </div>
                      <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                        {dueForecastTotal.toLocaleString()} {t('analytics.cardTotal')}
                      </div>
                    </div>
                    <p className="sr-only">{t('analytics.dueForecastSummary')}</p>
                    {dueForecastData.some((entry) => entry.count > 0) ? (
                      <React.Suspense fallback={<ChartFallback heightClassName="h-52" />}>
                        <LazyDeckDueForecastChart data={dueForecastData} countLabel={t('analytics.axisYCount')} />
                      </React.Suspense>
                    ) : (
                      <EmptySection title={t('analytics.noAnalytics')} description={t('analytics.dueForecastDescription')} />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 md:p-6">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold">{t('analytics.ease')}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">{t('analytics.easeDescription')}</p>
                      </div>
                      <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                        {t('analytics.easeSummary', { total: totals.total })}
                      </div>
                    </div>
                    <p className="sr-only">{t('analytics.easeDescription')}</p>
                    {easeBucketsData.some((entry) => entry.count > 0) ? (
                      <React.Suspense fallback={<ChartFallback heightClassName="h-56" />}>
                        <LazyDeckEaseSpreadChart data={easeBucketsData} countLabel={t('analytics.axisYCount')} />
                      </React.Suspense>
                    ) : (
                      <EmptySection title={t('analytics.noAnalytics')} description={t('analytics.easeDescription')} />
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold">{t('analytics.studyTime')}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{t('analytics.timeSpentDescription')}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-2xl font-bold">
                        {Math.round(totalMinutes).toLocaleString()} {t('analytics.axisYMinutes')}
                      </div>
                      <div className="mt-1 inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                        {windowDaysUsed === 0
                          ? t('analytics.timeSpentAllTimeLabel')
                          : t('analytics.timeSpentWindowLabel', { count: windowDaysUsed })}
                      </div>
                    </div>
                  </div>
                  <p className="sr-only">
                    {windowDaysUsed > 0
                      ? t('analytics.timeSpentSummary', {
                          days: windowDaysUsed,
                          minutes: Math.round(totalMinutes),
                        })
                      : `${t('analytics.timeSpentAllTimeLabel')} ${Math.round(totalMinutes).toLocaleString()} ${t('analytics.axisYMinutes')}`}
                  </p>
                  {timeData.length > 0 ? (
                    <React.Suspense fallback={<ChartFallback heightClassName="h-52" />}>
                      <LazyDeckTimeSpentChart data={timeData} minutesLabel={t('analytics.axisYMinutes')} />
                    </React.Suspense>
                  ) : (
                    <EmptySection title={t('analytics.noAnalytics')} description={t('analytics.timeSpentDescription')} />
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
