import type { FastifyInstance } from 'fastify';
import type { AuthenticatedUser } from './auth-factory.js';

/**
 * Test data factory for creating test entities.
 * These functions create data via API calls to test the full stack.
 */

export interface CreateDeckOptions {
    name?: string;
    description?: string;
    visibility?: 'private' | 'public';
    materialType?: string;
    deckType?: string;
    locale?: string;
    accentKey?: string;
}

export interface CreateCardOptions {
    front: string;
    back: string;
    imageUrl?: string;
    audioUrl?: string;
    category?: string;
    tags?: string;
    pos?: string;
    gender?: string;
    example?: string;
}

export interface BulkCreateCardsOptions {
    cards: CreateCardOptions[];
}

/**
 * Creates a test deck via API.
 *
 * @param app - Fastify instance
 * @param user - Authenticated user
 * @param options - Deck options
 * @returns Created deck object
 */
export async function createTestDeck(
    app: FastifyInstance,
    user: AuthenticatedUser,
    options: CreateDeckOptions = {}
): Promise<{
    id: string;
    name: string;
    description: string | null;
    visibility: string;
    userId: string;
}> {
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const payload = {
        name: options.name || `Test Deck ${nonce}`,
        description: options.description || `Test deck created at ${new Date().toISOString()}`,
        visibility: options.visibility || 'private',
        materialType: options.materialType,
        deckType: options.deckType,
        locale: options.locale,
        accentKey: options.accentKey,
    };

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks',
        headers: user.headers,
        payload,
    });

    if (response.statusCode !== 200) {
        throw new Error(`Failed to create deck: ${response.statusCode} ${response.body}`);
    }

    return JSON.parse(response.body);
}

/**
 * Creates a test card in a deck via API.
 *
 * @param app - Fastify instance
 * @param user - Authenticated user
 * @param deckId - Deck ID
 * @param options - Card options
 * @returns Created card object
 */
export async function createTestCard(
    app: FastifyInstance,
    user: AuthenticatedUser,
    deckId: string,
    options: CreateCardOptions
): Promise<{
    id: string;
    deckId: string;
    front: string;
    back: string;
}> {
    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/${deckId}/cards`,
        headers: user.headers,
        payload: options,
    });

    if (response.statusCode !== 200) {
        throw new Error(`Failed to create card: ${response.statusCode} ${response.body}`);
    }

    return JSON.parse(response.body);
}

/**
 * Creates multiple test cards in a deck via API.
 *
 * @param app - Fastify instance
 * @param user - Authenticated user
 * @param deckId - Deck ID
 * @param cards - Array of card options
 * @returns Bulk create result with count and skipped duplicates
 */
export async function createTestCards(
    app: FastifyInstance,
    user: AuthenticatedUser,
    deckId: string,
    cards: CreateCardOptions[]
): Promise<{ count: number; skippedDuplicates: number }> {
    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/${deckId}/cards`,
        headers: user.headers,
        payload: { cards },
    });

    if (response.statusCode !== 200) {
        throw new Error(`Failed to create cards: ${response.statusCode} ${response.body}`);
    }

    return JSON.parse(response.body);
}

/**
 * Creates a test deck with cards.
 *
 * @param app - Fastify instance
 * @param user - Authenticated user
 * @param cardCount - Number of cards to create
 * @param deckOptions - Optional deck options
 * @returns Object with deck and cards
 */
export async function createTestDeckWithCards(
    app: FastifyInstance,
    user: AuthenticatedUser,
    cardCount: number = 5,
    deckOptions: CreateDeckOptions = {}
): Promise<{
    deck: { id: string; name: string };
    cards: Array<{ id: string; front: string; back: string }>;
}> {
    const deck = await createTestDeck(app, user, deckOptions);
    const cards: Array<{ id: string; front: string; back: string }> = [];

    for (let i = 0; i < cardCount; i++) {
        const card = await createTestCard(app, user, deck.id, {
            front: `Front ${i}`,
            back: `Back ${i}`,
        });
        cards.push(card);
    }

    return { deck, cards };
}

/**
 * Generates test card data with unique content.
 *
 * @param count - Number of cards to generate
 * @param prefix - Prefix for card content
 * @returns Array of card creation options
 */
export function generateTestCards(
    count: number,
    prefix: string = 'card'
): CreateCardOptions[] {
    const nonce = Date.now();
    return Array.from({ length: count }, (_, i) => ({
        front: `${prefix}-${nonce}-front-${i}`,
        back: `${prefix}-${nonce}-back-${i}`,
        category: i % 3 === 0 ? 'noun' : i % 3 === 1 ? 'verb' : 'adjective',
    }));
}

/**
 * Creates a public test deck for marketplace testing.
 *
 * @param app - Fastify instance
 * @param user - Authenticated user
 * @param options - Optional deck options
 * @returns Created public deck
 */
export async function createPublicDeck(
    app: FastifyInstance,
    user: AuthenticatedUser,
    options: CreateDeckOptions = {}
): Promise<{
    id: string;
    name: string;
    visibility: string;
}> {
    return createTestDeck(app, user, {
        ...options,
        visibility: 'public',
    });
}

/**
 * Updates a deck via API.
 *
 * @param app - Fastify instance
 * @param user - Authenticated user
 * @param deckId - Deck ID
 * @param updates - Deck updates
 * @returns Updated deck
 */
export async function updateTestDeck(
    app: FastifyInstance,
    user: AuthenticatedUser,
    deckId: string,
    updates: Partial<CreateDeckOptions>
): Promise<unknown> {
    const response = await app.inject({
        method: 'PATCH',
        url: `/api/decks/${deckId}`,
        headers: user.headers,
        payload: updates,
    });

    if (response.statusCode !== 200) {
        throw new Error(`Failed to update deck: ${response.statusCode} ${response.body}`);
    }

    return JSON.parse(response.body);
}

/**
 * Deletes a deck via API.
 *
 * @param app - Fastify instance
 * @param user - Authenticated user
 * @param deckId - Deck ID
 * @returns true if successful
 */
export async function deleteTestDeck(
    app: FastifyInstance,
    user: AuthenticatedUser,
    deckId: string
): Promise<boolean> {
    const response = await app.inject({
        method: 'DELETE',
        url: `/api/decks/${deckId}`,
        headers: user.headers,
    });

    return response.statusCode === 204;
}

/**
 * Creates a test rating for a deck.
 *
 * @param app - Fastify instance
 * @param user - Authenticated user
 * @param deckId - Deck ID
 * @param rating - Rating value (1-5)
 * @returns Created rating
 */
export async function createTestRating(
    app: FastifyInstance,
    user: AuthenticatedUser,
    deckId: string,
    rating: number
): Promise<unknown> {
    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/${deckId}/ratings`,
        headers: user.headers,
        payload: { rating },
    });

    if (response.statusCode !== 200) {
        throw new Error(`Failed to create rating: ${response.statusCode} ${response.body}`);
    }

    return JSON.parse(response.body);
}

/**
 * Creates a test review for a deck.
 *
 * @param app - Fastify instance
 * @param user - Authenticated user
 * @param deckId - Deck ID
 * @param review - Review data
 * @returns Created review
 */
export async function createTestReview(
    app: FastifyInstance,
    user: AuthenticatedUser,
    deckId: string,
    review: { rating: number; title?: string; content: string }
): Promise<unknown> {
    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/${deckId}/reviews`,
        headers: user.headers,
        payload: review,
    });

    if (response.statusCode !== 200) {
        throw new Error(`Failed to create review: ${response.statusCode} ${response.body}`);
    }

    return JSON.parse(response.body);
}

/**
 * Records a study event via API.
 *
 * @param app - Fastify instance
 * @param user - Authenticated user
 * @param events - Study events to record
 * @returns Accepted event IDs
 */
export async function recordStudyEvents(
    app: FastifyInstance,
    user: AuthenticatedUser,
    events: {
        reviewEvents?: Array<{
            id: string;
            deckId: string;
            cardId: string;
            rating: number;
            reviewedAt: Date;
            responseMs?: number;
            deviceId?: string;
        }>;
        sessionEvents?: Array<{
            id: string;
            deckId: string;
            sessionId: string;
            startedAt: Date;
            endedAt?: Date;
            durationMs?: number;
            deviceId?: string;
        }>;
    }
): Promise<{ acceptedIds: string[] }> {
    const response = await app.inject({
        method: 'POST',
        url: '/api/study/events/batch',
        headers: user.headers,
        payload: events,
    });

    if (response.statusCode !== 200) {
        throw new Error(`Failed to record study events: ${response.statusCode} ${response.body}`);
    }

    return JSON.parse(response.body);
}
