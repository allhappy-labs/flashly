import * as assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import type { AuthenticatedUser } from './auth-factory.js';

/**
 * Reusable assertion helpers for integration tests.
 */

export type InjectResponse = {
    statusCode: number;
    body: string;
    headers: Record<string, string | string[] | undefined> | Record<string, unknown>;
};

/**
 * Convert Fastify inject response to our standard format
 */
export function toInjectResponse(response: { statusCode: number; body: string; headers: Record<string, unknown> }): InjectResponse {
    return {
        statusCode: response.statusCode,
        body: response.body,
        headers: response.headers,
    };
}

/**
 * Asserts that a response has the expected status code.
 *
 * @param response - Inject response
 * @param expectedStatus - Expected HTTP status code
 */
export function assertStatus(response: InjectResponse, expectedStatus: number): void {
    assert.equal(
        response.statusCode,
        expectedStatus,
        `Expected status ${expectedStatus} but got ${response.statusCode}: ${response.body}`
    );
}

/**
 * Asserts that a response is successful (2xx status).
 *
 * @param response - Inject response
 */
export function assertSuccess(response: InjectResponse): void {
    assert.ok(
        response.statusCode >= 200 && response.statusCode < 300,
        `Expected success status but got ${response.statusCode}: ${response.body}`
    );
}

/**
 * Asserts that a response is a client error (4xx status).
 *
 * @param response - Inject response
 * @param expectedStatus - Optional expected error status
 */
export function assertClientError(response: InjectResponse, expectedStatus?: number): void {
    if (expectedStatus) {
        assert.equal(response.statusCode, expectedStatus);
    } else {
        assert.ok(
            response.statusCode >= 400 && response.statusCode < 500,
            `Expected client error status but got ${response.statusCode}`
        );
    }
}

/**
 * Asserts that a response is a server error (5xx status).
 *
 * @param response - Inject response
 */
export function assertServerError(response: InjectResponse): void {
    assert.ok(
        response.statusCode >= 500 && response.statusCode < 600,
        `Expected server error status but got ${response.statusCode}`
    );
}

/**
 * Asserts that a response body matches expected JSON structure.
 *
 * @param response - Inject response
 * @param expectedBody - Expected JSON object (partial match)
 */
export function assertBodyMatches<T>(response: InjectResponse, expectedBody: Partial<T>): void {
    const body = JSON.parse(response.body) as T;
    for (const [key, value] of Object.entries(expectedBody)) {
        assert.deepEqual(
            (body as Record<string, unknown>)[key],
            value,
            `Expected body.${key} to equal ${JSON.stringify(value)}`
        );
    }
}

/**
 * Asserts that a response body contains all expected keys.
 *
 * @param response - Inject response or partial response
 * @param keys - Keys that should exist in response body
 */
export function assertBodyHasKeys(response: InjectResponse | { statusCode: number; body: string }, keys: string[]): void {
    const body = JSON.parse(response.body);
    for (const key of keys) {
        assert.ok(
            Object.prototype.hasOwnProperty.call(body, key),
            `Expected response body to have key "${key}"`
        );
    }
}

/**
 * Asserts that a response is an error response with error and message fields.
 *
 * @param response - Inject response
 * @param expectedError - Optional expected error code
 */
export function assertErrorResponse(response: InjectResponse, expectedError?: string): void {
    const body = JSON.parse(response.body);
    assert.ok(typeof body.error === 'string', 'Response should have "error" field');
    assert.ok(typeof body.message === 'string', 'Response should have "message" field');
    if (expectedError) {
        assert.equal(body.error, expectedError);
    }
}

/**
 * Asserts pagination response structure.
 *
 * @param response - Inject response
 * @param expectedKeys - Optional additional keys to check
 */
export function assertPaginatedResponse(
    response: InjectResponse,
    expectedKeys: string[] = []
): void {
    assertBodyHasKeys(response, ['items', 'total', 'page', 'limit', 'totalPages', 'hasMore']);
    if (expectedKeys.length > 0) {
        assertBodyHasKeys(response, expectedKeys);
    }
}

/**
 * Asserts that an array response has expected minimum length.
 *
 * @param response - Inject response
 * @param minLength - Minimum expected length
 */
export function assertArrayMinLength(response: InjectResponse, minLength: number): void {
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body), 'Response body should be an array');
    assert.ok(
        body.length >= minLength,
        `Expected array length >= ${minLength} but got ${body.length}`
    );
}

/**
 * Asserts that authentication is required (401 status).
 *
 * @param app - Fastify instance
 * @param method - HTTP method
 * @param url - Request URL
 * @param payload - Optional request payload
 */
export async function assertAuthRequired(
    app: FastifyInstance,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: Record<string, unknown>
): Promise<void> {
    const response = await app.inject({
        method,
        url,
        payload,
    });
    const injectResponse = toInjectResponse(response);
    assertStatus(injectResponse, 401);
}

/**
 * Asserts that a user is not authorized (403 status).
 *
 * @param app - Fastify instance
 * @param user - Authenticated user
 * @param method - HTTP method
 * @param url - Request URL
 * @param payload - Optional request payload
 */
export async function assertForbidden(
    app: FastifyInstance,
    user: AuthenticatedUser,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: Record<string, unknown>
): Promise<void> {
    const response = await app.inject({
        method,
        url,
        headers: user.headers,
        payload,
    });
    const injectResponse = toInjectResponse(response);
    assertStatus(injectResponse, 403);
}

/**
 * Asserts that a resource is not found (404 status).
 *
 * @param app - Fastify instance
 * @param user - Authenticated user
 * @param method - HTTP method
 * @param url - Request URL
 */
export async function assertNotFound(
    app: FastifyInstance,
    user: AuthenticatedUser,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string
): Promise<void> {
    const response = await app.inject({
        method,
        url,
        headers: user.headers,
    });
    assertStatus(response, 404);
}

/**
 * Asserts that a deck exists and belongs to the user.
 *
 * @param app - Fastify instance
 * @param user - Authenticated user
 * @param deckId - Deck ID to check
 */
export async function assertDeckExists(
    app: FastifyInstance,
    user: AuthenticatedUser,
    deckId: string
): Promise<void> {
    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deckId}`,
        headers: user.headers,
    });
    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.id, deckId);
    assert.equal(body.userId, user.userId);
}

/**
 * Asserts that a card exists in a deck.
 *
 * @param app - Fastify instance
 * @param user - Authenticated user
 * @param deckId - Deck ID
 * @param cardId - Card ID
 */
export async function assertCardExists(
    app: FastifyInstance,
    user: AuthenticatedUser,
    deckId: string,
    cardId: string
): Promise<void> {
    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deckId}`,
        headers: user.headers,
    });
    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.cards));
    const card = body.cards.find((c: { id: string }) => c.id === cardId);
    assert.ok(card, `Card ${cardId} not found in deck ${deckId}`);
}

/**
 * Asserts that a user is following another user.
 *
 * @param app - Fastify instance
 * @param follower - The follower
 * @param following - The user being followed
 */
export async function assertUserFollows(
    app: FastifyInstance,
    follower: AuthenticatedUser,
    following: AuthenticatedUser
): Promise<void> {
    const response = await app.inject({
        method: 'GET',
        url: `/api/users/${following.userId}/followers`,
        headers: follower.headers,
    });
    assertSuccess(response);
    const body = JSON.parse(response.body);
    const followerInList = body.users?.find((u: { id: string }) => u.id === follower.userId);
    assert.ok(followerInList, 'Follower not found in followers list');
}

/**
 * Asserts rate limit headers are present.
 *
 * @param response - Inject response
 */
export function assertRateLimited(response: InjectResponse): void {
    const rateLimit = response.headers['x-ratelimit-limit'];
    const rateRemaining = response.headers['x-ratelimit-remaining'];
    const rateReset = response.headers['x-ratelimit-reset'];

    assert.ok(
        rateLimit || rateRemaining || rateReset,
        'Expected rate limit headers to be present'
    );
}

/**
 * Helper to get a response body as JSON.
 *
 * @param response - Inject response
 * @returns Parsed JSON body
 */
export function getJsonBody<T = unknown>(response: InjectResponse): T {
    return JSON.parse(response.body) as T;
}

/**
 * Helper to get a response header value.
 *
 * @param response - Inject response
 * @param header - Header name
 * @returns Header value or undefined
 */
export function getHeader(response: InjectResponse, header: string): string | string[] | undefined {
    const normalizedHeader = Object.keys(response.headers).find(
        (h) => h.toLowerCase() === header.toLowerCase()
    );
    if (normalizedHeader === undefined) {
        return undefined;
    }
    const value = response.headers[normalizedHeader];
    return typeof value === 'string' || Array.isArray(value) ? value : undefined;
}

/**
 * Asserts content type header.
 *
 * @param response - Inject response
 * @param expectedContentType - Expected content type
 */
export function assertContentType(response: InjectResponse, expectedContentType: string): void {
    const contentType = getHeader(response, 'content-type');
    assert.ok(
        contentType?.toString().includes(expectedContentType),
        `Expected content-type to include "${expectedContentType}" but got "${contentType}"`
    );
}
