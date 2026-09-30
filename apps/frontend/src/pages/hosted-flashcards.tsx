import { useFeatureIsOn } from '@growthbook/growthbook-react';

import { useAuth } from '@/hooks/use-auth';
import { FlashcardsPage } from './flashcards';

export function HostedFlashcardsPage() {
    const { user } = useAuth();
    const isBulkGenerationEnabled = useFeatureIsOn('bulk-deck-generation');

    return (
        <FlashcardsPage
            settingsUserId={user?.id}
            isBulkGenerationEnabled={isBulkGenerationEnabled}
            hostedDeckActions={true}
            allowTtsProxy={true}
            unsplashTransport="proxy"
        />
    );
}
