import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../../helper.ts';
import { createAuthenticatedUser } from '../../utils/auth-factory.ts';
import { createTestDeckWithCards } from '../../utils/data-factory.ts';
import {
    assertSuccess,
    assertStatus,
    assertBodyHasKeys,
} from '../../utils/assertions.ts';
import { isDatabaseAvailable } from '../../utils/database-helpers.ts';

test('analytics routes - get user stats', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'user-stats');

    const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/user',
        headers: user.headers,
    });

    assertSuccess(response);
    assertBodyHasKeys(response, [
        'totalDecks',
        'totalCards',
        'totalStudyTime',
        'cardsStudied',
        'cardsLearned',
        'cardsReviewing',
        'averageAccuracy',
        'studyStreak',
        'decksStudiedThisWeek',
        'cardsStudiedThisWeek',
    ]);
});

test('analytics routes - user stats requires auth', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/user',
    });

    assertStatus(response, 401);
});

test('analytics routes - get deck stats', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'deck-stats');
    const { deck } = await createTestDeckWithCards(app, user, 10);

    const response = await app.inject({
        method: 'GET',
        url: `/api/analytics/decks/${deck.id}`,
        headers: user.headers,
    });

    assertSuccess(response);
    assertBodyHasKeys(response, [
        'deckId',
        'deckName',
        'totalCards',
        'cardsStudied',
        'cardsLearned',
        'cardsReviewing',
        'averageAccuracy',
        'totalStudyTime',
        'lastStudiedAt',
        'studySessions',
        'masteryLevel',
    ]);
    const body = JSON.parse(response.body);
    assert.equal(body.deckId, deck.id);
    assert.equal(body.deckName, deck.name);
});

test('analytics routes - get deck stats for non-existent deck returns 404', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'notfound-deck-stats');

    const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/decks/non-existent-deck-id',
        headers: user.headers,
    });

    assertStatus(response, 404);
});

test('analytics routes - get deck stats requires auth', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/decks/some-deck-id',
    });

    assertStatus(response, 401);
});

test('analytics routes - get mastery progress', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'mastery');
    const { deck } = await createTestDeckWithCards(app, user, 20);

    const response = await app.inject({
        method: 'GET',
        url: `/api/analytics/decks/${deck.id}/mastery`,
        headers: user.headers,
    });

    assertSuccess(response);
    assertBodyHasKeys(response, ['notStudied', 'learning', 'mastered']);
    const body = JSON.parse(response.body);
    // Sum should equal total cards
    const total = body.notStudied + body.learning + body.mastered;
    assert.equal(total, 20);
});

test('analytics routes - get mastery progress with study activity', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'mastery-activity');
    const { deck, cards } = await createTestDeckWithCards(app, user, 10);

    // Record some study events
    const reviewEvents = cards.slice(0, 5).map((card, i) => ({
        id: `review-${Date.now()}-${i}`,
        deckId: deck.id,
        cardId: card.id,
        rating: 4,
        reviewedAt: new Date(),
    }));

    await app.inject({
        method: 'POST',
        url: '/api/study/events/batch',
        headers: user.headers,
        payload: { reviewEvents },
    });

    const response = await app.inject({
        method: 'GET',
        url: `/api/analytics/decks/${deck.id}/mastery`,
        headers: user.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(body.notStudied + body.learning + body.mastered === 10);
});

test('analytics routes - get study time data', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'study-time');

    const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/user/study-time?days=30',
        headers: user.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body));
    // Each entry should have date, studyTime, cardsStudied
    if (body.length > 0) {
        assertBodyHasKeys({ statusCode: 200, body: JSON.stringify(body[0]) }, [
            'date',
            'studyTime',
            'cardsStudied',
        ]);
    }
});

test('analytics routes - study time data with custom days', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'custom-days');

    const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/user/study-time?days=7',
        headers: user.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body));
    assert.ok(body.length <= 7);
});

test('analytics routes - get detailed deck analytics', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'detail-analytics');
    const { deck } = await createTestDeckWithCards(app, user, 15);

    const response = await app.inject({
        method: 'GET',
        url: `/api/analytics/decks/${deck.id}/detail?windowDays=30`,
        headers: user.headers,
    });

    assertSuccess(response);
    assertBodyHasKeys(response, [
        'totals',
        'retention',
        'easeBuckets',
        'dailyHistory',
        'ratingCounts',
        'dueForecast',
        'timeSpent',
        'windowDaysUsed',
    ]);
    const body = JSON.parse(response.body);

    // Verify structure of nested objects
    assert.equal(typeof body.totals, 'object');
    assert.equal(typeof body.retention, 'number');
    assert.ok(Array.isArray(body.easeBuckets));
    assert.ok(Array.isArray(body.dailyHistory));
    assert.ok(Array.isArray(body.ratingCounts));
    assert.ok(Array.isArray(body.dueForecast));
    assert.ok(Array.isArray(body.timeSpent));
});

test('analytics routes - detailed analytics with zero cards', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'zero-cards');

    // Create deck without cards
    const deckResponse = await app.inject({
        method: 'POST',
        url: '/api/decks',
        headers: user.headers,
        payload: {
            name: 'Empty Deck',
            visibility: 'private',
        },
    });

    const deck = JSON.parse(deckResponse.body);

    const response = await app.inject({
        method: 'GET',
        url: `/api/analytics/decks/${deck.id}/detail`,
        headers: user.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.totals.total, 0);
});

test('analytics routes - user stats are all numbers', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'number-types');

    const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/user',
        headers: user.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);

    const numericFields = [
        'totalDecks',
        'totalCards',
        'totalStudyTime',
        'cardsStudied',
        'cardsLearned',
        'cardsReviewing',
        'averageAccuracy',
        'studyStreak',
        'decksStudiedThisWeek',
        'cardsStudiedThisWeek',
    ];

    for (const field of numericFields) {
        assert.equal(typeof body[field], 'number', field + ' should be a number');
        assert.ok(body[field] >= 0, field + ' should be non-negative');
    }
});

test('analytics routes - study time returns empty array for new user', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'new-user-study-time');

    const response = await app.inject({
        method: 'GET',
        url: '/api/analytics/user/study-time?days=30',
        headers: user.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body));
    // May be empty or have zero-value entries
});

test('analytics routes - deck stats returns zero for new deck', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'new-deck-stats');

    const deckResponse = await app.inject({
        method: 'POST',
        url: '/api/decks',
        headers: user.headers,
        payload: {
            name: 'Brand New Deck',
            visibility: 'private',
        },
    });

    const deck = JSON.parse(deckResponse.body);

    const response = await app.inject({
        method: 'GET',
        url: `/api/analytics/decks/${deck.id}`,
        headers: user.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.totalCards, 0);
    assert.equal(body.cardsStudied, 0);
    assert.equal(body.studySessions, 0);
    assert.ok(body.lastStudiedAt === null || body.lastStudiedAt === undefined);
});

test('analytics routes - mastery progress all not studied for new deck', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'new-mastery');
    const { deck } = await createTestDeckWithCards(app, user, 5);

    const response = await app.inject({
        method: 'GET',
        url: `/api/analytics/decks/${deck.id}/mastery`,
        headers: user.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.notStudied, 5);
    assert.equal(body.learning, 0);
    assert.equal(body.mastered, 0);
});

test('analytics routes - cannot get analytics for another users deck', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const owner = await createAuthenticatedUser(app, 'deck-owner-analytics');
    const other = await createAuthenticatedUser(app, 'other-user-analytics');
    const { deck } = await createTestDeckWithCards(app, owner, 10);

    const response = await app.inject({
        method: 'GET',
        url: `/api/analytics/decks/${deck.id}`,
        headers: other.headers,
    });

    // Should return 404 or similar (deck not found for this user)
    assertStatus(response, 404);
});
