import { errAsync, ResultAsync, okAsync } from 'neverthrow';
import type { ExternalServiceError, NetworkError, ValidationError } from '@flashly/shared';
import { retry, errorFactory } from '@flashly/shared';

import type { ProviderTransport } from '@/config/provider-transport';

const UNSPLASH_DOWNLOAD_TRACK_URL = new URL(
    '/api/unsplash/download/track',
    import.meta.env.VITE_API_URL || 'http://localhost:3001'
).toString();

export type UnsplashTrackingOptions = Readonly<{
    transport: ProviderTransport;
    accessKey?: string;
}>;

/**
 * Service for triggering Unsplash download endpoint compliance.
 *
 * Unsplash API requires triggering the download endpoint whenever a photo
 * is viewed or used by users. This service handles:
 * - Triggering download endpoint with retry logic
 * - Tracking by photo ID to prevent duplicates (session-based)
 * - Silent failure after retries exhausted (logs only)
 *
 * @see https://help.unsplash.com/en/articles/2511255-guideline-triggering-a-download
 */
class UnsplashDownloadService {
    private triggeredPhotoKeys: Set<string> = new Set();
    private failedAttempts: number = 0;

    /**
     * Extract photo ID from download location URL
     * @example
     * extractPhotoId("https://api.unsplash.com/photos/abc123/download") // "abc123"
     */
    private extractPhotoId(downloadLocation: string): string | null {
        try {
            const url = new URL(downloadLocation);
            const pathParts = url.pathname.split('/');
            // Path format: /photos/{photoId}/download
            const photosIndex = pathParts.indexOf('photos');
            if (photosIndex !== -1 && pathParts[photosIndex + 1]) {
                return pathParts[photosIndex + 1];
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Check if download was already triggered for a photo ID
     */
    wasTriggered(photoId: string, transport?: ProviderTransport): boolean {
        if (transport) {
            return this.triggeredPhotoKeys.has(`${transport}:${photoId}`);
        }

        return this.triggeredPhotoKeys.has(`direct:${photoId}`)
            || this.triggeredPhotoKeys.has(`proxy:${photoId}`);
    }

    /**
     * Trigger Unsplash download endpoint for a photo
     *
     * Uses fire-and-forget pattern - callers don't need to await the result.
     * Failures are silent (logged to console.warn) to avoid affecting UX.
     *
     * @param downloadLocation - The download URL from photo.links.download_location
     * @returns ResultAsync that resolves when download is triggered or fails silently
     */
    triggerDownload(
        downloadLocation: string,
        options: UnsplashTrackingOptions,
    ): ResultAsync<void, NetworkError | ExternalServiceError | ValidationError> {
        const photoId = options.transport === 'direct'
            ? this.extractDirectPhotoId(downloadLocation)
            : this.extractPhotoId(downloadLocation);
        if (!photoId) {
            if (options.transport === 'direct') {
                return errAsync(
                    errorFactory.validation('Invalid Unsplash direct download location'),
                );
            }
            console.warn('[UnsplashDownload] Invalid download location:', downloadLocation);
            return okAsync(undefined);
        }

        const accessKey = options.accessKey?.trim() ?? '';
        if (options.transport === 'direct' && !accessKey) {
            return errAsync(
                errorFactory.validation('Unsplash access key is required for direct tracking'),
            );
        }

        const photoKey = `${options.transport}:${photoId}`;

        // Skip if already triggered this session
        if (this.triggeredPhotoKeys.has(photoKey)) {
            return okAsync(undefined);
        }

        // Mark as triggered immediately (before async operation)
        this.triggeredPhotoKeys.add(photoKey);

        // Trigger download with retry logic (non-blocking)
        // Fire-and-forget: trigger async but don't wait for result
        retry(
            () => {
                const requestUrl = options.transport === 'direct'
                    ? downloadLocation
                    : UNSPLASH_DOWNLOAD_TRACK_URL;
                const requestInit: RequestInit = options.transport === 'direct'
                    ? {
                        method: 'GET',
                        headers: {
                            Authorization: `Client-ID ${accessKey}`,
                        },
                    }
                    : {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ downloadLocation }),
                    };

                return ResultAsync.fromPromise(
                    fetch(requestUrl, requestInit),
                    (error) => errorFactory.network('Failed to trigger Unsplash download', { cause: error })
                ).andThen((response) => {
                    if (!response.ok) {
                        return ResultAsync.fromPromise(
                            Promise.reject(new Error(`HTTP ${response.status}`)),
                            (error) => errorFactory.externalService(
                                `Unsplash download endpoint failed: ${response.status}`,
                                'unsplash',
                                { cause: error }
                            )
                        );
                    }
                    return okAsync(undefined);
                });
            },
            {
                maxAttempts: 3,
                delayMs: 1000, // 1s -> 2s -> 4s (exponential backoff)
                backoffMultiplier: 2,
            }
        ).then((result) => {
            if (result.isErr()) {
                // Silent failure: log to console but don't throw
                this.failedAttempts += 1;
                console.warn('[UnsplashDownload] Failed after retries:', {
                    photoId,
                    error: result.error.message,
                    totalFailed: this.failedAttempts,
                });
            }
        });

        // Return immediately (fire-and-forget)
        return okAsync(undefined);
    }

    private extractDirectPhotoId(downloadLocation: string): string | null {
        try {
            const url = new URL(downloadLocation);
            if (url.protocol !== 'https:' || url.hostname !== 'api.unsplash.com') {
                return null;
            }

            const pathMatch = /^\/photos\/([^/]+)\/download$/.exec(url.pathname);
            return pathMatch?.[1] ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Get statistics for debugging/monitoring
     */
    getStats(): { totalTriggered: number; failedAttempts: number } {
        return {
            totalTriggered: this.triggeredPhotoKeys.size,
            failedAttempts: this.failedAttempts,
        };
    }

    /**
     * Clear all state (for testing purposes)
     */
    clear(): void {
        this.triggeredPhotoKeys.clear();
        this.failedAttempts = 0;
    }

    /**
     * Reset to initial state (for testing purposes)
     */
    reset(): void {
        this.clear();
    }
}

// Singleton instance
let serviceInstance: UnsplashDownloadService | null = null;

/**
 * Get the singleton UnsplashDownloadService instance
 */
export function getUnsplashDownloadService(): UnsplashDownloadService {
    if (!serviceInstance) {
        serviceInstance = new UnsplashDownloadService();
    }
    return serviceInstance;
}

/**
 * Create a new UnsplashDownloadService instance (for testing)
 */
export function createUnsplashDownloadService(): UnsplashDownloadService {
    return new UnsplashDownloadService();
}
