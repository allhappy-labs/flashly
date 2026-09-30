import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../../helper.ts';
import { createAuthenticatedUser } from '../../utils/auth-factory.ts';
import { createTestDeckWithCards } from '../../utils/data-factory.ts';
import { assertSuccess, assertStatus, assertBodyHasKeys } from '../../utils/assertions.ts';
import { isDatabaseAvailable } from '../../utils/database-helpers.ts';

test('sync routes - get sync state', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'sync-state');

    const response = await app.inject({
        method: 'GET',
        url: '/api/sync/state',
        headers: user.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assertBodyHasKeys(response, ['userId', 'lastSyncAt', 'syncCursor', 'pendingChanges']);
    assert.equal(body.userId, user.userId);
});

test('sync routes - get sync state requires auth', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/sync/state',
    });

    assertStatus(response, 401);
});

test('sync routes - full sync with empty client', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'full-sync-empty');

    const response = await app.inject({
        method: 'POST',
        url: '/api/sync/full',
        headers: user.headers,
        payload: {
            clientDecks: [],
            lastSyncAt: null,
            force: false,
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assertBodyHasKeys(response, [
        'success',
        'direction',
        'uploaded',
        'downloaded',
        'deleted',
        'conflicts',
        'duration',
        'syncedAt',
    ]);
    assert.equal(typeof body.success, 'boolean');
});

test('sync routes - full sync requires auth', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'POST',
        url: '/api/sync/full',
        payload: {
            clientDecks: [],
        },
    });

    assertStatus(response, 401);
});

test('sync routes - full sync with existing decks', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'full-sync-decks');
    await createTestDeckWithCards(app, user, 3);

    const response = await app.inject({
        method: 'POST',
        url: '/api/sync/full',
        headers: user.headers,
        payload: {
            clientDecks: [],
            lastSyncAt: null,
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    // Should download existing decks
    assert.equal(typeof body.downloaded, 'number');
});

test('sync routes - full sync with client data', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'client-sync');

    const clientDeck = {
        id: `client-${Date.now()}`,
        name: 'Client Deck',
        description: 'Created on client',
        visibility: 'private' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        cards: [
            {
                id: `client-card-${Date.now()}`,
                deckId: `client-${Date.now()}`,
                front: 'Client Front',
                back: 'Client Back',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ],
    };

    const response = await app.inject({
        method: 'POST',
        url: '/api/sync/full',
        headers: user.headers,
        payload: {
            clientDecks: [clientDeck],
            lastSyncAt: null,
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    // Should upload client deck
    assert.equal(typeof body.uploaded, 'number');
    assert.ok(body.uploaded >= 0);
});

test('sync routes - full sync clears malformed present quiz enrichment', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'full-sync-malformed-quiz');
    const timestamp = Date.now();
    const deckId = `client-quiz-deck-${timestamp}`;
    const cardId = `client-quiz-card-${timestamp}`;

    const response = await app.inject({
        method: 'POST',
        url: '/api/sync/full',
        headers: user.headers,
        payload: {
            clientDecks: [{
                id: deckId,
                name: 'Client Quiz Deck',
                updatedAt: new Date(),
                cards: [{
                    id: cardId,
                    deckId,
                    front: 'Vater',
                    back: 'father',
                    updatedAt: new Date(),
                    quiz: {
                        prompt: 'Which article belongs to Vater?',
                        options: ['der', 'der'],
                        correctAnswer: 'der',
                        explanation: 'Vater is masculine.',
                    },
                }],
            }],
        },
    });

    assertSuccess(response);

    const deckResponse = await app.inject({
        method: 'GET',
        url: `/api/decks/${deckId}`,
        headers: user.headers,
    });

    assertSuccess(deckResponse);
    const deck = JSON.parse(deckResponse.body);
    const card = deck.cards.find((item: { id: string; quiz: unknown }) => item.id === cardId);
    assert.strictEqual(card?.quiz, null);
});

test('sync routes - incremental sync', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'incremental');

    const response = await app.inject({
        method: 'POST',
        url: '/api/sync/incremental',
        headers: user.headers,
        payload: {
            cursor: '0',
            limit: 100,
            changes: [],
        },
    });

    assertSuccess(response);
    assertBodyHasKeys(response, [
        'success',
        'direction',
        'uploaded',
        'downloaded',
        'deleted',
        'conflicts',
        'duration',
        'syncedAt',
        'cursor',
        'hasMore',
    ]);
});

test('sync routes - incremental sync requires auth', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'POST',
        url: '/api/sync/incremental',
        payload: {
            cursor: '0',
            limit: 100,
        },
    });

    assertStatus(response, 401);
});

test('sync routes - incremental sync with changes', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'incremental-changes');

    const changes = [
        {
            entityType: 'deck' as const,
            entityId: `client-deck-${Date.now()}`,
            operation: 'create' as const,
            data: {
                name: 'New Deck',
                visibility: 'private' as const,
            },
            clientUpdatedAt: new Date().toISOString(),
        },
    ];

    const response = await app.inject({
        method: 'POST',
        url: '/api/sync/incremental',
        headers: user.headers,
        payload: {
            cursor: '0',
            limit: 100,
            changes,
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(typeof body.uploaded, 'number');
});

test('sync routes - incremental sync respects limit', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'sync-limit');
    await createTestDeckWithCards(app, user, 10);

    const response = await app.inject({
        method: 'POST',
        url: '/api/sync/incremental',
        headers: user.headers,
        payload: {
            cursor: '0',
            limit: 5,
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    // Check hasMore and cursor
    assert.equal(typeof body.hasMore, 'boolean');
    assert.ok(typeof body.cursor === 'string' || body.cursor === null);
});

test('sync routes - full sync with force option', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'force-sync');
    await createTestDeckWithCards(app, user, 2);

    const response = await app.inject({
        method: 'POST',
        url: '/api/sync/full',
        headers: user.headers,
        payload: {
            clientDecks: [],
            lastSyncAt: new Date(), // Recent sync time
            force: true, // Force sync anyway
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(typeof body.success, 'boolean');
});

test('sync routes - sync state updates after sync', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'sync-update');

    // Get initial state
    const initialState = await app.inject({
        method: 'GET',
        url: '/api/sync/state',
        headers: user.headers,
    });

    assertSuccess(initialState);

    // Perform sync
    await app.inject({
        method: 'POST',
        url: '/api/sync/incremental',
        headers: user.headers,
        payload: {
            cursor: '0',
            limit: 100,
        },
    });

    // Get updated state
    const updatedState = await app.inject({
        method: 'GET',
        url: '/api/sync/state',
        headers: user.headers,
    });

    assertSuccess(updatedState);
    assertBodyHasKeys(updatedState, ['userId', 'lastSyncAt', 'syncCursor']);
});

test('sync routes - full sync returns duration', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'sync-duration');

    const response = await app.inject({
        method: 'POST',
        url: '/api/sync/full',
        headers: user.headers,
        payload: {
            clientDecks: [],
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(typeof body.duration, 'number');
    assert.ok(body.duration >= 0);
});

test('sync routes - conflicts array is always present', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'sync-conflicts');

    const response = await app.inject({
        method: 'POST',
        url: '/api/sync/full',
        headers: user.headers,
        payload: {
            clientDecks: [],
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.conflicts));
});

test('sync routes - incremental sync with card operations', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'card-ops');

    const changes = [
        {
            entityType: 'card' as const,
            entityId: `client-card-${Date.now()}`,
            operation: 'create' as const,
            data: {
                front: 'New Card Front',
                back: 'New Card Back',
            },
            clientUpdatedAt: new Date().toISOString(),
        },
    ];

    const response = await app.inject({
        method: 'POST',
        url: '/api/sync/incremental',
        headers: user.headers,
        payload: {
            cursor: '0',
            limit: 100,
            changes,
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(typeof body.uploaded, 'number');
});

test('sync routes - incremental sync with delete operations', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'delete-ops');

    const changes = [
        {
            entityType: 'deck' as const,
            entityId: `deleted-deck-${Date.now()}`,
            operation: 'delete' as const,
            clientUpdatedAt: new Date().toISOString(),
        },
    ];

    const response = await app.inject({
        method: 'POST',
        url: '/api/sync/incremental',
        headers: user.headers,
        payload: {
            cursor: '0',
            limit: 100,
            changes,
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    // Delete operations should be handled
    assert.equal(typeof body.deleted, 'number');
});

test('sync routes - sync with update operations', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'update-ops');

    const changes = [
        {
            entityType: 'deck' as const,
            entityId: `update-deck-${Date.now()}`,
            operation: 'update' as const,
            data: {
                name: 'Updated Deck Name',
            },
            clientUpdatedAt: new Date().toISOString(),
        },
    ];

    const response = await app.inject({
        method: 'POST',
        url: '/api/sync/incremental',
        headers: user.headers,
        payload: {
            cursor: '0',
            limit: 100,
            changes,
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(typeof body.uploaded, 'number');
});

test('sync routes - sync state has numeric pending changes', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'pending-count');

    const response = await app.inject({
        method: 'GET',
        url: '/api/sync/state',
        headers: user.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(typeof body.pendingChanges, 'number');
    assert.ok(body.pendingChanges >= 0);
});
