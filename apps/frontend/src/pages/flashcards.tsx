import { useCallback, useState } from 'react';
import { FlashcardGeneratorLazy } from '@/features/flashcards/flashcard-generator-lazy';
import { FlashcardGenerationSettingsForm } from '@/features/settings/flashcard-generation-settings-form';
import { Button } from '@/components/ui/button';
import { Settings, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ProviderTransport } from '@/config/provider-transport';

export type FlashcardsPageProps = Readonly<{
    settingsUserId?: string;
    isBulkGenerationEnabled: boolean;
    hostedDeckActions: boolean;
    allowTtsProxy: boolean;
    unsplashTransport: ProviderTransport;
}>;

export function FlashcardsPage(props: FlashcardsPageProps) {
    const [showSettings, setShowSettings] = useState(false);
    const { t } = useTranslation();
    const handleRequestSettingsOpen = useCallback(() => {
        setShowSettings(true);
    }, []);
    return (
        <div className="space-y-8">
            <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">
                        {t('web.flashcards.title')}
                    </h1>
                    <p className="text-muted-foreground mt-1 max-w-2xl">
                        {t('web.flashcards.subtitle')}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-controls="openrouter-settings"
                    aria-expanded={showSettings}
                    aria-label={showSettings ? t('web.flashcards.hideSettings') : t('web.flashcards.showSettings')}
                    onClick={() => setShowSettings((value) => !value)}
                >
                    {showSettings ? <X /> : <Settings />}
                </Button>
            </div>
            {showSettings && (
                <section id="openrouter-settings" className="space-y-4">
                    <FlashcardGenerationSettingsForm settingsUserId={props.settingsUserId} />
                </section>
            )}
            <FlashcardGeneratorLazy
                onRequestSettingsOpen={handleRequestSettingsOpen}
                settingsUserId={props.settingsUserId}
                isBulkGenerationEnabled={props.isBulkGenerationEnabled}
                hostedDeckActions={props.hostedDeckActions}
                allowTtsProxy={props.allowTtsProxy}
                unsplashTransport={props.unsplashTransport}
            />
        </div>
    );
}
