import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { okAsync } from 'neverthrow';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FlashcardMaterialType, MediaFailure } from '@flashly/shared/src';

import type { ProviderTransport } from '@/config/provider-transport';
import { useFlashcardMediaActions } from './use-flashcard-media-actions';

const doubles = vi.hoisted(() => ({
    attachImages: vi.fn(),
    findImage: vi.fn(),
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

vi.mock('@/services/unsplash-download-service', () => ({
    getUnsplashDownloadService: () => ({
        triggerDownload: vi.fn(),
    }),
}));

vi.mock('@/utils/elevenlabs-settings', () => ({
    getElevenLabsSettings: () => ({
        apiKey: '',
        voiceName: '',
        modelId: '',
    }),
}));

vi.mock('@/utils/logger', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    }),
}));

vi.mock('@/utils/unsplash', () => ({
    findUnsplashImageUrl: doubles.findImage,
    normalizeUnsplashQuery: (front: string) => front,
}));

vi.mock('@/utils/unsplash-settings', () => ({
    getUnsplashSettings: () => ({
        accessKey: '',
    }),
}));

vi.mock('./utils/attach-images-to-flashcards', () => ({
    attachImagesToFlashcards: doubles.attachImages,
}));

const card = {
    front: 'Alpine lake',
    back: 'A lake in the Alps',
};
const materialType: FlashcardMaterialType = 'General';
const unsplashTransport: ProviderTransport = 'direct';

type MediaActions = ReturnType<typeof useFlashcardMediaActions>;

type ProbeProps = Readonly<{
    onReady: (actions: MediaActions) => void;
    requestSettingsOpen: () => void;
}>;

function MediaActionsProbe(props: ProbeProps) {
    const actionParams = {
        flashcards: { flashcards: [card] },
        streamedCards: [card],
        retryingCardIds: new Set<string>(),
        userId: undefined,
        elevenLabsApiKey: '',
        elevenLabsVoiceName: '',
        elevenLabsModelId: '',
        ttsProxyUrl: '',
        materialType,
        selectedLanguageId: undefined,
        isGeneratingAudio: false,
        setIsGeneratingAudio: () => undefined,
        setAudioProgress: () => undefined,
        isGeneratingImages: false,
        setIsGeneratingImages: () => undefined,
        setImageProgress: () => undefined,
        setMediaFailures: () => undefined,
        setRetryingCardIds: () => undefined,
        getStableCardId: () => 'card-1',
        onUpdateWithAudio: () => undefined,
        onUpdateWithImages: () => undefined,
        requestSettingsOpen: props.requestSettingsOpen,
        unsplashTransport,
        unsplashAccessKey: 'stale-key',
        unsplashImageWidth: 640,
        unsplashImageQuality: 80,
        t: i18next.t,
    };
    const actions = useFlashcardMediaActions(actionParams);
    props.onReady(actions);
    return null;
}

function renderMediaActions(requestSettingsOpen: () => void): MediaActions {
    let actions: MediaActions | undefined;
    renderToStaticMarkup(
        <MediaActionsProbe
            requestSettingsOpen={requestSettingsOpen}
            onReady={(nextActions) => {
                actions = nextActions;
            }}
        />,
    );
    if (!actions) {
        throw new Error('Media actions were not captured');
    }
    return actions;
}

describe('direct Unsplash media actions', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
        doubles.attachImages.mockReset();
        doubles.findImage.mockReset();
    });

    it('blocks bulk generation when current storage is empty despite a stale rendered key', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ results: [] }), { status: 200 }),
        );
        vi.stubGlobal('fetch', fetchSpy);
        doubles.attachImages.mockImplementation(async () => {
            await fetch('https://api.unsplash.com/search/photos');
            return [card];
        });
        const requestSettingsOpen = vi.fn();
        const actions = renderMediaActions(requestSettingsOpen);

        await actions.handleGenerateImages();

        expect(requestSettingsOpen).toHaveBeenCalledOnce();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('blocks retry when current storage is empty despite a stale rendered key', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ results: [] }), { status: 200 }),
        );
        vi.stubGlobal('fetch', fetchSpy);
        doubles.findImage.mockImplementation(() => {
            void fetch('https://api.unsplash.com/search/photos');
            return okAsync({
                url: 'https://images.unsplash.com/photo-1',
                downloadLocation: '',
            });
        });
        const requestSettingsOpen = vi.fn();
        const actions = renderMediaActions(requestSettingsOpen);
        const failure: MediaFailure = {
            cardId: 'card-1',
            cardIndex: 0,
            card,
            errorType: 'image',
            errorMessage: 'Previous search failed',
            timestamp: 1,
        };

        await actions.handleRetryImage(failure);

        expect(requestSettingsOpen).toHaveBeenCalledOnce();
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
