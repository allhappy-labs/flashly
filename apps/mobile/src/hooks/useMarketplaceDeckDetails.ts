import { useCallback, useEffect, useRef, useState } from 'react';
import type {
    DeckPreviewCard,
    MarketplaceDeckWithCards,
    MarketplaceSimilarDeck,
} from '../services/marketplace/marketplace-types';
import { getMarketplaceService } from '../services/marketplace/marketplace-service';

type UseMarketplaceDeckDetailsOptions = {
    deckId: string;
    serviceUnavailableMessage: string;
    loadDetailsErrorMessage: string;
};

type MarketplaceDeckDetailsState = {
    deck: MarketplaceDeckWithCards | null;
    previewCards: DeckPreviewCard[];
    similarDecks: MarketplaceSimilarDeck[];
    isLoading: boolean;
    loadError: string | null;
    reload: () => Promise<void>;
};

export function useMarketplaceDeckDetails(
    options: UseMarketplaceDeckDetailsOptions
): MarketplaceDeckDetailsState {
    const [deck, setDeck] = useState<MarketplaceDeckWithCards | null>(null);
    const [previewCards, setPreviewCards] = useState<DeckPreviewCard[]>([]);
    const [similarDecks, setSimilarDecks] = useState<MarketplaceSimilarDeck[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const requestIdRef = useRef(0);
    const mountedRef = useRef(true);

    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const reload = useCallback(async () => {
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        const isLatestRequest = () => mountedRef.current && requestId === requestIdRef.current;

        setIsLoading(true);
        setLoadError(null);

        try {
            const marketplaceService = getMarketplaceService();
            if (!marketplaceService) {
                if (!isLatestRequest()) {
                    return;
                }
                setDeck(null);
                setPreviewCards([]);
                setSimilarDecks([]);
                setLoadError(options.serviceUnavailableMessage);
                return;
            }

            const [deckResult, similarResult] = await Promise.all([
                marketplaceService.getDeckDetails(options.deckId),
                marketplaceService.getSimilarDecks(options.deckId, 6),
            ]);

            if (!isLatestRequest()) {
                return;
            }

            deckResult.match(
                (value) => {
                    setDeck(value);
                    const cards = Array.isArray(value.cards) ? value.cards : [];
                    setPreviewCards(cards.slice(0, 6));
                },
                (error) => {
                    setDeck(null);
                    setPreviewCards([]);
                    setLoadError(error.message || options.loadDetailsErrorMessage);
                }
            );

            similarResult.match(
                (value) => setSimilarDecks(value.decks),
                () => setSimilarDecks([])
            );
        } finally {
            if (isLatestRequest()) {
                setIsLoading(false);
            }
        }
    }, [options.deckId, options.loadDetailsErrorMessage, options.serviceUnavailableMessage]);

    return {
        deck,
        previewCards,
        similarDecks,
        isLoading,
        loadError,
        reload,
    };
}
