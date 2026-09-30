import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useCustomer } from 'autumn-js/react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/utils/style-utils';

const FLASHCARDS_FEATURE_ID = 'flashcards_generation';

const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
};

const formatDate = (value: number) => {
    return new Date(value).toLocaleDateString();
};

interface GenerationQuotaCardProps {
    className?: string;
    compact?: boolean;
    snapshot?: boolean;
}

export function GenerationQuotaCard(props: Readonly<GenerationQuotaCardProps>) {
    const { t } = useTranslation();
    const { customer, isLoading } = useCustomer();

    const loadingIndicator = useMemo(
        () => (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="sr-only">{t('common.loading')}</span>
            </span>
        ),
        [t],
    );

    const activeProduct = useMemo(() => {
        if (!customer?.products) return null;
        const candidates = customer.products.filter(
            (product) => product.status === 'active' || product.status === 'trialing',
        );
        const paidProduct = candidates.find((product) => product.id !== 'free');
        return paidProduct ?? candidates[0] ?? null;
    }, [customer?.products]);

    const planLabel = useMemo(() => {
        if (isLoading) return loadingIndicator;
        if (!activeProduct) return t('web.dashboard.planUnknown');
        if (activeProduct.id === 'free') return t('web.dashboard.freePlan');
        return activeProduct.name || activeProduct.id || t('web.dashboard.planUnknown');
    }, [activeProduct, isLoading, loadingIndicator, t]);

    const feature = customer?.features?.[FLASHCARDS_FEATURE_ID];
    const usage = feature?.usage;
    const includedUsage = feature?.included_usage;
    const usageLimit = feature?.usage_limit;
    const balance = feature?.balance;
    const isUnlimited = feature?.unlimited === true;
    const totalQuota = typeof usageLimit === 'number'
        ? usageLimit
        : typeof includedUsage === 'number'
          ? includedUsage
          : null;

    const usedValue = useMemo(() => {
        if (isLoading) return loadingIndicator;
        if (typeof usage === 'number') {
            return formatNumber(usage);
        }
        return t('web.dashboard.notAvailable');
    }, [isLoading, loadingIndicator, usage, t]);

    const availableValue = useMemo(() => {
        if (isLoading) return loadingIndicator;
        if (!feature) return t('web.dashboard.notAvailable');
        if (isUnlimited) return t('web.dashboard.unlimited');
        if (typeof balance === 'number') return formatNumber(Math.max(balance, 0));
        if (typeof usageLimit === 'number' && typeof usage === 'number') {
            return formatNumber(Math.max(usageLimit - usage, 0));
        }
        if (typeof includedUsage === 'number' && typeof usage === 'number') {
            return formatNumber(Math.max(includedUsage - usage, 0));
        }
        if (typeof usageLimit === 'number') return formatNumber(usageLimit);
        if (typeof includedUsage === 'number') return formatNumber(includedUsage);
        return t('web.dashboard.notAvailable');
    }, [feature, isLoading, loadingIndicator, isUnlimited, balance, usageLimit, usage, includedUsage, t]);

    const resetLabel = useMemo(() => {
        if (!feature?.next_reset_at) return null;
        return t('web.dashboard.resetLabel', {
            date: formatDate(feature.next_reset_at),
        });
    }, [feature?.next_reset_at, t]);

    const usagePercent = useMemo(() => {
        if (typeof usage !== 'number') return null;
        if (typeof usageLimit === 'number' && usageLimit > 0) {
            return Math.min(Math.round((usage / usageLimit) * 100), 100);
        }
        if (typeof includedUsage === 'number' && includedUsage > 0) {
            return Math.min(Math.round((usage / includedUsage) * 100), 100);
        }
        return null;
    }, [includedUsage, usage, usageLimit]);

    const ratioValue = useMemo(() => {
        if (isLoading) return loadingIndicator;
        if (isUnlimited) return t('web.dashboard.unlimited');
        if (typeof usage === 'number' && typeof totalQuota === 'number') {
            return `${formatNumber(usage)} / ${formatNumber(totalQuota)}`;
        }
        return t('web.dashboard.notAvailable');
    }, [isLoading, isUnlimited, loadingIndicator, t, totalQuota, usage]);

    if (props.snapshot) {
        return (
            <Card className={cn('py-6 overflow-hidden bg-gradient-to-br from-card to-muted/20', props.className)}>
                <CardHeader className="space-y-3 pb-0">
                    <CardDescription>{t('web.dashboard.quotaTitle')}</CardDescription>
                    <p className="text-3xl font-semibold">{ratioValue}</p>
                </CardHeader>
                <CardContent className="mt-auto space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t('web.dashboard.availableLabel')}</span>
                        <span className="font-medium text-foreground">{availableValue}</span>
                    </div>
                    {typeof usagePercent === 'number' ? (
                        <Progress
                            value={usagePercent}
                            className="h-2 bg-primary/10"
                            indicatorClassName="bg-gradient-to-r from-primary/50 to-primary"
                            aria-label={t('web.dashboard.quotaUsageLabel')}
                        />
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            {t('web.dashboard.availableLabel')}: {availableValue}
                        </p>
                    )}
                </CardContent>
            </Card>
        );
    }

    if (props.compact) {
        return (
            <Card className={cn('py-6', props.className)}>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <CardTitle>{t('web.dashboard.quotaTitle')}</CardTitle>
                        <CardDescription>{t('web.dashboard.quotaCompactDescription')}</CardDescription>
                    </div>
                    <Badge variant="secondary">{planLabel}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                {t('web.dashboard.usedLabel')}
                            </p>
                            <p className="text-xl font-semibold">{usedValue}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                {t('web.dashboard.availableLabel')}
                            </p>
                            <p className="text-xl font-semibold">{availableValue}</p>
                        </div>
                    </div>
                    {typeof usagePercent === 'number' && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{t('web.dashboard.quotaUsageLabel')}</span>
                                <span>{usagePercent}%</span>
                            </div>
                            <Progress value={usagePercent} className="h-2" />
                        </div>
                    )}
                    {resetLabel && <p className="text-xs text-muted-foreground">{resetLabel}</p>}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn('py-6', props.className)}>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <CardTitle>{t('web.dashboard.quotaTitle')}</CardTitle>
                    <CardDescription>{t('web.dashboard.quotaDescription')}</CardDescription>
                </div>
                <Badge variant="secondary">{planLabel}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">{t('web.dashboard.usedLabel')}</p>
                        <p className="text-2xl font-semibold">{usedValue}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">{t('web.dashboard.availableLabel')}</p>
                        <p className="text-2xl font-semibold">{availableValue}</p>
                    </div>
                </div>
                {resetLabel && <p className="text-sm text-muted-foreground">{resetLabel}</p>}
            </CardContent>
        </Card>
    );
}
