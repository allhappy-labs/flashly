/**
 * Frontend API client with neverthrow Result types
 *
 * This provides a type-safe API client that returns Result types for all requests,
 * making error handling explicit and type-safe throughout the frontend.
 */

import { errAsync, type ResultAsync } from 'neverthrow';
import {
    NetworkError,
    ApiError,
    ValidationError,
    AuthenticationError,
    safeAsync,
} from '@flashly/shared';
import { TRPCClientError } from '@trpc/client';
import type { AppRouter } from '@flashly/api/trpc';
import { parsePath, shouldBypassTrpc } from '@flashly/api-contracts';
import { getFrontendTrpcClient } from '@/lib/trpc/client';

// ============================================================================
// Types
// ============================================================================

interface ApiClientConfig {
    baseUrl: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
    getAuthToken?: () => Promise<string | null>;
}

interface RequestOptions {
    headers?: Record<string, string>;
    timeout?: number;
}

// ============================================================================
// API Client Class
// ============================================================================

export class ApiClient {
    constructor(private config: ApiClientConfig) {}

    /**
     * Get auth token and add to headers
     */
    private async getHeaders(customHeaders?: Record<string, string>): Promise<Record<string, string>> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...this.config.headers,
            ...customHeaders,
        };

        // Add auth token if available
        if (this.config.getAuthToken) {
            const token = await this.config.getAuthToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        return headers;
    }

    /**
     * Build full URL
     */
    private buildUrl(path: string): string {
        const baseUrl = this.config.baseUrl.replace(/\/$/, '');
        const cleanPath = path.replace(/^\//, '');
        return `${baseUrl}/${cleanPath}`;
    }

    /**
     * Generic GET request
     */
    get<T>(path: string, options?: RequestOptions): ResultAsync<T, NetworkError | ApiError | ValidationError> {
        return this.request<T>('GET', path, undefined, options);
    }

    /**
     * Generic POST request
     */
    post<T>(path: string, data?: unknown, options?: RequestOptions): ResultAsync<T, NetworkError | ApiError | ValidationError> {
        return this.request<T>('POST', path, data, options);
    }

    /**
     * Generic PUT request
     */
    put<T>(path: string, data?: unknown, options?: RequestOptions): ResultAsync<T, NetworkError | ApiError | ValidationError> {
        return this.request<T>('PUT', path, data, options);
    }

    /**
     * Generic PATCH request
     */
    patch<T>(path: string, data?: unknown, options?: RequestOptions): ResultAsync<T, NetworkError | ApiError | ValidationError> {
        return this.request<T>('PATCH', path, data, options);
    }

    /**
     * Generic DELETE request
     */
    delete<T>(path: string, options?: RequestOptions): ResultAsync<T, NetworkError | ApiError | ValidationError> {
        return this.request<T>('DELETE', path, undefined, options);
    }

    /**
     * Generic request method
     */
    private request<T>(
        method: string,
        path: string,
        data?: unknown,
        options?: RequestOptions
    ): ResultAsync<T, NetworkError | ApiError | ValidationError> {
        if (!shouldBypassTrpc(path)) {
            return this.requestViaTrpc<T>(method, path, data, options);
        }

        return safeAsync(
            (async () => {
                const headers = await this.getHeaders(options?.headers);
                const url = this.buildUrl(path);
                const timeoutMs = options?.timeout ?? this.config.timeoutMs;

                const controller = timeoutMs ? new AbortController() : null;
                const timeoutId = controller
                    ? setTimeout(() => controller.abort(), timeoutMs)
                    : null;

                try {
                    const requestOptions: RequestInit = {
                        method,
                        headers,
                        signal: controller?.signal,
                        credentials: 'include',
                    };

                    if (data && method !== 'GET' && method !== 'HEAD') {
                        requestOptions.body = JSON.stringify(data);
                    }

                    const response = await fetch(url, requestOptions);
                    return response;
                } finally {
                    if (timeoutId) clearTimeout(timeoutId);
                }
            })(),
            (error) => new NetworkError('Request initialization failed', { cause: error })
        ).andThen((response) => {
            if (response.status === 401) {
                return errAsync(
                    new AuthenticationError('Authentication required or token expired')
                );
            }

            if (!response.ok) {
                return errAsync(
                    new ApiError(
                        `HTTP ${response.status}: ${response.statusText}`,
                        response.status,
                        { context: { url: response.url } }
                    )
                );
            }

            return safeAsync(
                response.status === 204 ? Promise.resolve(undefined as T) : response.json(),
                (error) => new ValidationError('Failed to parse response body', { cause: error })
            );
        }) as ResultAsync<T, NetworkError | ApiError | ValidationError>;
    }

    private requestViaTrpc<T>(
        method: string,
        path: string,
        data?: unknown,
        options?: RequestOptions
    ): ResultAsync<T, NetworkError | ApiError | ValidationError> {
        return safeAsync(
            (async () => {
                const trpcClient = getFrontendTrpcClient();
                if (!trpcClient) {
                    throw new NetworkError('tRPC client is not initialized');
                }

                const headers = await this.getHeaders(options?.headers);
                const parsedPath = parsePath(path);

                if (method === 'GET') {
                    return await trpcClient.transport.query.query({
                        headers,
                        path: parsedPath.path,
                        query: parsedPath.query,
                    }) as T;
                }

                return await trpcClient.transport.mutate.mutate({
                    body: data,
                    headers,
                    method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
                    path: parsedPath.path,
                    query: parsedPath.query,
                }) as T;
            })(),
            (error) => {
                if (error instanceof TRPCClientError) {
                    const trpcError = error as TRPCClientError<AppRouter> & {
                        data?: { httpStatus?: unknown };
                    };
                    const statusCode = typeof trpcError.data?.httpStatus === 'number'
                        ? trpcError.data.httpStatus
                        : 500;
                    if (statusCode === 401) {
                        return new AuthenticationError(trpcError.message || 'Authentication required or token expired', {
                            cause: trpcError,
                        });
                    }

                    return new ApiError(trpcError.message || 'tRPC request failed', statusCode, {
                        cause: trpcError,
                        context: { path },
                    });
                }

                if (error instanceof ApiError || error instanceof NetworkError || error instanceof ValidationError) {
                    return error;
                }

                return new NetworkError('tRPC request failed', { cause: error });
            }
        );
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let apiClientInstance: ApiClient | null = null;

export function createApiClient(config: ApiClientConfig): ApiClient {
    return new ApiClient(config);
}

export function getApiClient(): ApiClient | null {
    return apiClientInstance;
}

export function setApiClient(client: ApiClient): void {
    apiClientInstance = client;
}
