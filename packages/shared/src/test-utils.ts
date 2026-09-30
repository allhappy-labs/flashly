/**
 * Test utilities for neverthrow Result types
 *
 * This module provides helper functions for testing code that returns Result types,
 * making it easier to write tests that verify both success and failure paths.
 */

import type { Result, Ok, Err } from 'neverthrow';
import { ResultAsync } from 'neverthrow';
import type { ErrorCode } from './errors';
import { AppError } from './errors';

// ============================================================================
// Test Matchers
// ============================================================================

function stringifyValue(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return stringifyValue(error);
}

/**
 * Expect a Result to be Ok (success)
 *
 * @example
 * ```typescript
 * test('fetchUser returns user data', async () => {
 *     const result = await fetchUser('123');
 *     expectOk(result);
 *     expect(result.value).toEqual(expectedUser);
 * });
 * ```
 */
export function expectOk<T, E>(result: Result<T, E>): asserts result is Ok<T, E> {
    if (!result.isOk()) {
        throw new Error(`Expected Ok, but got Err: ${getErrorMessage(result.error)}`);
    }
}

/**
 * Expect a Result to be Err (error)
 *
 * @example
 * ```typescript
 * test('fetchUser returns error for invalid id', async () => {
 *     const result = await fetchUser('invalid');
 *     expectErr(result);
 *     expect(result.error.code).toBe('USER_NOT_FOUND');
 * });
 * ```
 */
export function expectErr<T, E>(result: Result<T, E>): asserts result is Err<T, E> {
    if (!result.isErr()) {
        throw new Error(`Expected Err, but got Ok: ${JSON.stringify(result.value)}`);
    }
}

/**
 * Expect a Result to have a specific error code
 *
 * @example
 * ```typescript
 * test('returns validation error', async () => {
 *     const result = await validateInput(input);
 *     expectErrorCode(result, 'VALIDATION_ERROR');
 * });
 * ```
 */
export function expectErrorCode<T, E extends { code: string }>(
    result: Result<T, E>,
    expectedCode: string
): void {
    expectErr(result);
    if (result.error.code !== expectedCode) {
        throw new Error(`Expected error code to be ${expectedCode}, but got ${result.error.code}`);
    }
}

/**
 * Expect a Result to have a specific status code
 *
 * @example
 * ```typescript
 * test('returns 404 error', async () => {
 *     const result = await fetchUser('missing');
 *     expectStatusCode(result, 404);
 * });
 * ```
 */
export function expectStatusCode<T, E extends { statusCode: number }>(
    result: Result<T, E>,
    expectedStatusCode: number
): void {
    expectErr(result);
    if (result.error.statusCode !== expectedStatusCode) {
        throw new Error(`Expected status code to be ${expectedStatusCode}, but got ${result.error.statusCode}`);
    }
}

// ============================================================================
// Test Doubles
// ============================================================================

/**
 * Create a mock successful Result
 *
 * @example
 * ```typescript
 * const mockService = jest.fn().mockResolvedValue(okSuccess(data));
 * ```
 */
export function okSuccess<T>(value: T): ResultAsync<T, never> {
    return ResultAsync.fromPromise(Promise.resolve(value), () => {
        throw new Error('okSuccess should never produce an error');
    });
}

/**
 * Create a mock error Result
 *
 * @example
 * ```typescript
 * const mockService = jest.fn().mockResolvedValue(errError(new NetworkError('Failed')));
 * ```
 */
export function errError<E extends Error>(error: E): ResultAsync<never, E> {
    return ResultAsync.fromPromise(
        Promise.reject(error),
        () => error
    );
}

/**
 * Create a mock AppError
 *
 * @example
 * ```typescript
 * const error = createMockError('VALIDATION_ERROR', 400, 'Invalid input');
 * ```
 */
export function createMockError(
    code: ErrorCode,
    statusCode: number,
    message: string,
    options?: { context?: Record<string, unknown>; cause?: unknown }
): AppError {
    return new AppError(message, code, { statusCode, ...options });
}

/**
 * Create a mock service that returns Results
 *
 * @example
 * ```typescript
 * const mockService = createMockService<never, NetworkError>({
 *     successData: { id: '123', name: 'Test' },
 *     error: new NetworkError('Failed'),
 *     shouldFail: false
 * });
 * ```
 */
export function createMockService<T, E extends Error>(config: {
    successData: T;
    error: E;
    shouldFail?: boolean;
    delayMs?: number;
}): () => ResultAsync<T, E> {
    return () =>
        ResultAsync.fromPromise(
            (async () => {
                if (config.delayMs) {
                    await new Promise((resolve) => setTimeout(resolve, config.delayMs));
                }

                if (config.shouldFail) {
                    throw config.error;
                }

                return config.successData;
            })(),
            () => config.error
        );
}

// ============================================================================
// Jest Custom Matchers
// ============================================================================

/**
 * Custom Jest matchers for Result types
 *
 * Add to your Jest setup file:
 * ```typescript
 * import { registerResultMatchers } from '@flashly/shared/test-utils';
 * expect.extend(registerResultMatchers());
 * ```
 */
export function registerResultMatchers() {
    return {
        toBeOk(received: Result<unknown, unknown>) {
            const pass = received.isOk();
            const errorMessage = received.isErr() ? getErrorMessage(received.error) : 'unknown';
            return {
                pass,
                message: () =>
                    pass
                        ? `Expected result not to be Ok`
                        : `Expected result to be Ok, but got Err: ${stringifyValue(errorMessage)}`,
            };
        },

        toBeErr(received: Result<unknown, unknown>) {
            const pass = received.isErr();
            const okValue = received.isOk() ? received.value : 'unknown';
            return {
                pass,
                message: () =>
                    pass
                        ? `Expected result not to be Err`
                        : `Expected result to be Err, but got Ok: ${stringifyValue(okValue)}`,
            };
        },

        toHaveErrorCode(received: Result<unknown, { code: string }>, expectedCode: string) {
            expectErr(received);
            const pass = received.error.code === expectedCode;
            return {
                pass,
                message: () =>
                    pass
                        ? `Expected error code not to be ${expectedCode}`
                        : `Expected error code to be ${expectedCode}, but got ${received.error.code}`,
            };
        },

        toHaveStatusCode(received: Result<unknown, { statusCode: number }>, expectedStatusCode: number) {
            expectErr(received);
            const pass = received.error.statusCode === expectedStatusCode;
            return {
                pass,
                message: () =>
                    pass
                        ? `Expected status code not to be ${expectedStatusCode}`
                        : `Expected status code to be ${expectedStatusCode}, but got ${received.error.statusCode}`,
            };
        },

        toOkValue<T>(received: Result<T, unknown>, expectedValue: T) {
            expectOk(received);
            const pass = JSON.stringify(received.value) === JSON.stringify(expectedValue);
            return {
                pass,
                message: () =>
                    pass
                        ? `Expected value not to equal ${JSON.stringify(expectedValue)}`
                        : `Expected value to equal ${JSON.stringify(expectedValue)}, but got ${JSON.stringify(received.value)}`,
            };
        },
    };
}

// ============================================================================
// Vitest Custom Matchers
// ============================================================================

/**
 * Custom Vitest matchers for Result types
 *
 * Add to your Vitest setup file:
 * ```typescript
 * import { registerResultMatchersVitest } from '@flashly/shared/test-utils';
 * expect.extend(registerResultMatchersVitest());
 * ```
 */
export function registerResultMatchersVitest() {
    return {
        toBeOk(received: Result<unknown, unknown>) {
            const pass = received.isOk();
            const errorMessage = received.isErr() ? getErrorMessage(received.error) : 'unknown';
            return {
                pass,
                message: () =>
                    pass
                        ? `Expected result not to be Ok`
                        : `Expected result to be Ok, but got Err: ${stringifyValue(errorMessage)}`,
            };
        },

        toBeErr(received: Result<unknown, unknown>) {
            const pass = received.isErr();
            const okValue = received.isOk() ? received.value : 'unknown';
            return {
                pass,
                message: () =>
                    pass
                        ? `Expected result not to be Err`
                        : `Expected result to be Err, but got Ok: ${stringifyValue(okValue)}`,
            };
        },

        toHaveErrorCode(received: Result<unknown, { code: string }>, expectedCode: string) {
            expectErr(received);
            const pass = received.error.code === expectedCode;
            return {
                pass,
                message: () =>
                    pass
                        ? `Expected error code not to be ${expectedCode}`
                        : `Expected error code to be ${expectedCode}, but got ${received.error.code}`,
            };
        },

        toHaveStatusCode(received: Result<unknown, { statusCode: number }>, expectedStatusCode: number) {
            expectErr(received);
            const pass = received.error.statusCode === expectedStatusCode;
            return {
                pass,
                message: () =>
                    pass
                        ? `Expected status code not to be ${expectedStatusCode}`
                        : `Expected status code to be ${expectedStatusCode}, but got ${received.error.statusCode}`,
            };
        },

        toOkValue<T>(received: Result<T, unknown>, expectedValue: T) {
            expectOk(received);
            const pass = JSON.stringify(received.value) === JSON.stringify(expectedValue);
            return {
                pass,
                message: () =>
                    pass
                        ? `Expected value not to equal ${JSON.stringify(expectedValue)}`
                        : `Expected value to equal ${JSON.stringify(expectedValue)}, but got ${JSON.stringify(received.value)}`,
            };
        },
    };
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Wait for a Result to resolve with timeout
 *
 * @example
 * ```typescript
 * test('async operation completes', async () => {
 *     const result = await waitForResult(fetchUser('123'), 5000);
 *     expectOk(result);
 * });
 * ```
 */
export async function waitForResult<T, E>(
    result: ResultAsync<T, E>,
    _timeoutMs: number = 5000
): Promise<Result<T, E>> {
    return result;
}

/**
 * Resolve a Result to a tuple for easier testing
 *
 * @example
 * ```typescript
 * test('returns user or error', async () => {
 *     const [data, error] = await unwrapResult(fetchUser('123'));
 *     expect(data).toBeDefined();
 *     expect(error).toBeNull();
 * });
 * ```
 */
export async function unwrapResult<T, E>(
    result: ResultAsync<T, E>
): Promise<[data: T | null, error: E | null]> {
    const resolved = await result;
    return resolved.match(
        (data) => [data, null],
        (error) => [null, error]
    );
}

/**
 * Create a spy that tracks Result calls
 *
 * @example
 * ```typescript
 * test('service is called with correct args', async () => {
 *     const spy = createResultSpy(jest.fn().mockResolvedValue(ok(data)));
 *     const result = await spy('arg1', 'arg2');
 *     expectOk(result);
 *     expect(spy.mock).toHaveBeenCalledWith('arg1', 'arg2');
 * });
 * ```
 */
export function createResultSpy<T extends unknown[], U, E>(
    fn: (...args: T) => ResultAsync<U, E>
): {
    (...args: T): ResultAsync<U, E>;
    mock: (...args: T) => ResultAsync<U, E>;
} {
    const callable = (...args: T) => fn(...args);
    return Object.assign(callable, { mock: fn });
}
