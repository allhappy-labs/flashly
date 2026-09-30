import { useCallback, useEffect, useRef, useState } from 'react';
import type {
    MarketplaceDeck,
    MarketplaceQuery,
    MarketplaceTrendingDeck,
} from '../services/marketplace/marketplace-types';
import { getMarketplaceService } from '../services/marketplace/marketplace-service';

type UseMarketplaceDiscoveryOptions = {
    buildQuery: (page: number) => MarketplaceQuery;
    serviceUnavailableMessage: string;
    loadErrorMessage: string;
};

export type MarketplaceDiscoveryState = {
    decks: MarketplaceDeck[];
    featuredDecks: MarketplaceDeck[];
    trendingDecks: MarketplaceTrendingDeck[];
    isLoading: boolean;
    isRefreshing: boolean;
    isLoadingMore: boolean;
    hasMore: boolean;
    page: number;
    errorMessage: string | null;
    refresh: () => Promise<void>;
    loadMore: () => Promise<void>;
    runDiscovery: (refresh: boolean, pageOverride?: number) => Promise<void>;
};

export function useMarketplaceDiscovery(
    options: UseMarketplaceDiscoveryOptions
): MarketplaceDiscoveryState {
    const { buildQuery, loadErrorMessage, serviceUnavailableMessage } = options;
    const [decks, setDecks] = useState<MarketplaceDeck[]>([]);
    const [featuredDecks, setFeaturedDecks] = useState<MarketplaceDeck[]>([]);
    const [trendingDecks, setTrendingDecks] = useState<MarketplaceTrendingDeck[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const requestIdRef = useRef(0);
    const mountedRef = useRef(true);

    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const isLatestRequest = useCallback((requestId: number) => {
        return mountedRef.current && requestId === requestIdRef.current;
    }, []);

    const loadDiscoverySections = useCallback(async (requestId: number) => {
        const marketplaceService = getMarketplaceService();
        if (!marketplaceService) {
            if (!isLatestRequest(requestId)) {
                return;
            }
            setFeaturedDecks([]);
            setTrendingDecks([]);
            return;
        }

        const [featuredResult, trendingResult] = await Promise.all([
            marketplaceService.getFeaturedDecks(8),
            marketplaceService.getTrendingDecks('week', 8),
        ]);

        if (!isLatestRequest(requestId)) {
            return;
        }

        featuredResult.match(
            (value) => setFeaturedDecks(value),
            () => setFeaturedDecks([])
        );
        trendingResult.match(
            (value) => setTrendingDecks(value.decks),
            () => setTrendingDecks([])
        );
    }, [isLatestRequest]);

    const runDiscovery = useCallback(async (refresh: boolean, pageOverride?: number) => {
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;

        if (refresh) {
            setIsRefreshing(true);
            setIsLoading(true);
            setErrorMessage(null);
        } else {
            setIsLoadingMore(true);
        }

        try {
            const marketplaceService = getMarketplaceService();
            if (!marketplaceService) {
                if (!isLatestRequest(requestId)) {
                    return;
                }
                setErrorMessage(serviceUnavailableMessage);
                return;
            }

            const nextPage = refresh ? 1 : (pageOverride ?? 1);
            const browseResult = await marketplaceService.browseDecks(buildQuery(nextPage));
            if (!isLatestRequest(requestId)) {
                return;
            }

            browseResult.match(
                (response) => {
                    setDecks((previous) => (refresh ? response.items : [...previous, ...response.items]));
                    setHasMore(response.hasMore);
                    setPage(response.page);
                    setErrorMessage(null);
                },
                (error) => {
                    if (refresh) {
                        setDecks([]);
                    }
                    setErrorMessage(error.message || loadErrorMessage);
                }
            );

            if (!refresh) {
                return;
            }
            // Keep refresh responsive by fetching secondary discovery sections in background.
            void loadDiscoverySections(requestId);
        } finally {
            if (isLatestRequest(requestId)) {
                setIsLoading(false);
                setIsRefreshing(false);
                setIsLoadingMore(false);
            }
        }
    }, [buildQuery, isLatestRequest, loadDiscoverySections, loadErrorMessage, serviceUnavailableMessage]);

    const refresh = useCallback(async () => {
        await runDiscovery(true);
    }, [runDiscovery]);

    const loadMore = useCallback(async () => {
        if (isLoading || isRefreshing || isLoadingMore || !hasMore) {
            return;
        }
        await runDiscovery(false, page + 1);
    }, [hasMore, isLoading, isLoadingMore, isRefreshing, page, runDiscovery]);

    return {
        decks,
        featuredDecks,
        trendingDecks,
        isLoading,
        isRefreshing,
        isLoadingMore,
        hasMore,
        page,
        errorMessage,
        refresh,
        loadMore,
        runDiscovery,
    };
}
