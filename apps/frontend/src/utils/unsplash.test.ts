import { afterEach, describe, expect, it, vi } from 'vitest';

import { findUnsplashImages } from './unsplash';

const unsplashResponse = {
    results: [
        {
            id: 'photo-1',
            urls: {
                raw: 'https://images.unsplash.com/photo-1',
                small: 'https://images.unsplash.com/photo-1-small',
            },
            links: {
                download_location: 'https://api.unsplash.com/photos/photo-1/download',
            },
            description: 'Alpine lake',
            user: {
                name: 'Ada',
                links: {
                    html: 'https://unsplash.com/@ada',
                },
            },
        },
    ],
};

describe('findUnsplashImages', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('searches Unsplash directly with the local access key', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(unsplashResponse), { status: 200 }),
        );
        vi.stubGlobal('fetch', fetchSpy);

        const result = await findUnsplashImages('alpine lake', {
            transport: 'direct',
            accessKey: ' local-key ',
            count: 12,
        });

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toEqual([
            {
                id: 'photo-1',
                url: 'https://images.unsplash.com/photo-1?w=640&q=80&auto=format&fit=crop',
                thumbUrl: 'https://images.unsplash.com/photo-1-small?w=300&q=70&auto=format&fit=crop',
                downloadLocation: 'https://api.unsplash.com/photos/photo-1/download',
                description: 'Alpine lake',
                author: 'Ada',
                authorUrl: 'https://unsplash.com/@ada',
            },
        ]);

        const request = fetchSpy.mock.calls[0]?.[0];
        const init = fetchSpy.mock.calls[0]?.[1];
        expect(String(request)).toBe(
            'https://api.unsplash.com/search/photos?query=alpine+lake&per_page=12',
        );
        expect(new Headers(init?.headers).get('Authorization')).toBe('Client-ID local-key');
        expect(init?.credentials).toBeUndefined();
    });

    it('preserves the Flashly proxy request without exposing a client key', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(unsplashResponse), { status: 200 }),
        );
        vi.stubGlobal('fetch', fetchSpy);

        const result = await findUnsplashImages('alpine lake', {
            transport: 'proxy',
            accessKey: 'must-not-leak',
            count: 12,
        });

        expect(result.isOk()).toBe(true);
        const request = fetchSpy.mock.calls[0]?.[0];
        const init = fetchSpy.mock.calls[0]?.[1];
        const requestUrl = new URL(String(request));
        expect(requestUrl.pathname).toBe('/api/unsplash/search');
        expect(requestUrl.searchParams.get('query')).toBe('alpine lake');
        expect(requestUrl.searchParams.get('count')).toBe('12');
        expect(init?.credentials).toBe('include');
        expect(new Headers(init?.headers).has('Authorization')).toBe(false);
    });

    it('rejects direct search without a key before sending a request', async () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);

        const result = await findUnsplashImages('alpine lake', {
            transport: 'direct',
            accessKey: '   ',
            count: 12,
        });

        expect(result.isErr()).toBe(true);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
