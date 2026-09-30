import { lazy, Suspense } from 'react';

import { LoadingFallback } from '@/components/ui/loading-fallback';
import type { ProviderTransport } from '@/config/provider-transport';

const FlashcardGenerator = lazy(() => import('./flashcard-generator').then((m) => ({ default: m.FlashcardGenerator })));
const loadingFallback = <LoadingFallback />;

type FlashcardGeneratorLazyProps = Readonly<{
    onRequestSettingsOpen?: () => void;
    settingsUserId?: string;
    isBulkGenerationEnabled: boolean;
    hostedDeckActions: boolean;
    allowTtsProxy: boolean;
    unsplashTransport: ProviderTransport;
}>;

export function FlashcardGeneratorLazy(props: FlashcardGeneratorLazyProps) {
    return (
        <Suspense fallback={loadingFallback}>
            <FlashcardGenerator
                onRequestSettingsOpen={props.onRequestSettingsOpen}
                settingsUserId={props.settingsUserId}
                isBulkGenerationEnabled={props.isBulkGenerationEnabled}
                hostedDeckActions={props.hostedDeckActions}
                allowTtsProxy={props.allowTtsProxy}
                unsplashTransport={props.unsplashTransport}
            />
        </Suspense>
    );
}
