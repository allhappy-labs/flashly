/**
 * Mobile API client with neverthrow Result types
 *
 * This provides a type-safe API client for React Native that returns Result types
 * for all requests, making error handling explicit and type-safe.
 */

import type { ResultAsync } from 'neverthrow';
import {
    NetworkError,
    ApiError,
    ValidationError,
    safeFetch,
    safeAsync,
} from '@flashly/shared';
import { TRPCClientError } from '@trpc/client';
import { parsePath, shouldBypassTrpc } from '@flashly/api-contracts';
import { getMobileTrpcClient } from '../trpc/client';

// ============================================================================
// Types
// ============================================================================

interface MobileApiClientConfig {
    baseUrl: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
    getAuthToken?: () => Promise<string | null>;
    getAuthCookie?: () => Promise<string | null>;
}

interface RequestOptions {
    headers?: Record<string, string>;
    timeout?: number;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function getObjectProperty(value: unknown, key: string): unknown {
    if (!isObjectRecord(value)) {
        return undefined;
    }
    return value[key];
}

function getHttpStatusCode(error: unknown): number | null {
    const errorData = getObjectProperty(error, 'data');
    const httpStatus = getObjectProperty(errorData, 'httpStatus');
    return typeof httpStatus === 'number' ? httpStatus : null;
}

// ============================================================================
// Mobile API Client Class
// ============================================================================

export class MobileApiClient {
    constructor(private config: MobileApiClientConfig) {}

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

        if (this.config.getAuthCookie) {
            const cookie = await this.config.getAuthCookie();
            if (cookie) {
                headers['Cookie'] = cookie;
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
     * Upload file with multipart/form-data
     */
    upload<T>(
        path: string,
        file: { uri: string; name: string; type: string },
        additionalData?: Record<string, string>,
        options?: RequestOptions
    ): ResultAsync<T, NetworkError | ApiError | ValidationError> {
        return safeAsync(
            (async () => {
                const headers = await this.getHeaders(options?.headers);
                // Remove Content-Type to let fetch set it with boundary
                delete headers['Content-Type'];

                const formData = new FormData();
                // React Native's FormData expects a file payload object, but TypeScript types expect Blob.
                // This is a known limitation of React Native's type definitions for FormData.append().
                const filePayload = {
                    uri: file.uri,
                    name: file.name,
                    type: file.type,
                };
                formData.append('file', filePayload as unknown as Blob);

                // Add additional form data
                if (additionalData) {
                    Object.entries(additionalData).forEach(([key, value]) => {
                        formData.append(key, value);
                    });
                }

                const url = this.buildUrl(path);

                return safeFetch(url, {
                    method: 'POST',
                    headers,
                    body: formData,
                    timeoutMs: options?.timeout ?? this.config.timeoutMs,
                });
            })(),
            (error) => new NetworkError('Upload initialization failed', { cause: error })
        ).andThen((result) => result)
            .andThen((response) => this.parseJsonResponse<T>(response, 'Failed to parse upload response'));
    }

    /**
     * Generic request method
     */
    private request<T>(
        method: HttpMethod,
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

                const requestOptions: RequestInit & { timeoutMs?: number } = {
                    method,
                    headers,
                    timeoutMs: options?.timeout ?? this.config.timeoutMs,
                };

                if (data && method !== 'GET') {
                    requestOptions.body = JSON.stringify(data);
                }

                return safeFetch(url, requestOptions);
            })(),
            (error) => new NetworkError('Request initialization failed', { cause: error })
        ).andThen((result) => result)
            .andThen((response) => this.parseJsonResponse<T>(response, 'Failed to parse response body'));
    }

    private requestViaTrpc<T>(
        method: HttpMethod,
        path: string,
        data?: unknown,
        options?: RequestOptions
    ): ResultAsync<T, NetworkError | ApiError | ValidationError> {
        return safeAsync(
            (async () => {
                const trpcClient = getMobileTrpcClient();
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
                    method,
                    path: parsedPath.path,
                    query: parsedPath.query,
                }) as T;
            })(),
            (error) => {
                if (error instanceof TRPCClientError) {
                    const statusCode = getHttpStatusCode(error)
                        ?? getHttpStatusCode(error.cause)
                        ?? 500;
                    return new ApiError(error.message || 'tRPC request failed', statusCode, {
                        cause: error,
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

    private parseJsonResponse<T>(
        response: Response,
        parseErrorMessage: string
    ): ResultAsync<T, ValidationError> {
        if (response.status === 204) {
            return safeAsync(
                Promise.resolve(undefined as T),
                (error) => new ValidationError(parseErrorMessage, { cause: error })
            );
        }

        return safeAsync(
            response.json(),
            (error) => new ValidationError(parseErrorMessage, { cause: error })
        );
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let mobileApiClientInstance: MobileApiClient | null = null;

export function createMobileApiClient(config: MobileApiClientConfig): MobileApiClient {
    return new MobileApiClient(config);
}

export function getMobileApiClient(): MobileApiClient | null {
    return mobileApiClientInstance;
}

export function setMobileApiClient(client: MobileApiClient): void {
    mobileApiClientInstance = client;
}

// ============================================================================
// Example Usage
// ============================================================================

/*
// Initialize the client (typically in app entry point)
import Constants from 'expo-constants';

const api = createMobileApiClient({
    baseUrl: Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000',
    timeoutMs: 15000, // Mobile might need longer timeout
    getAuthToken: async () => {
        // Get token from secure storage
        const token = await SecureStore.getItemAsync('authToken');
        return token;
    },
});

// Use in components with custom hooks
function useUserProfile(userId: string) {
    return useResult(
        () => api.get<User>(`/api/users/${userId}`),
        { dependencies: [userId] }
    );
}

// Flashcards example
function useGenerateFlashcards() {
    const { mutate, isLoading, error, data } = useMutation(
        (file: File, options: GenerateOptions) =>
            api.upload<FlashcardsResponse>('/api/flashcards', file, options)
    );

    return {
        generateFlashcards: mutate,
        isLoading,
        error,
        flashcards: data,
    };
}

// Deck operations
function useDecks() {
    return useResult(
        () => api.get<Deck[]>('/api/decks'),
        { dependencies: [] }
    );
}

function useCreateDeck() {
    const { mutate, isLoading, error, data } = useMutation(
        (deckData: CreateDeckInput) =>
            api.post<Deck>('/api/decks', deckData)
    );

    return {
        createDeck: mutate,
        isLoading,
        error,
        deck: data,
    };
}

// Offline-aware hook with local storage
function useDecksWithSync() {
    const [localDecks, setLocalDecks] = useState<Deck[]>([]);

    // First, try to load from local storage
    useEffect(() => {
        loadDecksFromStorage().then(setLocalDecks);
    }, []);

    // Then fetch from API
    const { data: remoteDecks, error, isLoading } = useResult(
        () => api.get<Deck[]>('/api/decks')
    );

    // Update local storage when remote fetch succeeds
    useEffect(() => {
        if (remoteDecks) {
            saveDecksToStorage(remoteDecks);
            setLocalDecks(remoteDecks);
        }
    }, [remoteDecks]);

    return {
        decks: localDecks,
        isLoading,
        error,
        isFromStorage: !remoteDecks && localDecks.length > 0,
    };
}
*/
