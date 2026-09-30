import { FlashcardsPage } from './flashcards';

export function LocalFlashcardsPage() {
    return (
        <FlashcardsPage
            isBulkGenerationEnabled={true}
            hostedDeckActions={false}
            allowTtsProxy={false}
            unsplashTransport="direct"
        />
    );
}
