import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createUnsplashDownloadService } from '../unsplash-download-service';

// Mock global.fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to wait for async operations
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('UnsplashDownloadService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockClear();
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
        });
    });

    afterEach(() => {
        // Clean up any pending promises
        mockFetch.mockReset();
    });

    describe('extractPhotoId', () => {
        it('should extract photo ID from valid download location URL', () => {
            const service = createUnsplashDownloadService();

            // Access private method through triggerDownload behavior
            const downloadLocation = 'https://api.unsplash.com/photos/abc123/download';
            service.triggerDownload(downloadLocation, { transport: 'proxy' });

            // Verify photo was marked as triggered
            expect(service.getStats().totalTriggered).toBe(1);
        });

        it('should handle malformed URL gracefully', async () => {
            const service = createUnsplashDownloadService();

            const result = await service.triggerDownload('invalid-url', { transport: 'proxy' });

            // Should resolve without error (Ok with undefined value)
            expect(result.isOk()).toBe(true);
            expect(service.getStats().totalTriggered).toBe(0);
        });

        it('should handle URL without photos segment', async () => {
            const service = createUnsplashDownloadService();

            const result = await service.triggerDownload(
                'https://api.unsplash.com/other/abc123',
                { transport: 'proxy' },
            );

            // Should resolve without error (Ok with undefined value)
            expect(result.isOk()).toBe(true);
        });
    });

    describe('wasTriggered', () => {
        it('should return false for untriggered photo', () => {
            const service = createUnsplashDownloadService();

            expect(service.wasTriggered('photo-123')).toBe(false);
        });

        it('should return true for triggered photo', () => {
            const service = createUnsplashDownloadService();
            const downloadLocation = 'https://api.unsplash.com/photos/photo-123/download';

            service.triggerDownload(downloadLocation, { transport: 'proxy' });

            expect(service.wasTriggered('photo-123')).toBe(true);
        });
    });

    describe('triggerDownload', () => {
        it('posts a proxied image to the Flashly tracking endpoint', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
            });

            const service = createUnsplashDownloadService();
            const downloadLocation = 'https://api.unsplash.com/photos/photo-123/download';
            await service.triggerDownload(downloadLocation, { transport: 'proxy' });
            // Wait for async operation
            await wait(100);

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringMatching(/\/api\/unsplash\/download\/track$/),
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ downloadLocation }),
                }
            );
        });

        it('tracks a local image at the provider URL with the local key', async () => {
            mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

            const service = createUnsplashDownloadService();
            service.triggerDownload(
                'https://api.unsplash.com/photos/photo-1/download',
                { transport: 'direct', accessKey: ' local-key ' },
            );

            await vi.waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.unsplash.com/photos/photo-1/download',
                    expect.objectContaining({
                        method: 'GET',
                        headers: { Authorization: 'Client-ID local-key' },
                    }),
                );
            });
        });

        it('rejects direct tracking without a key before sending a request', async () => {
            const service = createUnsplashDownloadService();

            const result = await service.triggerDownload(
                'https://api.unsplash.com/photos/photo-1/download',
                { transport: 'direct', accessKey: '   ' },
            );

            expect(result.isErr()).toBe(true);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it.each([
            'https://evil.example/photos/photo-1/download',
            'http://api.unsplash.com/photos/photo-1/download',
            'https://api.unsplash.com/proxy/photos/photo-1/download',
        ])('rejects an invalid direct tracking URL before sending a request: %s', async (downloadLocation) => {
            const service = createUnsplashDownloadService();

            const result = await service.triggerDownload(
                downloadLocation,
                { transport: 'direct', accessKey: 'local-key' },
            );

            expect(result.isErr()).toBe(true);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('deduplicates downloads separately for proxy and direct transports', async () => {
            mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

            const service = createUnsplashDownloadService();
            const downloadLocation = 'https://api.unsplash.com/photos/photo-1/download';
            service.triggerDownload(downloadLocation, { transport: 'proxy' });
            service.triggerDownload(downloadLocation, {
                transport: 'direct',
                accessKey: 'local-key',
            });

            await vi.waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(2);
            });
        });

        it('should not trigger duplicate downloads for same photo ID', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
            });

            const service = createUnsplashDownloadService();
            const downloadLocation = 'https://api.unsplash.com/photos/photo-123/download';
            // First call
            await service.triggerDownload(downloadLocation, { transport: 'proxy' });
            // Second call (duplicate)
            await service.triggerDownload(downloadLocation, { transport: 'proxy' });
            // Wait for async operation
            await wait(100);

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(service.getStats().totalTriggered).toBe(1);
        });

        it('should retry on failure with exponential backoff', async () => {
            // Fail twice, then succeed
            mockFetch
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                });

            const service = createUnsplashDownloadService();
            const downloadLocation = 'https://api.unsplash.com/photos/photo-123/download';
            const startTime = Date.now();
            await service.triggerDownload(downloadLocation, { transport: 'proxy' });
            // Wait for all retries + extra time
            await wait(4000);
            const duration = Date.now() - startTime;

            // Should have 3 attempts (2 failures + 1 success)
            expect(mockFetch).toHaveBeenCalledTimes(3);

            // With exponential backoff (1000ms + 2000ms), should take at least 3 seconds
            expect(duration).toBeGreaterThan(2500);
        });

        it('should fail silently after max attempts', async () => {
            // Always fail
            mockFetch.mockRejectedValue(new Error('Network error'));

            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const service = createUnsplashDownloadService();
            const downloadLocation = 'https://api.unsplash.com/photos/photo-123/download';
            await service.triggerDownload(downloadLocation, { transport: 'proxy' });
            // Wait for all retries
            await wait(4000);

            // Should have attempted 3 times
            expect(mockFetch).toHaveBeenCalledTimes(3);

            // Should log warning
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[UnsplashDownload] Failed after retries:',
                expect.objectContaining({
                    photoId: 'photo-123',
                    totalFailed: 1,
                })
            );

            // Stats should show failed attempt
            expect(service.getStats().failedAttempts).toBe(1);

            consoleWarnSpy.mockRestore();
        });

        it('should handle non-OK responses', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 404,
            });

            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const service = createUnsplashDownloadService();
            const downloadLocation = 'https://api.unsplash.com/photos/photo-123/download';
            await service.triggerDownload(downloadLocation, { transport: 'proxy' });
            // Wait for all retries
            await wait(4000);

            // Should retry and eventually fail
            expect(mockFetch).toHaveBeenCalledTimes(3);

            // Should log warning
            expect(consoleWarnSpy).toHaveBeenCalled();

            consoleWarnSpy.mockRestore();
        });

        it('should not block on fire-and-forget pattern', async () => {
            mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ ok: true, status: 200 }), 100)));

            const service = createUnsplashDownloadService();
            const downloadLocation = 'https://api.unsplash.com/photos/photo-123/download';
            const startTime = Date.now();

            // This should not block (returns immediately)
            const result = await service.triggerDownload(downloadLocation, { transport: 'proxy' });

            const duration = Date.now() - startTime;

            // Should return immediately (within 50ms)
            expect(duration).toBeLessThan(50);

            // Should return Ok with undefined value immediately
            expect(result.isOk()).toBe(true);

            // But execution continues
            expect(service.getStats().totalTriggered).toBe(1);

            // Wait for background operation to complete
            await wait(200);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('getStats', () => {
        it('should return initial stats', () => {
            const service = createUnsplashDownloadService();

            expect(service.getStats()).toEqual({
                totalTriggered: 0,
                failedAttempts: 0,
            });
        });

        it('should track triggered downloads', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
            });

            const service = createUnsplashDownloadService();

            await service.triggerDownload(
                'https://api.unsplash.com/photos/photo-1/download',
                { transport: 'proxy' },
            );
            await service.triggerDownload(
                'https://api.unsplash.com/photos/photo-2/download',
                { transport: 'proxy' },
            );

            expect(service.getStats().totalTriggered).toBe(2);
        });

        it('should track failed attempts', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            vi.spyOn(console, 'warn').mockImplementation(() => {});

            const service = createUnsplashDownloadService();

            await service.triggerDownload(
                'https://api.unsplash.com/photos/photo-1/download',
                { transport: 'proxy' },
            );
            // Wait for retries
            await wait(4000);

            expect(service.getStats().failedAttempts).toBe(1);

            vi.restoreAllMocks();
        });
    });

    describe('clear', () => {
        it('should clear all state', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
            });

            const service = createUnsplashDownloadService();

            await service.triggerDownload(
                'https://api.unsplash.com/photos/photo-1/download',
                { transport: 'proxy' },
            );
            await wait(100);

            expect(service.getStats().totalTriggered).toBe(1);

            service.clear();

            expect(service.getStats()).toEqual({
                totalTriggered: 0,
                failedAttempts: 0,
            });

            // Should be able to trigger again
            await service.triggerDownload(
                'https://api.unsplash.com/photos/photo-1/download',
                { transport: 'proxy' },
            );
            await wait(100);

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('reset', () => {
        it('should reset to initial state', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            vi.spyOn(console, 'warn').mockImplementation(() => {});

            const service = createUnsplashDownloadService();

            await service.triggerDownload(
                'https://api.unsplash.com/photos/photo-1/download',
                { transport: 'proxy' },
            );
            await wait(4000);

            expect(service.getStats().totalTriggered).toBe(1);
            expect(service.getStats().failedAttempts).toBe(1);

            service.reset();

            expect(service.getStats()).toEqual({
                totalTriggered: 0,
                failedAttempts: 0,
            });

            vi.restoreAllMocks();
        });
    });

    describe('integration scenarios', () => {
        it('should handle mixed success and failure scenarios', async () => {
            let callCount = 0;
            mockFetch.mockImplementation(() => {
                callCount++;
                if (callCount <= 2) {
                    return Promise.reject(new Error('Network error'));
                }
                return Promise.resolve({ ok: true, status: 200 });
            });

            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const service = createUnsplashDownloadService();

            // First photo: succeeds after 2 retries
            await service.triggerDownload(
                'https://api.unsplash.com/photos/photo-1/download',
                { transport: 'proxy' },
            );
            // Wait for retries (1000ms + 2000ms = 3000ms + buffer)
            await wait(4000);

            // Reset mock for second photo
            mockFetch.mockReset();
            mockFetch.mockRejectedValue(new Error('Network error'));
            await service.triggerDownload(
                'https://api.unsplash.com/photos/photo-2/download',
                { transport: 'proxy' },
            );
            // Wait for retries
            await wait(4000);

            expect(service.getStats()).toEqual({
                totalTriggered: 2,
                failedAttempts: 1,
            });

            consoleWarnSpy.mockRestore();
        }, 15000); // Increase timeout to 15s

        it('should prevent duplicate triggers even after failures', async () => {
            mockFetch.mockReset();
            mockFetch.mockRejectedValue(new Error('Network error'));
            vi.spyOn(console, 'warn').mockImplementation(() => {});

            const service = createUnsplashDownloadService();
            const downloadLocation = 'https://api.unsplash.com/photos/photo-1/download';

            // First attempt (fails after retries)
            await service.triggerDownload(downloadLocation, { transport: 'proxy' });
            // Wait for retries
            await wait(4000);

            // Verify retries happened (should be exactly 3)
            expect(mockFetch).toHaveBeenCalledTimes(3);

            // Second attempt (should be skipped, already triggered)
            await service.triggerDownload(downloadLocation, { transport: 'proxy' });
            // Just wait a bit to ensure no additional calls started
            await wait(500);

            // Should still be only 3 calls (no additional retries for duplicate)
            expect(mockFetch).toHaveBeenCalledTimes(3);

            // Should only count as 1 triggered
            expect(service.getStats().totalTriggered).toBe(1);

            vi.restoreAllMocks();
        }, 10000); // Increase timeout to 10s
    });
});
