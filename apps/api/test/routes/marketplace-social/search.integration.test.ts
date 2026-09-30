import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../../helper.ts';
import { createAuthenticatedUser } from '../../utils/auth-factory.ts';
import { createPublicDeck } from '../../utils/data-factory.ts';
import {
    assertSuccess,
    assertStatus,
    assertBodyHasKeys,
} from '../../utils/assertions.ts';
import { isDatabaseAvailable } from '../../utils/database-helpers.ts';

test('search routes - search marketplace decks', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'search-owner');
    await createPublicDeck(app, user, { name: 'Japanese Hiragana Practice' });

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace/search?q=japanese&page=1&limit=10',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.decks));
    assertBodyHasKeys(response, ['decks', 'total']);
});

test('search routes - search requires query parameter', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace/search',
    });

    assertStatus(response, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.error, 'VALIDATION_ERROR');
});

test('search routes - search with filters', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace/search?q=test&materialType=language&locale=ja&page=1&limit=10',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.decks));
});

test('search routes - search returns relevant fields', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'search-fields');
    await createPublicDeck(app, user, { name: 'Search Test Deck' });

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace/search?q=search&page=1&limit=10',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);

    if (body.decks.length > 0) {
        const deck = body.decks[0];
        assertBodyHasKeys({ statusCode: 200, body: JSON.stringify(deck) }, [
            'id',
            'name',
            'cardCount',
            'downloadCount',
            'rating',
            'relevance',
        ]);
    }
});

test('search routes - search with pagination', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace/search?q=test&page=1&limit=5',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.decks));
    assert.ok(body.decks.length <= 5);
});

test('search routes - get search suggestions', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/search/suggestions?q=jap&limit=5',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body));
    assert.ok(body.length <= 5);

    if (body.length > 0) {
        const suggestion = body[0];
        assertBodyHasKeys({ statusCode: 200, body: JSON.stringify(suggestion) }, [
            'id',
            'name',
            'type',
        ]);
        assert.ok(suggestion.type === 'deck' || suggestion.type === 'category');
    }
});

test('search routes - suggestions requires query', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/search/suggestions',
    });

    assertStatus(response, 400);
});

test('search routes - suggestions respects limit', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/search/suggestions?q=test&limit=3',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(body.length <= 3);
});

test('search routes - get similar decks', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'similar-owner');
    const deck = await createPublicDeck(app, user, { name: 'Japanese Vocabulary' });

    const response = await app.inject({
        method: 'GET',
        url: `/api/marketplace/${deck.id}/similar?limit=5`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.decks));

    if (body.decks.length > 0) {
        const similarDeck = body.decks[0];
        assertBodyHasKeys({ statusCode: 200, body: JSON.stringify(similarDeck) }, [
            'id',
            'name',
            'cardCount',
            'rating',
            'downloadCount',
            'matchScore',
        ]);
    }
});

test('search routes - similar decks for non-existent deck returns 404', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace/non-existent-id/similar?limit=5',
    });

    assertStatus(response, 404);
});

test('search routes - similar decks respects limit', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'similar-limit');
    const deck = await createPublicDeck(app, user);

    const response = await app.inject({
        method: 'GET',
        url: `/api/marketplace/${deck.id}/similar?limit=3`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(body.decks.length <= 3);
});

test('search routes - get trending decks', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace/trending?period=week&limit=10',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.decks));
    assert.equal(body.period, 'week');

    if (body.decks.length > 0) {
        const deck = body.decks[0];
        assertBodyHasKeys({ statusCode: 200, body: JSON.stringify(deck) }, [
            'id',
            'name',
            'cardCount',
            'rating',
            'downloadCount',
            'viewCount',
        ]);
    }
});

test('search routes - trending with different periods', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const periods = ['day', 'week', 'month', 'all'] as const;

    for (const period of periods) {
        const response = await app.inject({
            method: 'GET',
            url: `/api/marketplace/trending?period=${period}&limit=5`,
        });

        assertSuccess(response);
        const body = JSON.parse(response.body);
        assert.equal(body.period, period);
        assert.ok(Array.isArray(body.decks));
    }
});

test('search routes - track deck view', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'view-tracker');
    const deck = await createPublicDeck(app, user);

    const response = await app.inject({
        method: 'POST',
        url: `/api/marketplace/${deck.id}/view`,
        headers: user.headers,
    });

    // View tracking is best-effort, should always return 200
    assertSuccess(response);
    assert.deepEqual(JSON.parse(response.body), {});
});

test('search routes - track deck view without auth', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'view-no-auth');
    const deck = await createPublicDeck(app, user);

    const response = await app.inject({
        method: 'POST',
        url: `/api/marketplace/${deck.id}/view`,
    });

    // Should still succeed - view tracking is best-effort
    assertSuccess(response);
});

test('search routes - search with empty query returns 400', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace/search?q=',
    });

    assertStatus(response, 400);
});

test('search routes - suggestions with empty query returns 400', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/search/suggestions?q=',
    });

    assertStatus(response, 400);
});

test('search routes - track view for non-existent deck succeeds', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'POST',
        url: '/api/marketplace/non-existent-deck-id/view',
    });

    // View tracking is best-effort, should still succeed
    assertSuccess(response);
});

test('search routes - search results include relevance score', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'relevance-test');
    await createPublicDeck(app, user, { name: 'Unique Test Name 123' });

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace/search?q=unique%20test&page=1&limit=10',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);

    if (body.decks.length > 0) {
        const deck = body.decks[0];
        assert.ok('relevance' in deck);
        assert.equal(typeof deck.relevance, 'number');
    }
});

test('search routes - trending respects limit parameter', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace/trending?period=week&limit=5',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(body.decks.length <= 5);
});
