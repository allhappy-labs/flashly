import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { openNativeLearningApp } from '@/features/decks/utils/native-learning';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, Compass, Lock, ShieldCheck, Smartphone, Sparkles, WandSparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserStats } from '@/features/analytics/hooks/use-analytics';
import { toast } from 'sonner';

const WELCOME_STORAGE_PREFIX = 'flashly.welcome';

const storageKeys = {
    mobile: (userId: string) => `${WELCOME_STORAGE_PREFIX}.mobile.${userId}`,
    marketplace: (userId: string) => `${WELCOME_STORAGE_PREFIX}.marketplace.${userId}`,
    seen: (userId: string) => `${WELCOME_STORAGE_PREFIX}.seen.${userId}`,
};

const readStorageFlag = (key: string) => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(key) === '1';
};

const writeStorageFlag = (key: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, '1');
};

export function Welcome() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { data: userStats } = useUserStats();

    const [canRenderWelcome, setCanRenderWelcome] = useState(false);
    const [hasExploredMarketplace, setHasExploredMarketplace] = useState(false);
    const [hasOpenedMobileApp, setHasOpenedMobileApp] = useState(false);

    useEffect(() => {
        const userId = user?.id;

        if (!userId) {
            setCanRenderWelcome(true);
            return;
        }

        const seenKey = storageKeys.seen(userId);
        if (readStorageFlag(seenKey)) {
            void navigate({ to: '/dashboard' });
            return;
        }

        writeStorageFlag(seenKey);
        setHasExploredMarketplace(readStorageFlag(storageKeys.marketplace(userId)));
        setHasOpenedMobileApp(readStorageFlag(storageKeys.mobile(userId)));
        setCanRenderWelcome(true);
    }, [navigate, user?.id]);

    const hasGeneratedCards = (userStats?.totalCards ?? 0) > 0;
    const completedSteps = Number(hasGeneratedCards) + Number(hasExploredMarketplace) + Number(hasOpenedMobileApp);
    const checklistProgress = Math.round((completedSteps / 3) * 100);

    const learnerName = user?.name || user?.email || t('web.welcome.there');

    const handleExploreMarketplace = useCallback(() => {
        if (user?.id) {
            writeStorageFlag(storageKeys.marketplace(user.id));
            setHasExploredMarketplace(true);
        }
        void navigate({ to: '/marketplace' });
    }, [navigate, user?.id]);

    const handleOpenMobileApp = useCallback(() => {
        if (user?.id) {
            writeStorageFlag(storageKeys.mobile(user.id));
            setHasOpenedMobileApp(true);
        }
        toast.info(t('web.welcome.steps.mobile.toast'));
        openNativeLearningApp();
    }, [t, user?.id]);

    const handleGenerateCards = useCallback(() => {
        void navigate({ to: '/' });
    }, [navigate]);

    const handleSkipToDashboard = useCallback(() => {
        void navigate({ to: '/dashboard' });
    }, [navigate]);

    const checklistItems = useMemo(
        () => [
            {
                action: () => {
                    handleGenerateCards();
                },
                actionLabel: t('web.welcome.steps.generate.action'),
                completed: hasGeneratedCards,
                description: t('web.welcome.steps.generate.description'),
                icon: WandSparkles,
                id: 'generate',
                title: t('web.welcome.steps.generate.title'),
            },
            {
                action: handleExploreMarketplace,
                actionLabel: t('web.welcome.steps.explore.action'),
                completed: hasExploredMarketplace,
                description: t('web.welcome.steps.explore.description'),
                icon: Compass,
                id: 'explore',
                title: t('web.welcome.steps.explore.title'),
            },
            {
                action: handleOpenMobileApp,
                actionLabel: t('web.welcome.steps.mobile.action'),
                completed: hasOpenedMobileApp,
                description: t('web.welcome.steps.mobile.description'),
                icon: Smartphone,
                id: 'mobile',
                title: t('web.welcome.steps.mobile.title'),
            },
        ],
        [
            handleExploreMarketplace,
            handleGenerateCards,
            handleOpenMobileApp,
            hasExploredMarketplace,
            hasGeneratedCards,
            hasOpenedMobileApp,
            t,
        ],
    );

    if (!canRenderWelcome) {
        return (
            <div className="min-h-[40vh] flex items-center justify-center">
                <p className="text-muted-foreground">{t('common.loading')}</p>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6 pb-6">
            <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-background to-accent/15 p-6 shadow-[0_22px_60px_-45px_rgba(33,62,128,0.72)] sm:p-8">
                <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
                <div className="relative space-y-4">
                    <Badge variant="outline">{t('web.welcome.badge')}</Badge>
                    <h1 className="text-3xl font-bold sm:text-4xl">{t('web.welcome.title')}</h1>
                    <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
                        {t('web.welcome.subtitle', { name: learnerName })}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={handleGenerateCards}>
                            {t('web.welcome.primaryAction')}
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" onClick={handleExploreMarketplace}>
                            {t('web.welcome.secondaryAction')}
                        </Button>
                        <Button variant="ghost" onClick={handleSkipToDashboard}>
                            {t('web.welcome.skipAction')}
                        </Button>
                    </div>
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Card className="py-6">
                    <CardHeader>
                        <CardTitle>{t('web.welcome.checklist.title')}</CardTitle>
                        <CardDescription>{t('web.welcome.checklist.description')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{t('web.welcome.checklist.progressLabel')}</span>
                                <span className="font-medium">
                                    {t('web.welcome.checklist.progressValue', { completed: completedSteps, total: 3 })}
                                </span>
                            </div>
                            <Progress value={checklistProgress} />
                        </div>
                        <div className="space-y-3">
                            {checklistItems.map((item) => (
                                <div key={item.id} className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-start gap-3">
                                        <Checkbox checked={item.completed} disabled aria-label={item.title} />
                                        <div className="space-y-1">
                                            <p className="flex items-center gap-2 font-medium">
                                                <item.icon className="h-4 w-4 text-primary" />
                                                {item.title}
                                            </p>
                                            <p className="text-sm text-muted-foreground">{item.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 self-end sm:self-auto">
                                        {item.completed ? <Badge variant="secondary">{t('web.welcome.checklist.completed')}</Badge> : null}
                                        <Button variant="outline" size="sm" onClick={item.action}>
                                            {item.actionLabel}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="py-6">
                        <CardHeader>
                            <CardTitle>{t('web.welcome.capabilities.title')}</CardTitle>
                            <CardDescription>{t('web.welcome.capabilities.description')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="rounded-xl border p-3">
                                <p className="font-medium">{t('web.welcome.capabilities.generateTitle')}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{t('web.welcome.capabilities.generateDescription')}</p>
                            </div>
                            <div className="rounded-xl border p-3">
                                <p className="font-medium">{t('web.welcome.capabilities.exploreTitle')}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{t('web.welcome.capabilities.exploreDescription')}</p>
                            </div>
                            <div className="rounded-xl border p-3">
                                <p className="font-medium">{t('web.welcome.capabilities.mobileTitle')}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{t('web.welcome.capabilities.mobileDescription')}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="py-6">
                        <CardHeader>
                            <CardTitle>{t('web.welcome.trust.title')}</CardTitle>
                            <CardDescription>{t('web.welcome.trust.description')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-start gap-3 rounded-lg border p-3">
                                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                                <div>
                                    <p className="font-medium">{t('web.welcome.trust.magicLinkTitle')}</p>
                                    <p className="text-sm text-muted-foreground">{t('web.welcome.trust.magicLinkDescription')}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 rounded-lg border p-3">
                                <Lock className="mt-0.5 h-4 w-4 text-primary" />
                                <div>
                                    <p className="font-medium">{t('web.welcome.trust.localDataTitle')}</p>
                                    <p className="text-sm text-muted-foreground">{t('web.welcome.trust.localDataDescription')}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 rounded-lg border p-3">
                                <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                                <div>
                                    <p className="font-medium">{t('web.welcome.trust.controlTitle')}</p>
                                    <p className="text-sm text-muted-foreground">{t('web.welcome.trust.controlDescription')}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
                <Button variant="outline" asChild>
                    <Link to="/account">{t('web.welcome.accountSettings')}</Link>
                </Button>
                <Button asChild>
                    <Link to="/dashboard">
                        {t('web.welcome.goToDashboard')}
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </Button>
            </div>
        </div>
    );
}
