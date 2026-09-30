import type { FlashcardsResponse } from '@flashly/shared/src';

import type { ProviderTransport } from '@/config/provider-transport';
import { getUnsplashDownloadService } from '@/services/unsplash-download-service';
import { findUnsplashImageUrl, normalizeUnsplashQuery } from '@/utils/unsplash';

const DEFAULT_IMAGE_ATTACH_CONCURRENCY = 2;
const DEFAULT_UNSPLASH_IMAGE_WIDTH = 640;
const DEFAULT_UNSPLASH_IMAGE_QUALITY = 80;

export type ImageAttachOptions = Readonly<{
    unsplashTransport: ProviderTransport;
    unsplashAccessKey: string;
    width?: number;
    quality?: number;
    concurrency?: number;
    abortSignal?: AbortSignal;
    onProgress?: (state: { completed: number; total: number; index: number }) => void;
    onError?: (state: { error: Error; index: number; card: FlashcardsResponse['flashcards'][number] }) => void;
}>;

function toError(value: unknown): Error {
    if (value instanceof Error) {
        return value;
    }
    return new Error(typeof value === 'string' ? value : 'Unknown error');
}

function createAbortError(): Error {
    const error = new Error('Operation aborted');
    error.name = 'AbortError';
    return error;
}

function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
        throw createAbortError();
    }
}

export async function attachImagesToFlashcards(
    cards: FlashcardsResponse['flashcards'],
    options: ImageAttachOptions,
): Promise<FlashcardsResponse['flashcards']> {
    const total = cards.length;
    if (total === 0) return [];

    const results = cards.map((card) => ({ ...card }));
    const concurrency = Math.max(1, options.concurrency ?? DEFAULT_IMAGE_ATTACH_CONCURRENCY);
    let nextIndex = 0;
    let completed = 0;

    const worker = async () => {
        while (true) {
            throwIfAborted(options.abortSignal);
            const index = nextIndex;
            nextIndex += 1;
            if (index >= total) return;

            const card = results[index];
            const existingImage = typeof card.imageUrl === 'string' ? card.imageUrl.trim() : '';
            if (existingImage) {
                completed += 1;
                options.onProgress?.({ completed, total, index });
                continue;
            }

            const query = normalizeUnsplashQuery(
                card.front ?? '',
                card.back ?? '',
                typeof card.imageQuery === 'string' ? card.imageQuery : null,
            );
            if (!query) {
                completed += 1;
                options.onProgress?.({ completed, total, index });
                continue;
            }

            const imageUrlResult = await findUnsplashImageUrl(query, {
                transport: options.unsplashTransport,
                accessKey: options.unsplashAccessKey,
                width: options.width ?? DEFAULT_UNSPLASH_IMAGE_WIDTH,
                quality: options.quality ?? DEFAULT_UNSPLASH_IMAGE_QUALITY,
                abortSignal: options.abortSignal,
            });

            imageUrlResult.match(
                (imageResult) => {
                    throwIfAborted(options.abortSignal);
                    if (imageResult?.url) {
                        results[index] = { ...card, imageUrl: imageResult.url };

                        if (imageResult.downloadLocation) {
                            const service = getUnsplashDownloadService();
                            service.triggerDownload(imageResult.downloadLocation, {
                                transport: options.unsplashTransport,
                                accessKey: options.unsplashAccessKey,
                            });
                        }
                    }
                },
                (error) => {
                    if (options.abortSignal?.aborted) {
                        throw createAbortError();
                    }
                    options.onError?.({ error: toError(error), index, card });
                },
            );

            completed += 1;
            options.onProgress?.({ completed, total, index });
        }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    return results;
}
