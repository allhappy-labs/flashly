import { errAsync, ResultAsync } from 'neverthrow';
import type { ExternalServiceError, NetworkError, ValidationError } from '@flashly/shared/src';
import { errorFactory } from '@flashly/shared/src';

import type { ProviderTransport } from '@/config/provider-transport';

const UNSPLASH_PROXY_SEARCH_URL = '/api/unsplash/search';
const UNSPLASH_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const UNSPLASH_DIRECT_SEARCH_URL = 'https://api.unsplash.com/search/photos';
const DEFAULT_IMAGE_WIDTH = 640;
const DEFAULT_IMAGE_QUALITY = 80;

const CLOZE_PATTERN = /\{\{c\d+::(.*?)(::.*?)?\}\}/gi;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)]\([^)]*\)/g;
const HTML_TAG_PATTERN = /<[^>]*>/g;
const SYMBOL_PATTERN = /[^\p{L}\p{N}\s-]/gu;

const clampQuery = (value: string) => value.trim().slice(0, 80).trim();

export type UnsplashImage = {
    id: string;
    url: string;
    thumbUrl: string;
    downloadLocation: string;
    description?: string;
    author: string;
    authorUrl: string;
};

export type UnsplashRequestOptions = Readonly<{
    transport: ProviderTransport;
    accessKey?: string;
    width?: number;
    quality?: number;
    abortSignal?: AbortSignal;
}>;

export type UnsplashSearchOptions = UnsplashRequestOptions;

type UnsplashPhotoPayload = Readonly<{
    id: string;
    urls: Readonly<{
        raw?: string;
        small?: string;
    }>;
    links: Readonly<{
        downloadLocation?: string;
    }>;
    description?: string;
    user: Readonly<{
        name?: string;
        htmlUrl?: string;
    }>;
}>;

const sanitizeQuery = (value: string) => {
    // Strip markdown formatting (bold, italic)
    const withoutMarkdown = value
        .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
        .replace(/__(.+?)__/g, '$1')       // __bold__
        .replace(/\*(.+?)\*/g, '$1')       // *italic*
        .replace(/_(.+?)_/g, '$1');        // _italic_

    const withoutCloze = withoutMarkdown.replace(CLOZE_PATTERN, '$1');
    const withoutLinks = withoutCloze.replace(MARKDOWN_LINK_PATTERN, '$1');
    const withoutHtml = withoutLinks.replace(HTML_TAG_PATTERN, ' ');
    const withoutSymbols = withoutHtml.replace(SYMBOL_PATTERN, ' ');
    return clampQuery(withoutSymbols.replace(/\s+/g, ' '));
};

const buildUnsplashImageUrl = (rawUrl: string, width: number, quality: number) => {
    try {
        const url = new URL(rawUrl);
        url.searchParams.set('w', String(width));
        url.searchParams.set('q', String(quality));
        url.searchParams.set('auto', 'format');
        url.searchParams.set('fit', 'crop');
        return url.toString();
    } catch {
        return rawUrl;
    }
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function parseUnsplashPhoto(value: unknown): UnsplashPhotoPayload | null {
    if (!isRecord(value)) {
        return null;
    }

    const id = getString(value.id);
    if (!id) {
        return null;
    }

    const urls = isRecord(value.urls) ? value.urls : {};
    const links = isRecord(value.links) ? value.links : {};
    const user = isRecord(value.user) ? value.user : {};
    const userLinks = isRecord(user.links) ? user.links : {};

    return {
        id,
        urls: {
            raw: getString(urls.raw),
            small: getString(urls.small),
        },
        links: {
            downloadLocation: getString(links.download_location),
        },
        description: getString(value.description),
        user: {
            name: getString(user.name),
            htmlUrl: getString(userLinks.html),
        },
    };
}

function parseUnsplashPhotos(payload: unknown): UnsplashPhotoPayload[] {
    if (!isRecord(payload) || !Array.isArray(payload.results)) {
        return [];
    }

    return payload.results.flatMap((photo) => {
        const parsedPhoto = parseUnsplashPhoto(photo);
        return parsedPhoto ? [parsedPhoto] : [];
    });
}

function createUnsplashSearchRequest(
    options: UnsplashRequestOptions,
    count: number,
    accessKey: string,
): Readonly<{ url: URL; init: RequestInit }> {
    if (options.transport === 'direct') {
        const url = new URL(UNSPLASH_DIRECT_SEARCH_URL);
        url.searchParams.set('query', '');
        url.searchParams.set('per_page', String(count));
        return {
            url,
            init: {
                headers: {
                    Authorization: `Client-ID ${accessKey}`,
                },
                signal: options.abortSignal,
            },
        };
    }

    const url = new URL(UNSPLASH_PROXY_SEARCH_URL, UNSPLASH_API_BASE_URL);
    url.searchParams.set('query', '');
    url.searchParams.set('count', String(count));
    return {
        url,
        init: {
            credentials: 'include',
            signal: options.abortSignal,
        },
    };
}

function fetchUnsplashPhotos(
    query: string,
    count: number,
    options: UnsplashRequestOptions,
): ResultAsync<UnsplashPhotoPayload[], NetworkError | ExternalServiceError | ValidationError> {
    const accessKey = options.accessKey?.trim() ?? '';
    if (options.transport === 'direct' && !accessKey) {
        return errAsync(errorFactory.validation('Unsplash access key is required for direct requests'));
    }

    const request = createUnsplashSearchRequest(options, count, accessKey);
    request.url.searchParams.set('query', query);

    return ResultAsync.fromPromise(
        fetch(request.url.toString(), request.init),
        (error) => errorFactory.network('Failed to fetch from Unsplash', { cause: error }),
    ).andThen((response) => {
        if (!response.ok) {
            return errAsync(errorFactory.externalService(
                `Unsplash request failed: ${response.status}`,
                'unsplash',
                { context: { status: response.status } },
            ));
        }
        return ResultAsync.fromPromise(
            response.json(),
            (error) => errorFactory.validation('Failed to parse Unsplash response', { cause: error }),
        );
    }).map(parseUnsplashPhotos);
}

export const findUnsplashImageUrl = (
    query: string,
    options: UnsplashSearchOptions,
): ResultAsync<UnsplashImageResult | null, NetworkError | ExternalServiceError | ValidationError> => {
    const cleanedQuery = sanitizeQuery(query);
    if (!cleanedQuery) {
        return errAsync(errorFactory.validation('Query is empty after sanitization'));
    }

    const width = options.width ?? DEFAULT_IMAGE_WIDTH;
    const quality = options.quality ?? DEFAULT_IMAGE_QUALITY;

    return fetchUnsplashPhotos(cleanedQuery, 5, options).map((results) => {
        if (results.length === 0) return null;

        const randomIndex = Math.floor(Math.random() * results.length);
        const rawUrl = results[randomIndex]?.urls?.raw ?? results[randomIndex]?.urls?.small;
        const downloadLocation = results[randomIndex]?.links.downloadLocation;
        if (!rawUrl) return null;

        return {
            url: buildUnsplashImageUrl(rawUrl, width, quality),
            downloadLocation: downloadLocation ?? '',
        };
    });
};

export const findUnsplashImages = (
    query: string,
    options: UnsplashSearchOptions & Readonly<{ count?: number }>,
): ResultAsync<UnsplashImage[], NetworkError | ExternalServiceError | ValidationError> => {
    const cleanedQuery = sanitizeQuery(query);
    if (!cleanedQuery) {
        return errAsync(errorFactory.validation('Query is empty after sanitization'));
    }

    const count = options.count ?? 5;
    const width = options.width ?? DEFAULT_IMAGE_WIDTH;
    const quality = options.quality ?? DEFAULT_IMAGE_QUALITY;

    return fetchUnsplashPhotos(cleanedQuery, count, options).map((photos) => {
        return photos.map((photo) => ({
            id: photo.id,
            url: buildUnsplashImageUrl(photo.urls.raw ?? photo.urls.small ?? '', width, quality),
            thumbUrl: buildUnsplashImageUrl(photo.urls.small ?? photo.urls.raw ?? '', 300, 70),
            downloadLocation: photo.links.downloadLocation ?? '',
            description: photo.description,
            author: photo.user.name ?? 'Unknown',
            authorUrl: photo.user.htmlUrl ?? '',
        }));
    });
};

export const normalizeUnsplashQuery = (front: string, back: string, imageQuery?: string | null) => {
    const fromImageQuery = imageQuery ? sanitizeQuery(imageQuery) : '';
    if (fromImageQuery) return fromImageQuery;
    const primary = sanitizeQuery(front);
    if (primary) return primary;
    return sanitizeQuery(back);
};

export type UnsplashImageResult = {
    url: string;
    downloadLocation: string;
};
