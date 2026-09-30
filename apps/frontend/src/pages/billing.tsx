import { BillingSettings } from '@/features/settings/billing-settings';
import { useTranslation } from 'react-i18next';

export function Billing() {
    const { t } = useTranslation();
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    {t('web.billing.title')}
                </h1>
                <p className="text-muted-foreground">
                    {t('web.billing.subtitle')}
                </p>
            </div>

            <BillingSettings />
        </div>
    );
}
