import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowRight, BookOpenCheck, Brain, Compass, Layers3, Sparkles } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { useUserStats } from '@/features/analytics/hooks/use-analytics';
import { useDecks } from '@/features/decks/hooks/use-decks';
import { GenerationQuotaCard } from '@/features/dashboard/generation-quota-card';
import type { DeckWithCardCount } from '@/types/api.types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const getDateMs = (value: Date | string | null | undefined) => {
    if (!value) return 0;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
};

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object' && 'message' in error) {
        const message = String((error as { message?: unknown }).message ?? '');
        return message.trim().length > 0 ? message : fallback;
    }
    return fallback;
};

export function Dashboard() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { data: userStats, error: statsError, isLoading: statsLoading } = useUserStats();
    const { data: decksData, error: decksError, isLoading: decksLoading } = useDecks({ page: 1, limit: 8 });

    const relativeTimeFormatter = useMemo(() => {
        const locale = i18n.resolvedLanguage || 'en';
        return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    }, [i18n.resolvedLanguage]);
    const numberFormatter = useMemo(() => {
        const locale = i18n.resolvedLanguage || 'en';
        return new Intl.NumberFormat(locale);
    }, [i18n.resolvedLanguage]);
    const formatNumber = (value: number) => numberFormatter.format(value);

    const totalDecks = userStats?.totalDecks ?? 0;
    const totalCards = userStats?.totalCards ?? 0;
    const cardsStudied = userStats?.cardsStudied ?? 0;
    const cardsLearned = userStats?.cardsLearned ?? 0;
    const cardsReviewing = userStats?.cardsReviewing ?? 0;
    const averageAccuracy = userStats?.averageAccuracy ?? 0;
    const cardsStudiedThisWeek = userStats?.cardsStudiedThisWeek ?? 0;
    const decksStudiedThisWeek = userStats?.decksStudiedThisWeek ?? 0;
    const notStudiedCards = Math.max(totalCards - cardsStudied, 0);

    const studiedCoverage = totalCards > 0 ? Math.round((cardsStudied / totalCards) * 100) : 0;
    const masteredCoverage = totalCards > 0 ? Math.round((cardsLearned / totalCards) * 100) : 0;
    const notStudiedCoverage = totalCards > 0 ? Math.round((notStudiedCards / totalCards) * 100) : 0;

    const recentDecks = useMemo(() => {
        const items: DeckWithCardCount[] = decksData?.items ?? [];
        return [...items]
            .sort((left, right) => {
                const rightRecent = getDateMs(right.lastStudiedAt) || getDateMs(right.createdAt);
                const leftRecent = getDateMs(left.lastStudiedAt) || getDateMs(left.createdAt);
                return rightRecent - leftRecent;
            })
            .slice(0, 4);
    }, [decksData?.items]);

    const snapshotCards = [
        {
            icon: Layers3,
            key: 'decks',
            label: t('web.dashboard.snapshot.totalDecks'),
            progress: totalDecks > 0 ? Math.min(Math.round((decksStudiedThisWeek / totalDecks) * 100), 100) : 0,
            ratio: `${formatNumber(Math.min(decksStudiedThisWeek, totalDecks))} / ${formatNumber(totalDecks)}`,
            supportLabel: t('web.dashboard.weekly.decksStudied'),
            value: formatNumber(totalDecks),
        },
        {
            icon: Brain,
            key: 'cards',
            label: t('web.dashboard.snapshot.totalCards'),
            progress: totalCards > 0 ? Math.min(Math.round((cardsStudiedThisWeek / totalCards) * 100), 100) : 0,
            ratio: `${formatNumber(Math.min(cardsStudiedThisWeek, totalCards))} / ${formatNumber(totalCards)}`,
            supportLabel: t('web.dashboard.weekly.cardsStudied'),
            value: formatNumber(totalCards),
        },
    ];

    const focusState = useMemo(() => {
        if (totalDecks === 0) {
            return {
                action: () => navigate({ to: '/my-decks' }),
                actionLabel: t('web.dashboard.focus.ctaCreate'),
                description: t('web.dashboard.focus.noDecksDescription'),
                title: t('web.dashboard.focus.noDecksTitle'),
            };
        }
        if (cardsStudied === 0) {
            return {
                action: () => navigate({ to: '/my-decks' }),
                actionLabel: t('web.dashboard.focus.ctaReview'),
                description: t('web.dashboard.focus.noStudiedCardsDescription'),
                title: t('web.dashboard.focus.noStudiedCardsTitle'),
            };
        }
        if (cardsReviewing > 0) {
            return {
                action: () => navigate({ to: '/my-decks' }),
                actionLabel: t('web.dashboard.focus.ctaReview'),
                description: t('web.dashboard.focus.reviewingDescription', { count: cardsReviewing }),
                title: t('web.dashboard.focus.reviewingTitle'),
            };
        }
        if (averageAccuracy < 80) {
            return {
                action: () => navigate({ to: '/my-decks' }),
                actionLabel: t('web.dashboard.focus.ctaReview'),
                description: t('web.dashboard.focus.improveAccuracyDescription', { accuracy: averageAccuracy }),
                title: t('web.dashboard.focus.improveAccuracyTitle'),
            };
        }
        return {
            action: () => navigate({ to: '/' }),
            actionLabel: t('web.dashboard.focus.ctaGenerate'),
            description: t('web.dashboard.focus.maintainDescription'),
            title: t('web.dashboard.focus.maintainTitle'),
        };
    }, [averageAccuracy, cardsReviewing, cardsStudied, navigate, t, totalDecks]);

    const formatLastStudied = (date: DeckWithCardCount['lastStudiedAt']) => {
        if (!date) return t('web.dashboard.recentDecks.neverStudied');
        const timestamp = new Date(date).getTime();
        if (!Number.isFinite(timestamp)) return t('web.dashboard.recentDecks.neverStudied');
        const diffDays = Math.round((timestamp - Date.now()) / MS_PER_DAY);
        return relativeTimeFormatter.format(diffDays, 'day');
    };

    const statsErrorMessage = getErrorMessage(statsError, t('web.dashboard.loadError'));
    const decksErrorMessage = getErrorMessage(decksError, t('web.dashboard.loadError'));
    const learnerName = user?.name || t('web.dashboard.anonymousLearner');

    return (
        <div className="space-y-6 pb-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold">{t('web.dashboard.title')}</h1>
                    <p className="text-muted-foreground">{t('web.dashboard.subtitle')}</p>
                    <p className="text-sm text-muted-foreground">
                        {t('web.dashboard.greeting', { name: learnerName })}
                    </p>
                </div>
                <Button onClick={() => navigate({ to: '/my-decks' })}>
                    {t('web.dashboard.primaryAction')}
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>

            {statsError && !userStats && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{t('web.dashboard.errorTitle')}</AlertTitle>
                    <AlertDescription>{statsErrorMessage}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-4 grid-cols-3">
                {statsLoading && !userStats
                    ? Array.from({ length: 2 }).map((_, index) => (
                          <Card key={`dashboard-snapshot-skeleton-${index}`} className="py-6">
                              <CardHeader className="pb-2">
                                  <Skeleton className="h-4 w-24" />
                              </CardHeader>
                              <CardContent>
                                  <Skeleton className="h-8 w-20" />
                              </CardContent>
                          </Card>
                      ))
                    : snapshotCards.map((item) => (
                          <Card
                              key={item.key}
                              className="py-6 overflow-hidden bg-gradient-to-br from-card to-muted/20"
                          >
                              <CardHeader className="space-y-3 pb-0">
                                  <CardDescription className="flex items-center gap-2">
                                      <item.icon className="h-4 w-4 text-muted-foreground" />
                                      {item.label}
                                  </CardDescription>
                                  <p className="text-3xl font-semibold">{item.value}</p>
                              </CardHeader>
                              <CardContent className="mt-auto space-y-2">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                      <span>{item.supportLabel}</span>
                                      <span className="font-medium text-foreground">{item.ratio}</span>
                                  </div>
                                  <Progress
                                      value={item.progress}
                                      className="h-2 bg-primary/10"
                                      indicatorClassName="bg-gradient-to-r from-primary/50 to-primary"
                                      aria-label={item.supportLabel}
                                  />
                              </CardContent>
                          </Card>
                      ))}
                <GenerationQuotaCard snapshot />
            </div>

            <Card className="py-6">
                <CardHeader>
                    <CardTitle>{t('web.dashboard.quickActions.title')}</CardTitle>
                    <CardDescription>{t('web.dashboard.quickActions.description')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-3">
                    <Button variant="outline" className="w-full justify-start" onClick={() => navigate({ to: '/my-decks' })}>
                        <BookOpenCheck className="h-4 w-4" />
                        {t('web.dashboard.quickActions.openDecks')}
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => navigate({ to: '/' })}>
                        <Sparkles className="h-4 w-4" />
                        {t('web.dashboard.quickActions.generateCards')}
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => navigate({ to: '/marketplace' })}
                    >
                        <Compass className="h-4 w-4" />
                        {t('web.dashboard.quickActions.browseMarketplace')}
                    </Button>
                </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="overview">{t('web.dashboard.tabs.overview')}</TabsTrigger>
                        <TabsTrigger value="focus">{t('web.dashboard.tabs.focus')}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                        <Card className="py-6">
                            <CardHeader>
                                <CardTitle>{t('web.dashboard.progress.title')}</CardTitle>
                                <CardDescription>{t('web.dashboard.progress.description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-background to-emerald-500/5 p-4">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span>{t('web.dashboard.progress.studiedCoverage')}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">
                                                        {formatNumber(cardsStudied)} / {formatNumber(totalCards)}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">{studiedCoverage}%</span>
                                                </div>
                                            </div>
                                            <Progress
                                                value={studiedCoverage}
                                                className="h-2.5 bg-primary/10"
                                                indicatorClassName="bg-gradient-to-r from-primary/60 to-primary"
                                                aria-label={t('web.dashboard.progress.studiedCoverage')}
                                            />
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span>{t('web.dashboard.progress.notStudied')}</span>
                                                <span>
                                                    {formatNumber(notStudiedCards)} ({notStudiedCoverage}%)
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span>{t('web.dashboard.progress.masteredCoverage')}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">
                                                        {formatNumber(cardsLearned)} / {formatNumber(totalCards)}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">{masteredCoverage}%</span>
                                                </div>
                                            </div>
                                            <Progress
                                                value={masteredCoverage}
                                                className="h-2.5 bg-emerald-500/15"
                                                indicatorClassName="bg-gradient-to-r from-emerald-400 to-emerald-500"
                                                aria-label={t('web.dashboard.progress.masteredCoverage')}
                                            />
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span>{t('web.dashboard.progress.accuracy')}</span>
                                                <span>{numberFormatter.format(averageAccuracy)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="py-6">
                            <CardHeader>
                                <CardTitle>{t('web.dashboard.recentDecks.title')}</CardTitle>
                                <CardDescription>{t('web.dashboard.recentDecks.description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {decksLoading && !decksData ? (
                                    Array.from({ length: 3 }).map((_, index) => (
                                        <div key={`dashboard-deck-skeleton-${index}`} className="rounded-md border p-3">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="mt-2 h-3 w-48" />
                                        </div>
                                    ))
                                ) : recentDecks.length === 0 ? (
                                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                        {t('web.dashboard.recentDecks.empty')}
                                    </div>
                                ) : (
                                    recentDecks.map((deck) => (
                                        <div
                                            key={deck.id}
                                            className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="space-y-1">
                                                <p className="font-medium leading-tight">{deck.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {t('deckList.cardCount', { count: deck.cardCount })}
                                                    {' · '}
                                                    {formatLastStudied(deck.lastStudiedAt)}
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => navigate({ to: `/deck-editor/${deck.id}` })}
                                            >
                                                {t('web.dashboard.recentDecks.openDeck')}
                                            </Button>
                                        </div>
                                    ))
                                )}
                                {decksError && <p className="text-sm text-destructive">{decksErrorMessage}</p>}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="focus" className="space-y-4">
                        <Card className="py-6">
                            <CardHeader>
                                <CardTitle>{t('web.dashboard.focus.title')}</CardTitle>
                                <CardDescription>{t('web.dashboard.focus.description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-md border p-4">
                                    <p className="text-sm font-semibold">{focusState.title}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{focusState.description}</p>
                                    <Button className="mt-3" size="sm" onClick={focusState.action}>
                                        {focusState.actionLabel}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="py-6">
                            <CardHeader>
                                <CardTitle>{t('web.dashboard.weekly.title')}</CardTitle>
                                <CardDescription>{t('web.dashboard.weekly.description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-md border p-3">
                                    <p className="text-xs text-muted-foreground">{t('web.dashboard.weekly.decksStudied')}</p>
                                    <p className="mt-1 text-2xl font-semibold">{formatNumber(decksStudiedThisWeek)}</p>
                                </div>
                                <div className="rounded-md border p-3">
                                    <p className="text-xs text-muted-foreground">{t('web.dashboard.weekly.cardsStudied')}</p>
                                    <p className="mt-1 text-2xl font-semibold">{formatNumber(cardsStudiedThisWeek)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
