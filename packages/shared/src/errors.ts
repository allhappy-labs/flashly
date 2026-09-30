import type { Result} from 'neverthrow';
import { ResultAsync, ok, err, okAsync, errAsync, type Ok, type Err } from 'neverthrow';

// ============================================================================
// ERROR CODES
// ============================================================================

export const ERROR_CODES = {
    // Network & API errors
    NETWORK_ERROR: 'NETWORK_ERROR',
    FETCH_ERROR: 'FETCH_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    API_ERROR: 'API_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    RATE_LIMITED: 'RATE_LIMITED',
    SERVER_ERROR: 'SERVER_ERROR',

    // Database errors
    DATABASE_ERROR: 'DATABASE_ERROR',
    QUERY_ERROR: 'QUERY_ERROR',
    TRANSACTION_ERROR: 'TRANSACTION_ERROR',
    CONNECTION_ERROR: 'CONNECTION_ERROR',
    CONSTRAINT_ERROR: 'CONSTRAINT_ERROR',

    // Storage errors
    STORAGE_ERROR: 'STORAGE_ERROR',
    UPLOAD_ERROR: 'UPLOAD_ERROR',
    DOWNLOAD_ERROR: 'DOWNLOAD_ERROR',
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',

    // Validation errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    INVALID_FORMAT: 'INVALID_FORMAT',
    INVALID_JSON: 'INVALID_JSON',
    INVALID_JSONL: 'INVALID_JSONL',

    // Authentication & Authorization
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    ACCESS_DENIED: 'ACCESS_DENIED',

    // Business logic errors
    BUSINESS_LOGIC_ERROR: 'BUSINESS_LOGIC_ERROR',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',

    // External service errors
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
    OPENROUTER_ERROR: 'OPENROUTER_ERROR',
    ELEVENLABS_ERROR: 'ELEVENLABS_ERROR',
    EMPTY_RESPONSE: 'EMPTY_RESPONSE',
    MISSING_API_KEY: 'MISSING_API_KEY',
    MISSING_FETCH: 'MISSING_FETCH',

    // Configuration errors
    CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
    MISSING_CONFIGURATION: 'MISSING_CONFIGURATION',
    INVALID_CONFIGURATION: 'INVALID_CONFIGURATION',

    // Generic errors
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

function getCaptureStackTrace():
    | ((target: object, constructorOpt?: Function) => void)
    | null {
    const captureStackTrace = Reflect.get(Error, 'captureStackTrace');
    if (typeof captureStackTrace !== 'function') {
        return null;
    }

    return (target, constructorOpt) => {
        captureStackTrace.call(Error, target, constructorOpt);
    };
}

function toAppError(error: unknown, fallbackMessage: string): AppError {
    if (error instanceof AppError) {
        return error;
    }

    const message = error instanceof Error ? error.message : fallbackMessage;
    return new AppError(message, ERROR_CODES.UNKNOWN_ERROR, { cause: error });
}

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class AppError extends Error {
    readonly code: ErrorCode;
    readonly statusCode: number;
    readonly cause?: unknown;
    readonly context?: Record<string, unknown>;
    readonly timestamp: number;

    constructor(message: string, code: ErrorCode, options?: {
        statusCode?: number;
        cause?: unknown;
        context?: Record<string, unknown>;
    }) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = options?.statusCode ?? 500;
        this.cause = options?.cause;
        this.context = options?.context;
        this.timestamp = Date.now();

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        const captureStackTrace = getCaptureStackTrace();
        if (captureStackTrace) {
            captureStackTrace(this, this.constructor);
        }
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            context: this.context,
            timestamp: this.timestamp,
        };
    }
}

// ============================================================================
// SPECIFIC ERROR TYPES
// ============================================================================

export class NetworkError extends AppError {
    constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> }) {
        super(message, ERROR_CODES.NETWORK_ERROR, { statusCode: 503, ...options });
    }
}

export class ApiError extends AppError {
    constructor(message: string, statusCode: number, options?: { cause?: unknown; context?: Record<string, unknown> }) {
        super(message, ERROR_CODES.API_ERROR, { statusCode, ...options });
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> }) {
        super(message, ERROR_CODES.UNAUTHORIZED, { statusCode: 401, ...options });
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> }) {
        super(message, ERROR_CODES.FORBIDDEN, { statusCode: 403, ...options });
    }
}

export class NotFoundError extends AppError {
    constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> }) {
        super(message, ERROR_CODES.NOT_FOUND, { statusCode: 404, ...options });
    }
}

export class ValidationError extends AppError {
    constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> });
    constructor(message: string, legacyCode: string, options?: { cause?: unknown; context?: Record<string, unknown> });
    constructor(
        message: string,
        legacyCodeOrOptions?: string | { cause?: unknown; context?: Record<string, unknown> },
        maybeOptions?: { cause?: unknown; context?: Record<string, unknown> }
    ) {
        const options = typeof legacyCodeOrOptions === 'string'
            ? {
                ...maybeOptions,
                context: {
                    legacyCode: legacyCodeOrOptions,
                    ...maybeOptions?.context,
                },
            }
            : legacyCodeOrOptions;
        super(message, ERROR_CODES.VALIDATION_ERROR, { statusCode: 400, ...options });
    }
}

export class DatabaseError extends AppError {
    constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> });
    constructor(message: string, legacyCode: string, options?: { cause?: unknown; context?: Record<string, unknown> });
    constructor(
        message: string,
        legacyCodeOrOptions?: string | { cause?: unknown; context?: Record<string, unknown> },
        maybeOptions?: { cause?: unknown; context?: Record<string, unknown> }
    ) {
        const options = typeof legacyCodeOrOptions === 'string'
            ? {
                ...maybeOptions,
                context: {
                    legacyCode: legacyCodeOrOptions,
                    ...maybeOptions?.context,
                },
            }
            : legacyCodeOrOptions;
        super(message, ERROR_CODES.DATABASE_ERROR, { statusCode: 500, ...options });
    }
}

export class StorageError extends AppError {
    constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> }) {
        super(message, ERROR_CODES.STORAGE_ERROR, { statusCode: 500, ...options });
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> }) {
        super(message, ERROR_CODES.AUTHENTICATION_ERROR, { statusCode: 401, ...options });
    }
}

export class ExternalServiceError extends AppError {
    constructor(message: string, service: string, options?: { cause?: unknown; context?: Record<string, unknown> }) {
        super(message, ERROR_CODES.EXTERNAL_SERVICE_ERROR, {
            statusCode: 502,
            context: { service, ...options?.context },
            ...options
        });
    }
}

export class ConfigurationError extends AppError {
    constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> }) {
        super(message, ERROR_CODES.CONFIGURATION_ERROR, { statusCode: 500, ...options });
    }
}

export class SyncError extends AppError {
    constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> }) {
        super(message, ERROR_CODES.INTERNAL_ERROR, { statusCode: 500, ...options });
    }
}

export class ConflictError extends AppError {
    constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> }) {
        super(message, ERROR_CODES.BUSINESS_LOGIC_ERROR, { statusCode: 409, ...options });
    }
}

// ============================================================================
// ERROR FACTORY FUNCTIONS
// ============================================================================

export const errorFactory = {
    network: (message: string, cause?: unknown) => new NetworkError(message, { cause }),
    api: (message: string, statusCode: number = 500, cause?: unknown) => new ApiError(message, statusCode, { cause }),
    unauthorized: (message: string, cause?: unknown) => new UnauthorizedError(message, { cause }),
    forbidden: (message: string, cause?: unknown) => new ForbiddenError(message, { cause }),
    notFound: (message: string, cause?: unknown) => new NotFoundError(message, { cause }),
    validation: (message: string, context?: Record<string, unknown>) => new ValidationError(message, { context }),
    database: (message: string, cause?: unknown) => new DatabaseError(message, { cause }),
    storage: (message: string, cause?: unknown) => new StorageError(message, { cause }),
    authentication: (message: string, cause?: unknown) => new AuthenticationError(message, { cause }),
    externalService: (message: string, service: string, cause?: unknown) => new ExternalServiceError(message, service, { cause }),
    configuration: (message: string, cause?: unknown) => new ConfigurationError(message, { cause }),
    sync: (message: string, cause?: unknown) => new SyncError(message, { cause }),
    conflict: (message: string, context?: Record<string, unknown>) => new ConflictError(message, { context }),
    circuitBreakerOpen: (message: string, context?: Record<string, unknown>) => new ExternalServiceError(message, 'circuit-breaker', { context }),
} as const;

// ============================================================================
// UTILITY FUNCTIONS FOR WORKING WITH RESULTS
// ============================================================================

/**
 * Converts a promise to a ResultAsync with automatic error conversion
 */
export function safeAsync<T, E extends AppError = AppError>(
    promiseOrFn: Promise<T> | (() => Promise<T>),
    errorMapper: (error: unknown) => E
): ResultAsync<T, E> {
    try {
        const promise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
        return ResultAsync.fromPromise(Promise.resolve(promise), errorMapper);
    } catch (error) {
        return errAsync(errorMapper(error));
    }
}

/**
 * Wraps a synchronous function that might throw into a Result
 */
export function safeSync<T, E extends AppError = AppError>(
    fn: () => T,
    errorMapper: (error: unknown) => E
): Result<T, E> {
    try {
        return ok(fn());
    } catch (error) {
        return err(errorMapper(error));
    }
}

/**
 * Wraps a fetch call with automatic error handling
 */
export function safeFetch(
    input: Parameters<typeof fetch>[0],
    init?: (Parameters<typeof fetch>[1] & { timeoutMs?: number })
): ResultAsync<Response, NetworkError | ApiError> {
    // Always wrap fetch in safeAsync for consistency
    const fetchFn = safeAsync(
        fetch(input, init),
        (error) => new NetworkError(`Fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { cause: error })
    );

    if (init?.timeoutMs) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), init.timeoutMs);

        return fetchFn.andThen((response) => {
            clearTimeout(timeout);

            if (!response.ok) {
                return errAsync(
                    new ApiError(
                        `HTTP ${response.status}: ${response.statusText}`,
                        response.status,
                        { context: { url: typeof input === 'string' ? input : input.toString() } }
                    )
                );
            }

            return okAsync(response);
        });
    }

    return fetchFn.andThen((response) => {
        if (!response.ok) {
            return errAsync(
                new ApiError(
                    `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    { context: { url: typeof input === 'string' ? input : input.toString() } }
                )
            );
        }
        return okAsync(response);
    });
}

/**
 * Safely parses JSON with automatic error handling
 */
export function safeJson<T = unknown>(json: string): Result<T, ValidationError> {
    return safeSync(
        () => JSON.parse(json),
        (error) => new ValidationError(
            `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { cause: error }
        )
    );
}

/**
 * Safely validates data with Zod schema
 */
export function safeValidate<T, U>(
    schema: { parse: (data: T) => U },
    data: T
): Result<U, ValidationError> {
    return safeSync(
        () => schema.parse(data),
        (error) => new ValidationError(
            `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { cause: error }
        )
    );
}

/**
 * Combines multiple Results into one Result of an array
 * All must succeed for the combined Result to succeed
 */
export function combineResults<T, E extends AppError>(
    results: Result<T, E>[]
): Result<T[], E> {
    const successes: T[] = [];
    const errors: E[] = [];

    for (const result of results) {
        result.match(
            (value) => successes.push(value),
            (error) => errors.push(error)
        );
    }

    if (errors.length > 0) {
        return err(errors[0]); // Return first error
    }

    return ok(successes);
}

/**
 * Combines multiple ResultAsyncs into one ResultAsync of an array
 */
export function combineResultAsyncs<T, E extends AppError>(
    results: ResultAsync<T, E>[]
): ResultAsync<T[], E> {
    return ResultAsync.combine(results).map((values) => values);
}

/**
 * Executes all Results and returns all successes and failures
 */
export function partitionResults<T, E extends AppError>(
    results: Result<T, E>[]
): { successes: T[]; errors: E[] } {
    const successes: T[] = [];
    const errors: E[] = [];

    for (const result of results) {
        result.match(
            (value) => successes.push(value),
            (error) => errors.push(error)
        );
    }

    return { successes, errors };
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

/**
 * Type guard to check if a Result is an error
 */
export function isError<T, E>(result: Result<T, E>): result is Err<T, E> {
    return result.isErr();
}

/**
 * Type guard to check if a Result is a success
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Ok<T, E> {
    return result.isOk();
}

// ============================================================================
// ASYNC UTILITY FUNCTIONS
// ============================================================================

/**
 * Wraps a timeout in a ResultAsync
 */
export function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutError: AppError
): ResultAsync<T, AppError> {
    return ResultAsync.fromPromise(
        Promise.race([
            promise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(timeoutError), timeoutMs)
            ),
        ]),
        (error) => toAppError(error, 'Operation timed out')
    );
}

/**
 * Retries a function that returns a ResultAsync
 */
export async function retry<T, E extends AppError>(
    fn: () => ResultAsync<T, E>,
    options: {
        maxAttempts?: number;
        delayMs?: number;
        backoffMultiplier?: number;
        retryIf?: (error: E) => boolean;
    } = {}
): Promise<Result<T, E>> {
    const {
        maxAttempts = 3,
        delayMs = 1000,
        backoffMultiplier = 2,
        retryIf = () => true,
    } = options;

    let attempt = 0;
    let currentDelay = delayMs;
    let lastError: E | null = null;

    const attemptsLimit = Math.max(1, maxAttempts);
    while (attempt < attemptsLimit) {
        const result = await fn();

        if (result.isOk() || !retryIf(result.error)) {
            return result;
        }

        lastError = result.error;
        attempt++;
        if (attempt < attemptsLimit) {
            await new Promise((resolve) => setTimeout(resolve, currentDelay));
            currentDelay *= backoffMultiplier;
        }
    }

    if (!lastError) {
        throw new AppError('Retry failed without capturing an error.', ERROR_CODES.UNKNOWN_ERROR);
    }

    return err(lastError);
}

/**
 * Executes multiple async operations in parallel and returns all results
 */
export function parallel<T, E extends AppError>(
    operations: (() => ResultAsync<T, E>)[]
): ResultAsync<T[], E> {
    return ResultAsync.combine(operations.map((op) => op())).map((values) => values);
}

/**
 * Executes async operations in sequence, passing the result of each to the next
 */
export async function sequence<T, E extends AppError>(
    operations: (() => ResultAsync<T, E>)[]
): Promise<Result<T[], E>> {
    const results: T[] = [];

    for (const operation of operations) {
        const result = await operation();
        if (result.isErr()) {
            return err(result.error);
        }
        results.push(result.value);
    }

    return ok(results);
}
