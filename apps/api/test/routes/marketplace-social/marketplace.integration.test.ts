import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../../helper.ts';
import { createAuthenticatedUser } from '../../utils/auth-factory.ts';
import {
    createPublicDeck,
    createTestDeck,
    createTestDeckWithCards
} from '../../utils/data-factory.ts';
import {
    assertPaginatedResponse,
    assertSuccess,
    assertStatus,
    assertBodyHasKeys,
} from '../../utils/assertions.ts';
import { isDatabaseAvailable } from '../../utils/database-helpers.ts';

test('marketplace routes - list public decks', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'marketplace-list');

    // Create some public decks
    await createPublicDeck(app, user, { name: 'Public Deck 1' });
    await createPublicDeck(app, user, { name: 'Public Deck 2' });

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace?page=1&limit=10',
    });

    assertSuccess(response);
    assertPaginatedResponse(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.items));
    assert.ok(body.total >= 2);
});

test('marketplace routes - list marketplace decks with filters', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'filter-test');

    // Create deck with specific material type
    await createPublicDeck(app, user, {
        name: 'Language Deck',
        materialType: 'language',
    });

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace?materialType=language&page=1&limit=10',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.items));
});

test('marketplace routes - search functionality', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'search-test');

    await createPublicDeck(app, user, { name: 'Japanese Vocabulary' });

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace?search=japanese&page=1&limit=10',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.items));
});

test('marketplace routes - sort by most downloaded', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace?sortBy=most_downloaded&page=1&limit=10',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.items));
});

test('marketplace routes - sort by newest', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace?sortBy=newest&page=1&limit=10',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.items));
});

test('marketplace routes - get featured decks', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace/featured?limit=10',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body));
});

test('marketplace routes - get marketplace deck details', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'details-test');
    const { deck } = await createTestDeckWithCards(app, user, 3, {
        visibility: 'public',
        name: 'Detailed Deck',
    });

    const response = await app.inject({
        method: 'GET',
        url: `/api/marketplace/${deck.id}`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.id, deck.id);
    assert.equal(body.name, 'Detailed Deck');
    assert.ok(Array.isArray(body.cards));
    assert.equal(body.cards.length, 3);
});

test('marketplace routes - private deck returns 403', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'private-deck');
    const deck = await createTestDeck(app, user, {
        name: 'Private Deck',
        visibility: 'private',
    });

    const response = await app.inject({
        method: 'GET',
        url: `/api/marketplace/${deck.id}`,
    });

    assertStatus(response, 403);
});

test('marketplace routes - clone a public deck', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const owner = await createAuthenticatedUser(app, 'owner');
    const cloner = await createAuthenticatedUser(app, 'cloner');

    const { deck } = await createTestDeckWithCards(app, owner, 3, {
        visibility: 'public',
        name: 'Cloneable Deck',
    });

    const response = await app.inject({
        method: 'POST',
        url: `/api/marketplace/${deck.id}/clone`,
        headers: cloner.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assertBodyHasKeys(response, ['id', 'name', 'userId']);
    assert.equal(body.userId, cloner.userId);
    assert.equal(body.visibility, 'private');
    assert.notEqual(body.id, deck.id);
    assert.ok(Array.isArray(body.cards));
    assert.equal(body.cards.length, 3);
});

test('marketplace routes - clone without auth returns 401', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'POST',
        url: '/api/marketplace/some-deck-id/clone',
    });

    assertStatus(response, 401);
});

test('marketplace routes - clone same deck twice returns same deck', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const owner = await createAuthenticatedUser(app, 'twice-owner');
    const cloner = await createAuthenticatedUser(app, 'twice-cloner');

    const { deck } = await createTestDeckWithCards(app, owner, 2, {
        visibility: 'public',
    });

    const firstClone = await app.inject({
        method: 'POST',
        url: `/api/marketplace/${deck.id}/clone`,
        headers: cloner.headers,
    });

    assertSuccess(firstClone);
    const firstCloneBody = JSON.parse(firstClone.body);

    const secondClone = await app.inject({
        method: 'POST',
        url: `/api/marketplace/${deck.id}/clone`,
        headers: cloner.headers,
    });

    assertSuccess(secondClone);
    const secondCloneBody = JSON.parse(secondClone.body);
    assert.equal(secondCloneBody.id, firstCloneBody.id);
});

test('marketplace routes - clone non-existent deck returns 404', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'notfound-clone');

    const response = await app.inject({
        method: 'POST',
        url: '/api/marketplace/non-existent-id/clone',
        headers: user.headers,
    });

    assertStatus(response, 404);
});

test('marketplace routes - deck includes author information', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'author-test');
    const { deck } = await createTestDeckWithCards(app, user, 2, {
        visibility: 'public',
    });

    const response = await app.inject({
        method: 'GET',
        url: `/api/marketplace/${deck.id}`,
    });

    assertSuccess(response);
    assertBodyHasKeys(response, ['id', 'name']);
});

test('marketplace routes - deck shows as added for owner', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const owner = await createAuthenticatedUser(app, 'added-owner');
    const { deck } = await createTestDeckWithCards(app, owner, 2, {
        visibility: 'public',
    });

    const response = await app.inject({
        method: 'GET',
        url: `/api/marketplace/${deck.id}`,
        headers: owner.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    // Owner should see their own deck
    assert.ok(body.id === deck.id);
});

test('marketplace routes - pagination params work correctly', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'pagination-test');

    // Create multiple decks
    for (let i = 0; i < 5; i++) {
        await createPublicDeck(app, user, { name: `Deck ${i}` });
    }

    const page1 = await app.inject({
        method: 'GET',
        url: '/api/marketplace?page=1&limit=2',
    });

    assertSuccess(page1);
    const page1Body = JSON.parse(page1.body);
    assert.equal(page1Body.items.length, 2);
    assert.equal(page1Body.page, 1);
    assert.equal(page1Body.limit, 2);
    assert.equal(page1Body.totalPages, Math.ceil(page1Body.total / 2));

    const page2 = await app.inject({
        method: 'GET',
        url: '/api/marketplace?page=2&limit=2',
    });

    assertSuccess(page2);
    const page2Body = JSON.parse(page2.body);
    assert.equal(page2Body.page, 2);
});

test('marketplace routes - deck response includes cardCount', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'cardcount-test');
    const { deck } = await createTestDeckWithCards(app, user, 7, {
        visibility: 'public',
    });

    const response = await app.inject({
        method: 'GET',
        url: `/api/marketplace/${deck.id}`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.cardCount, 7);
});

test('marketplace routes - filters by deck type', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace?deckType=vocabulary&limit=10',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.items));
});

test('marketplace routes - filters by locale', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace?locale=ja&limit=10',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.items));
});

test('marketplace routes - filters by hasAudio', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/marketplace?hasAudio=true&limit=10',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.items));
});
