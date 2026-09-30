/**
 * TypeScript utility types for working with neverthrow Result types
 *
 * This module provides type-level utilities that make it easier to work with
 * Result types in TypeScript, improving type inference and reducing boilerplate.
 */

import type { Result, ResultAsync, Ok, Err } from 'neverthrow';
import type { ApiError, AppError, DatabaseError, NetworkError, ValidationError } from './errors';

// ============================================================================
// Result Type Extractors
// ============================================================================

/**
 * Extract the success type from a Result
 *
 * @example
 * ```typescript
 * type MyResult = Result<string, Error>;
 * type Success = SuccessType<MyResult>; // string
 * ```
 */
export type SuccessType<T extends Result<unknown, unknown>> = T extends Result<infer U, unknown> ? U : never;

/**
 * Extract the error type from a Result
 *
 * @example
 * ```typescript
 * type MyResult = Result<string, Error>;
 * type Error = ErrorType<MyResult>; // Error
 * ```
 */
export type ErrorType<T extends Result<unknown, unknown>> = T extends Result<unknown, infer E> ? E : never;

/**
 * Extract the success type from a ResultAsync
 *
 * @example
 * ```typescript
 * type MyResult = ResultAsync<string, Error>;
 * type Success = AsyncSuccessType<MyResult>; // string
 * ```
 */
export type AsyncSuccessType<T extends ResultAsync<unknown, unknown>> = T extends ResultAsync<infer U, unknown> ? U : never;

/**
 * Extract the error type from a ResultAsync
 *
 * @example
 * ```typescript
 * type MyResult = ResultAsync<string, Error>;
 * type Error = AsyncErrorType<MyResult>; // Error
 * ```
 */
export type AsyncErrorType<T extends ResultAsync<unknown, unknown>> = T extends ResultAsync<unknown, infer E> ? E : never;

// ============================================================================
// Result Unions
// ============================================================================

/**
 * Combine multiple Results into a union of their success types
 *
 * @example
 * ```typescript
 * type R1 = Result<string, Error>;
 * type R2 = Result<number, Error>;
 * type Combined = SuccessUnion<[R1, R2]>; // string | number
 * ```
 */
export type SuccessUnion<T extends readonly unknown[]> = T extends [
    infer First,
    ...infer Rest
]
    ? First extends Result<infer U, unknown>
        ? U | SuccessUnion<Rest>
        : never
    : never;

/**
 * Combine multiple Results into a union of their error types
 *
 * @example
 * ```typescript
 * type R1 = Result<string, NetworkError>;
 * type R2 = Result<number, ValidationError>;
 * type Combined = ErrorUnion<[R1, R2]>; // NetworkError | ValidationError
 * ```
 */
export type ErrorUnion<T extends readonly unknown[]> = T extends [
    infer First,
    ...infer Rest
]
    ? First extends Result<unknown, infer E>
        ? E | ErrorUnion<Rest>
        : never
    : never;

// ============================================================================
// Service Method Types
// ============================================================================

/**
 * Type for a service method that returns a ResultAsync
 *
 * @example
 * ```typescript
 * class UserService {
 *     getUser: ServiceMethod<string, User, DatabaseError>;
 * }
 * ```
 */
export type ServiceMethod<TArgs extends unknown[], TSuccess, TError extends AppError> = (
    ...args: TArgs
) => ResultAsync<TSuccess, TError>;

/**
 * Type for a service class with methods that return ResultAsync
 *
 * @example
 * ```typescript
 * class UserService implements ServiceMethods<{
 *     getUser: [userId: string],
 *     updateUser: [userId: string, data: UpdateUserInput]
 * }> {
 *     getUser(userId: string): ResultAsync<User, DatabaseError> { ... }
 *     updateUser(userId: string, data: UpdateUserInput): ResultAsync<User, ValidationError | DatabaseError> { ... }
 * }
 * ```
 */
export type ServiceMethods<TMethods extends Record<string, unknown[]>> = {
    [K in keyof TMethods]: (...args: TMethods[K]) => ResultAsync<unknown, AppError>;
};

// ============================================================================
// Async Function Types
// ============================================================================

/**
 * Convert an async function to one that returns ResultAsync
 *
 * @example
 * ```typescript
 * type FetchUser = (id: string) => Promise<User>;
 * type SafeFetchUser = ToResultAsync<FetchUser, DatabaseError>;
 * // Result is: (id: string) => ResultAsync<User, DatabaseError>
 * ```
 */
export type ToResultAsync<T extends (...args: unknown[]) => Promise<unknown>, E extends AppError> = (
    ...args: Parameters<T>
) => ResultAsync<Awaited<ReturnType<T>>, E>;

/**
 * Convert multiple async functions to ResultAsync versions
 *
 * @example
 * ```typescript
 * type API = {
 *     getUser: (id: string) => Promise<User>;
 *     getPosts: () => Promise<Post[]>;
 * };
 *
 * type SafeAPI = ToResultAsyncObject<API, DatabaseError>;
 * // Result is:
 * // {
 * //     getUser: (id: string) => ResultAsync<User, DatabaseError>;
 * //     getPosts: () => ResultAsync<Post[], DatabaseError>;
 * // }
 * ```
 */
export type ToResultAsyncObject<T extends Record<string, (...args: unknown[]) => Promise<unknown>>, E extends AppError> = {
    [K in keyof T]: (
        ...args: Parameters<T[K]>
    ) => ResultAsync<Awaited<ReturnType<T[K]>>, E>;
};

// ============================================================================
// Error Type Utilities
// ============================================================================

/**
 * Extract error codes from a union of AppErrors
 *
 * @example
 * ```typescript
 * type Errors = NetworkError | ValidationError;
 * type Codes = ErrorCodes<Errors>; // "NETWORK_ERROR" | "VALIDATION_ERROR"
 * ```
 */
export type ErrorCodes<T extends AppError> = T extends { code: infer U } ? U : never;

/**
 * Create a union of error types from their codes
 *
 * @example
 * ```typescript
 * type MyErrors = ErrorsFromCodes<'NETWORK_ERROR' | 'VALIDATION_ERROR'>;
 * // Result is: NetworkError | ValidationError
 * ```
 */
export type ErrorsFromCodes<T extends string> = T extends 'NETWORK_ERROR'
    ? NetworkError
    : T extends 'VALIDATION_ERROR'
        ? ValidationError
        : T extends 'DATABASE_ERROR'
            ? DatabaseError
            : T extends 'API_ERROR'
                ? ApiError
                : AppError;

// ============================================================================
// Result Transformation Types
// ============================================================================

/**
 * Map over the success type of a Result
 *
 * @example
 * ```typescript
 * type Original = Result<string, Error>;
 * type Mapped = MapSuccess<Original, number>; // Result<number, Error>
 * ```
 */
export type MapSuccess<T extends Result<unknown, unknown>, U> = Result<U, ErrorType<T>>;

/**
 * Map over the error type of a Result
 *
 * @example
 * ```typescript
 * type Original = Result<string, Error>;
 * type Mapped = MapError<Original, TypeError>; // Result<string, TypeError>
 * ```
 */
export type MapError<T extends Result<unknown, unknown>, E> = Result<SuccessType<T>, E>;

/**
 * Map over both success and error types of a Result
 *
 * @example
 * ```typescript
 * type Original = Result<string, Error>;
 * type Mapped = MapResult<Original, number, TypeError>; // Result<number, TypeError>
 * ```
 */
export type MapResult<_T extends Result<unknown, unknown>, U, E> = Result<U, E>;

// ============================================================================
// Conditional Result Types
// ============================================================================

/**
 * Create a Result type based on a condition
 *
 * @example
 * ```typescript
 * type MyResult = ConditionalResult<true, string, Error>; // Result<string, Error>
 * type NoResult = ConditionalResult<false, string, Error>; // never
 * ```
 */
export type ConditionalResult<TCondition, TSuccess, TError> = TCondition extends true ? Result<TSuccess, TError> : never;

/**
 * Make optional properties required in the success type of a Result
 *
 * @example
 * ```typescript
 * type User = { name: string; age?: number };
 * type ResultUser = Result<User, Error>;
 * type RequiredUser = RequireSuccess<ResultUser, 'age'>; // Result<{ name: string; age: number }, Error>
 * ```
 */
export type RequireSuccess<T extends Result<unknown, unknown>, K extends keyof SuccessType<T>> = Result<
    Omit<SuccessType<T>, K> & Required<Pick<SuccessType<T>, K>>,
    ErrorType<T>
>;

/**
 * Make properties optional in the success type of a Result
 *
 * @example
 * ```typescript
 * type User = { name: string; age: number };
 * type ResultUser = Result<User, Error>;
 * type OptionalAge = PartialSuccess<ResultUser, 'age'>; // Result<{ name: string; age?: number }, Error>
 * ```
 */
export type PartialSuccess<T extends Result<unknown, unknown>, K extends keyof SuccessType<T>> = Result<
    Omit<SuccessType<T>, K> & Partial<Pick<SuccessType<T>, K>>,
    ErrorType<T>
>;

// ============================================================================
// Api Response Types
// ============================================================================

/**
 * Type for API responses that return Results
 *
 * @example
 * ```typescript
 * type UserApiResponse = ApiResult<User>;
 * // Result is: Result<{ data: User; error?: never }, { data?: never; error: ApiError }>
 * ```
 */
export type ApiResult<T> = Result<
    { data: T; success: true },
    { error: AppError; success: false }
>;

/**
 * Type for paginated API responses
 *
 * @example
 * ```typescript
 * type PostsResponse = PaginatedResult<Post>;
 * // Result is: Result<{ data: Post[]; total: number; page: number }, AppError>
 * ```
 */
export type PaginatedResult<T> = Result<
    {
        data: T[];
        total: number;
        page: number;
        pageSize: number;
        hasMore: boolean;
    },
    AppError
>;

// ============================================================================
// Inference Helpers
// ============================================================================

/**
 * Infer the success type from a function that returns ResultAsync
 *
 * @example
 * ```typescript
 * function fetchUser(id: string): ResultAsync<User, Error> { ... }
 * type User = InferSuccess<typeof fetchUser>; // User
 * ```
 */
export type InferSuccess<T extends (...args: unknown[]) => ResultAsync<unknown, unknown>> = Awaited<
    ReturnType<T>
> extends Result<infer U, unknown>
    ? U
    : never;

/**
 * Infer the error type from a function that returns ResultAsync
 *
 * @example
 * ```typescript
 * function fetchUser(id: string): ResultAsync<User, DatabaseError> { ... }
 * type Error = InferError<typeof fetchUser>; // DatabaseError
 * ```
 */
export type InferError<T extends (...args: unknown[]) => ResultAsync<unknown, unknown>> = Awaited<
    ReturnType<T>
> extends Result<unknown, infer E>
    ? E
    : never;

// ============================================================================
// Assert Type Guards
// ============================================================================

/**
 * Type guard for Ok results (used in type assertions)
 *
 * @example
 * ```typescript
 * function assertOk<T, E>(result: Result<T, E>): asserts result is Ok<T> {
 *     if (!result.isOk()) throw result.error;
 * }
 * ```
 */
export type AssertOk<T, E> = (result: Result<T, E>) => asserts result is Ok<T, E>;

/**
 * Type guard for Err results (used in type assertions)
 *
 * @example
 * ```typescript
 * function assertErr<T, E>(result: Result<T, E>): asserts result is Err<E> {
 *     if (result.isOk()) throw new Error('Expected error');
 * }
 * ```
 */
export type AssertErr<T, E> = (result: Result<T, E>) => asserts result is Err<T, E>;
