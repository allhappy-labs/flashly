/**
 * Additional async utility patterns for neverthrow
 *
 * This module provides advanced async patterns for working with Result types,
 * including batching, rate limiting, debouncing, and more.
 */

import type { Result} from 'neverthrow';
import { ResultAsync, okAsync, errAsync, ok } from 'neverthrow';
import { errorFactory, type AppError } from './errors';

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process items in batches with Result types
 *
 * @example
 * ```typescript
 * const results = await batch(
 *     items,
 *     10, // batch size
 *     (batch) => Promise.all(batch.map(processItem))
 * );
 * ```
 */
export function batch<T, U, E extends AppError>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<U[]>
): ResultAsync<U[], E> {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
    }

    return ResultAsync.fromPromise(
        (async () => {
            const results: U[] = [];

            for (const itemBatch of batches) {
                const batchResults = await processor(itemBatch);
                results.push(...batchResults);
            }

            return results;
        })(),
        (error) => error as E
    );
}

/**
 * Process items with concurrency limit
 *
 * @example
 * ```typescript
 * const results = await parallel(
 *     items,
 *     5, // max concurrency
 *     (item) => processItem(item)
 * );
 * ```
 */
export function parallel<T, U, E extends AppError>(
    items: T[],
    maxConcurrency: number,
    processor: (item: T) => ResultAsync<U, E>
): ResultAsync<U[], E> {
    return ResultAsync.fromPromise(
        (async () => {
            const results: U[] = [];
            const executing: Promise<unknown>[] = [];

            for (const item of items) {
                const promise = Promise.resolve(processor(item)).then((result) => {
                    result.match(
                        (value) => results.push(value),
                        () => {
                            // Error will be thrown by the first failed promise
                        }
                    );
                });

                executing.push(promise);

                if (executing.length >= maxConcurrency) {
                    await Promise.race(executing);
                    // Remove completed promises
                    executing.splice(
                        executing.findIndex((p) => p === promise),
                        1
                    );
                }
            }

            await Promise.all(executing);
            return results;
        })(),
        (error) => error as E
    );
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Create a rate-limited function
 *
 * @example
 * ```typescript
 * const limitedFetch = rateLimit(fetch, 5, 1000); // 5 requests per second
 * const result = await limitedFetch('https://api.example.com');
 * ```
 */
export function rateLimit<T extends unknown[], U, E extends AppError>(
    fn: (...args: T) => ResultAsync<U, E>,
    maxRequests: number,
    windowMs: number
): (...args: T) => ResultAsync<U, E> {
    const queue: Array<{
        args: T;
        resolve: (result: Result<U, E>) => void;
    }> = [];
    let windowStart = Date.now();
    let requestCount = 0;

    const processQueue = () => {
        const now = Date.now();
        const windowElapsed = now - windowStart;

        if (windowElapsed >= windowMs) {
            windowStart = now;
            requestCount = 0;
        }

        while (queue.length > 0 && requestCount < maxRequests) {
            const { args, resolve } = queue.shift()!;

            fn(...args).then((result) => {
                resolve(result);
            });

            requestCount++;
        }

        if (queue.length > 0) {
            const timeUntilNextWindow = windowMs - (Date.now() - windowStart);
            setTimeout(processQueue, timeUntilNextWindow);
        }
    };

    return (...args: T) => {
        return new ResultAsync<U, E>(
            new Promise<Result<U, E>>((resolve) => {
                queue.push({ args, resolve });

                if (queue.length === 1) {
                    processQueue();
                }
            })
        );
    };
}

// ============================================================================
// Debouncing and Throttling
// ============================================================================

/**
 * Create a debounced function that returns Result types
 *
 * @example
 * ```typescript
 * const debouncedSearch = debounce(
 *     (query: string) => search(query),
 *     300
 * );
 * const result = await debouncedSearch('test');
 * ```
 */
export function debounce<T extends unknown[], U, E extends AppError>(
    fn: (...args: T) => ResultAsync<U, E>,
    delayMs: number
): (...args: T) => ResultAsync<U | null, E> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: T) => {
        return new ResultAsync<U | null, E>(
            new Promise<Result<U | null, E>>((resolve) => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                timeoutId = setTimeout(() => {
                    fn(...args).then(resolve);
                }, delayMs);
            })
        );
    };
}

/**
 * Create a throttled function that returns Result types
 *
 * @example
 * ```typescript
 * const throttledSave = throttle(
 *     (data: UserData) => saveUser(data),
 *     1000
 * );
 * const result = await throttledSave(userData);
 * ```
 */
export function throttle<T extends unknown[], U, E extends AppError>(
    fn: (...args: T) => ResultAsync<U, E>,
    limitMs: number
): (...args: T) => ResultAsync<U | null, E> {
    let inThrottle = false;
    let lastResult: Result<U | null, E> | null = null;

    return (...args: T) => {
        return new ResultAsync<U | null, E>(
            new Promise<Result<U | null, E>>((resolve) => {
                if (inThrottle) {
                    resolve(lastResult ?? ok<U | null>(null));
                    return;
                }

                inThrottle = true;

                fn(...args).then((result) => {
                    lastResult = result.map((value): U | null => value);
                    resolve(result);

                    setTimeout(() => {
                        inThrottle = false;
                    }, limitMs);
                });
            })
        );
    };
}

// ============================================================================
// Caching
// ============================================================================

/**
 * Simple in-memory cache for Result types
 *
 * @example
 * ```typescript
 * const cache = new ResultCache<string, User>();
 * const user = await cache.getOrFetch('user-123', () => fetchUser('user-123'));
 * ```
 */
export class ResultCache<K, T, E extends AppError> {
    private cache = new Map<K, { result: Result<T, E>; timestamp: number }>();
    private ttlMs: number;

    constructor(ttlMs: number = 5 * 60 * 1000) {
        this.ttlMs = ttlMs;
    }

    /**
     * Get value from cache or fetch if not present/expired
     */
    getOrFetch(key: K, fetchFn: () => ResultAsync<T, E>): ResultAsync<T, E> {
        const cached = this.cache.get(key);

        if (cached && Date.now() - cached.timestamp < this.ttlMs) {
            return cached.result.isOk() ? okAsync(cached.result.value) : fetchFn();
        }

        return fetchFn().map((value) => {
            this.cache.set(key, { result: ok(value), timestamp: Date.now() });
            return value;
        });
    }

    /**
     * Check if key exists and is not expired
     */
    has(key: K): boolean {
        const cached = this.cache.get(key);
        if (!cached) return false;
        return Date.now() - cached.timestamp < this.ttlMs;
    }

    /**
     * Get value without fetching
     */
    get(key: K): Result<T, E> | null {
        const cached = this.cache.get(key);
        if (!cached) return null;
        if (Date.now() - cached.timestamp >= this.ttlMs) {
            this.cache.delete(key);
            return null;
        }
        return cached.result;
    }

    /**
     * Set value in cache
     */
    set(key: K, result: Result<T, E>): void {
        this.cache.set(key, { result, timestamp: Date.now() });
    }

    /**
     * Remove value from cache
     */
    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Remove expired entries
     */
    cleanup(): void {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp >= this.ttlMs) {
                this.cache.delete(key);
            }
        }
    }
}

// ============================================================================
// Polling
// ============================================================================

/**
 * Poll a function until it returns a specific condition or times out
 *
 * @example
 * ```typescript
 * const result = await poll(
 *     () => checkStatus(),
 *     (status) => status === 'complete',
 *     { intervalMs: 1000, timeoutMs: 30000 }
 * );
 * ```
 */
export function poll<T, E extends AppError>(
    fn: () => ResultAsync<T, E>,
    condition: (value: T) => boolean,
    options: { intervalMs?: number; timeoutMs?: number } = {}
): ResultAsync<T, E> {
    const { intervalMs = 1000, timeoutMs = 30000 } = options;
    const startTime = Date.now();

    const pollOnce = (): ResultAsync<T, E> => {
        return fn().andThen((value) => {
            if (condition(value)) {
                return okAsync(value);
            }

            if (Date.now() - startTime >= timeoutMs) {
                return errAsync({
                    name: 'AppError',
                    message: 'Polling timed out',
                    code: 'TIMEOUT_ERROR',
                    statusCode: 408,
                    timestamp: Date.now(),
                } as E);
            }

            return ResultAsync.fromPromise(
                new Promise((resolve) => setTimeout(resolve, intervalMs)),
                (error) => error as E
            ).andThen(pollOnce);
        });
    };

    return pollOnce();
}

// ============================================================================
// Circuit Breaker
// ============================================================================

/**
 * Circuit breaker pattern for failing fast when a service is down
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker(
 *     () => fetchFromExternalService(),
 *     { threshold: 5, timeoutMs: 60000 }
 * );
 *
 * const result = await breaker.execute();
 * if (result.isErr()) {
 *     if (breaker.isOpen()) {
 *         // Use fallback
 *     }
 * }
 * ```
 */
export class CircuitBreaker<T, E extends AppError> {
    private failures = 0;
    private lastFailureTime = 0;
    private state: 'closed' | 'open' | 'half-open' = 'closed';
    private readonly threshold: number;
    private readonly timeoutMs: number;
    private readonly fn: () => ResultAsync<T, E>;

    constructor(
        fn: () => ResultAsync<T, E>,
        options: { threshold?: number; timeoutMs?: number } = {}
    ) {
        this.fn = fn;
        this.threshold = options.threshold ?? 5;
        this.timeoutMs = options.timeoutMs ?? 60000;
    }

    /**
     * Execute the function with circuit breaker protection
     */
    execute(): ResultAsync<T, E> {
        // If circuit is open, check if timeout has passed
        if (this.state === 'open') {
            if (Date.now() - this.lastFailureTime > this.timeoutMs) {
                this.state = 'half-open';
            } else {
                // Return a circuit breaker open error - using errorFactory to avoid type assertions
                // E extends AppError, and ExternalServiceError is a subtype of AppError
                return errAsync(errorFactory.circuitBreakerOpen(
                    'Circuit breaker is open',
                    { failures: this.failures, lastFailureTime: this.lastFailureTime }
                ) as E);
            }
        }

        return this.fn().map((value) => {
            this.onSuccess();
            return value;
        }).mapErr((error) => {
            this.onFailure();
            return error;
        });
    }

    /**
     * Check if circuit is open
     */
    isOpen(): boolean {
        return this.state === 'open';
    }

    private onSuccess(): void {
        this.failures = 0;
        this.state = 'closed';
    }

    private onFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.failures >= this.threshold) {
            this.state = 'open';
        }
    }

    /**
     * Reset the circuit breaker
     */
    reset(): void {
        this.failures = 0;
        this.state = 'closed';
        this.lastFailureTime = 0;
    }
}

// ============================================================================
// Retry with Exponential Backoff
// ============================================================================

/**
 * Retry a function with exponential backoff
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *     () => fetchFromAPI(),
 *     { maxAttempts: 5, baseDelayMs: 1000 }
 * );
 * ```
 */
export function retryWithBackoff<T, E extends AppError>(
    fn: () => ResultAsync<T, E>,
    options: {
        maxAttempts?: number;
        baseDelayMs?: number;
        maxDelayMs?: number;
        backoffMultiplier?: number;
        retryIf?: (error: E) => boolean;
    } = {}
): ResultAsync<T, E> {
    const {
        maxAttempts = 3,
        baseDelayMs = 1000,
        maxDelayMs = 30000,
        backoffMultiplier = 2,
        retryIf = () => true,
    } = options;

    let attempt = 0;
    let delay = baseDelayMs;

    const tryOnce = (): ResultAsync<T, E> => {
        attempt++;

        return fn().orElse((error) => {
            if (attempt >= maxAttempts || !retryIf(error)) {
                return errAsync(error);
            }

            return ResultAsync.fromPromise(
                new Promise((resolve) => setTimeout(resolve, delay)),
                (err) => err as E
            ).andThen(() => {
                delay = Math.min(delay * backoffMultiplier, maxDelayMs);
                return tryOnce();
            });
        });
    };

    return tryOnce();
}
