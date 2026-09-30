import { UserSettingsForm } from '@/features/settings/user-settings-form';
import { FlashcardGenerationSettingsForm } from '@/features/settings/flashcard-generation-settings-form';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';

export function Account() {
    const { t } = useTranslation();
    const { user } = useAuth();
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    {t('web.account.title')}
                </h1>
                <p className="text-muted-foreground">
                    {t('web.account.subtitle')}
                </p>
            </div>

            <UserSettingsForm />
            <FlashcardGenerationSettingsForm settingsUserId={user?.id} />
        </div>
    );
}
