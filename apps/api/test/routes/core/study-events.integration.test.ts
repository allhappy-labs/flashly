import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../../helper.ts';
import { createAuthenticatedUser } from '../../utils/auth-factory.ts';
import { createTestDeckWithCards } from '../../utils/data-factory.ts';
import { assertSuccess, assertStatus, assertBodyHasKeys } from '../../utils/assertions.ts';
import { isDatabaseAvailable } from '../../utils/database-helpers.ts';

test('study events routes - record batch review events', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'review-events');
    const { deck, cards } = await createTestDeckWithCards(app, user, 3);

    const reviewEvents = [
        {
            id: `review-${Date.now()}-1`,
            deckId: deck.id,
            cardId: cards[0].id,
            rating: 4,
            reviewedAt: new Date(),
            responseMs: 1500,
        },
        {
            id: `review-${Date.now()}-2`,
            deckId: deck.id,
            cardId: cards[1].id,
            rating: 3,
            reviewedAt: new Date(),
            responseMs: 2000,
        },
    ];

    const response = await app.inject({
        method: 'POST',
        url: '/api/study/events/batch',
        headers: user.headers,
        payload: { reviewEvents },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assertBodyHasKeys(response, ['acceptedIds']);
    assert.ok(Array.isArray(body.acceptedIds));
    assert.equal(body.acceptedIds.length, 2);
});

test('study events routes - record batch session events', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'session-events');
    const { deck } = await createTestDeckWithCards(app, user, 5);

    const sessionId = `session-${Date.now()}`;
    const sessionEvents = [
        {
            id: `session-event-${Date.now()}-1`,
            deckId: deck.id,
            sessionId,
            startedAt: new Date(Date.now() - 60000), // 1 minute ago
            endedAt: new Date(),
            durationMs: 60000,
            deviceId: 'test-device-1',
        },
    ];

    const response = await app.inject({
        method: 'POST',
        url: '/api/study/events/batch',
        headers: user.headers,
        payload: { sessionEvents },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.acceptedIds));
    assert.equal(body.acceptedIds.length, 1);
});

test('study events routes - record mixed review and session events', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'mixed-events');
    const { deck, cards } = await createTestDeckWithCards(app, user, 3);

    const sessionId = `session-${Date.now()}`;
    const reviewEvents = [
        {
            id: `review-${Date.now()}-1`,
            deckId: deck.id,
            cardId: cards[0].id,
            rating: 5,
            reviewedAt: new Date(),
        },
    ];
    const sessionEvents = [
        {
            id: `session-${Date.now()}-1`,
            deckId: deck.id,
            sessionId,
            startedAt: new Date(),
            durationMs: 30000,
        },
    ];

    const response = await app.inject({
        method: 'POST',
        url: '/api/study/events/batch',
        headers: user.headers,
        payload: { reviewEvents, sessionEvents },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.acceptedIds));
    assert.equal(body.acceptedIds.length, 2);
});

test('study events routes - record events without auth returns 401', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'POST',
        url: '/api/study/events/batch',
        payload: {
            reviewEvents: [{
                id: 'test-review',
                deckId: 'test-deck',
                cardId: 'test-card',
                rating: 4,
                reviewedAt: new Date(),
            }],
        },
    });

    assertStatus(response, 401);
});

test('study events routes - record events with empty arrays', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'empty-events');

    const response = await app.inject({
        method: 'POST',
        url: '/api/study/events/batch',
        headers: user.headers,
        payload: {
            reviewEvents: [],
            sessionEvents: [],
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.acceptedIds));
    assert.equal(body.acceptedIds.length, 0);
});

test('study events routes - record events with all optional fields', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'full-fields');
    const { deck, cards } = await createTestDeckWithCards(app, user, 2);

    const reviewEvents = [
        {
            id: `review-${Date.now()}-full`,
            deckId: deck.id,
            cardId: cards[0].id,
            rating: 4,
            reviewedAt: new Date(),
            responseMs: 1234,
            deviceId: 'test-device-id',
            clientUpdatedAt: new Date(),
        },
    ];

    const response = await app.inject({
        method: 'POST',
        url: '/api/study/events/batch',
        headers: user.headers,
        payload: { reviewEvents },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.acceptedIds));
    assert.equal(body.acceptedIds.length, 1);
});

test('study events routes - handle large batch of events', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'large-batch');
    const { deck, cards } = await createTestDeckWithCards(app, user, 10);

    // Create 20 review events
    const reviewEvents = cards.flatMap((card, i) => [
        {
            id: `review-${Date.now()}-${i}-a`,
            deckId: deck.id,
            cardId: card.id,
            rating: Math.floor(Math.random() * 4) + 1, // 1-4
            reviewedAt: new Date(),
        },
        {
            id: `review-${Date.now()}-${i}-b`,
            deckId: deck.id,
            cardId: card.id,
            rating: Math.floor(Math.random() * 4) + 1,
            reviewedAt: new Date(),
        },
    ]).slice(0, 20);

    const response = await app.inject({
        method: 'POST',
        url: '/api/study/events/batch',
        headers: user.headers,
        payload: { reviewEvents },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.acceptedIds));
    assert.equal(body.acceptedIds.length, 20);
});

test('study events routes - record session with null endedAt', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'ongoing-session');
    const { deck } = await createTestDeckWithCards(app, user, 5);

    const sessionEvents = [
        {
            id: `session-${Date.now()}-ongoing`,
            deckId: deck.id,
            sessionId: `ongoing-${Date.now()}`,
            startedAt: new Date(),
            endedAt: null,
            durationMs: null,
        },
    ];

    const response = await app.inject({
        method: 'POST',
        url: '/api/study/events/batch',
        headers: user.headers,
        payload: { sessionEvents },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.acceptedIds));
});

test('study events routes - all rating values are accepted', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'rating-values');
    const { deck, cards } = await createTestDeckWithCards(app, user, 6);

    const ratings = [1, 2, 3, 4, 5, 6]; // Common FSRS ratings
    const reviewEvents = ratings.map((rating, i) => ({
        id: `review-rating-${Date.now()}-${i}`,
        deckId: deck.id,
        cardId: cards[i % cards.length].id,
        rating,
        reviewedAt: new Date(),
    }));

    const response = await app.inject({
        method: 'POST',
        url: '/api/study/events/batch',
        headers: user.headers,
        payload: { reviewEvents },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.acceptedIds));
    assert.equal(body.acceptedIds.length, ratings.length);
});

test('study events routes - accepts clientUpdatedAt for sync', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'sync-client');
    const { deck, cards } = await createTestDeckWithCards(app, user, 2);

    const clientTime = new Date(Date.now() - 5000);
    const reviewEvents = [
        {
            id: `review-${Date.now()}-sync`,
            deckId: deck.id,
            cardId: cards[0].id,
            rating: 4,
            reviewedAt: clientTime,
            clientUpdatedAt: clientTime,
        },
    ];

    const response = await app.inject({
        method: 'POST',
        url: '/api/study/events/batch',
        headers: user.headers,
        payload: { reviewEvents },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.acceptedIds));
});
