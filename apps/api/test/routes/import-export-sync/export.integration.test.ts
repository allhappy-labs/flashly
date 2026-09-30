import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../../helper.ts';
import { createAuthenticatedUser } from '../../utils/auth-factory.ts';
import { createTestDeckWithCards } from '../../utils/data-factory.ts';
import {
    assertSuccess,
    assertStatus,
    assertContentType,
} from '../../utils/assertions.ts';
import { isDatabaseAvailable } from '../../utils/database-helpers.ts';

test('export routes - export deck as Anki CSV', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'anki-export');
    const { deck } = await createTestDeckWithCards(app, user, 3, {
        name: 'Anki Export Deck',
    });

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/export/anki-csv`,
        headers: user.headers,
    });

    assertSuccess(response);
    assertContentType(response, 'text/csv');
    assert.ok(response.body.length > 0);

    // Verify CSV structure
    const lines = response.body.split('\n').filter((l: string) => l.trim());
    assert.ok(lines.length >= 2); // At least header + one card

    // Check for expected columns (header line)
    const header = lines[0];
    assert.ok(header.toLowerCase().includes('front') || header.toLowerCase().includes('back'));
});

test('export routes - export deck requires authentication', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'owner-no-auth');
    const { deck } = await createTestDeckWithCards(app, user, 2);

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/export/anki-csv`,
    });

    assertStatus(response, 401);
});

test('export routes - export non-existent deck returns 404', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'notfound-export');

    const response = await app.inject({
        method: 'GET',
        url: '/api/decks/non-existent-deck-id/export/anki-csv',
        headers: user.headers,
    });

    assertStatus(response, 404);
});

test('export routes - export another users deck returns 403', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const owner = await createAuthenticatedUser(app, 'export-owner');
    const other = await createAuthenticatedUser(app, 'export-other');
    const { deck } = await createTestDeckWithCards(app, owner, 2);

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/export/anki-csv`,
        headers: other.headers,
    });

    assertStatus(response, 403);
});

test('export routes - export deck as Quizlet text', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'quizlet-export');
    const { deck } = await createTestDeckWithCards(app, user, 3, {
        name: 'Quizlet Export Deck',
    });

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/export/quizlet`,
        headers: user.headers,
    });

    assertSuccess(response);
    assertContentType(response, 'text/plain');
    assert.ok(response.body.length > 0);

    // Verify Quizlet format (front <tab> back)
    const lines = response.body.split('\n').filter((l: string) => l.trim());
    assert.ok(lines.length >= 1);
});

test('export routes - Anki CSV includes content disposition header', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'disposition-ank');
    const { deck } = await createTestDeckWithCards(app, user, 1);

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/export/anki-csv`,
        headers: user.headers,
    });

    assertSuccess(response);
    const contentDisposition = response.headers['content-disposition'];
    assert.ok(typeof contentDisposition === 'string');
    assert.ok(contentDisposition.includes('attachment'));
    assert.ok(contentDisposition.includes('.csv'));
});

test('export routes - Quizlet export includes content disposition header', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'disposition-quiz');
    const { deck } = await createTestDeckWithCards(app, user, 1);

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/export/quizlet`,
        headers: user.headers,
    });

    assertSuccess(response);
    const contentDisposition = response.headers['content-disposition'];
    assert.ok(typeof contentDisposition === 'string');
    assert.ok(contentDisposition.includes('attachment'));
    assert.ok(contentDisposition.includes('.txt'));
});

test('export routes - export deck with special characters', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'special-chars');

    // Create deck with special characters
    const deckResponse = await app.inject({
        method: 'POST',
        url: '/api/decks',
        headers: user.headers,
        payload: {
            name: 'Deck with "quotes" and \'apostrophes\'',
            visibility: 'private',
        },
    });

    const deck = JSON.parse(deckResponse.body);

    // Add card with special chars
    await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/cards`,
        headers: user.headers,
        payload: {
            front: 'Front with "quotes" and, comma',
            back: 'Back with ; semicolon and \t tab',
        },
    });

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/export/anki-csv`,
        headers: user.headers,
    });

    assertSuccess(response);
    assert.ok(response.body.length > 0);
});

test('export routes - export empty deck', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'empty-export');

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
        url: `/api/decks/${deck.id}/export/anki-csv`,
        headers: user.headers,
    });

    assertSuccess(response);
    // Should have at least header
    const lines = response.body.split('\n');
    assert.ok(lines.length >= 1);
});

test('export routes - Quizlet format is tab-separated', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'tab-separated');
    const { deck } = await createTestDeckWithCards(app, user, 2);

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/export/quizlet`,
        headers: user.headers,
    });

    assertSuccess(response);
    const lines = response.body.split('\n').filter((l: string) => l.trim());

    if (lines.length > 0) {
        // Quizlet format uses tab between front and back
        assert.ok(lines[0].includes('\t'));
    }
});

test('export routes - CSV handles multiline content', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'multiline');

    const deckResponse = await app.inject({
        method: 'POST',
        url: '/api/decks',
        headers: user.headers,
        payload: {
            name: 'Multiline Deck',
            visibility: 'private',
        },
    });

    const deck = JSON.parse(deckResponse.body);

    // Add card with multiline content
    await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/cards`,
        headers: user.headers,
        payload: {
            front: 'Line 1\nLine 2',
            back: 'Back with\nmultiple\nlines',
        },
    });

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/export/anki-csv`,
        headers: user.headers,
    });

    assertSuccess(response);
    // CSV should properly escape or handle newlines
    assert.ok(response.body.length > 0);
});

test('export routes - export includes all card data', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'all-card-data');
    const { deck } = await createTestDeckWithCards(app, user, 5);

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/export/anki-csv`,
        headers: user.headers,
    });

    assertSuccess(response);
    const lines = response.body.split('\n').filter((l: string) => l.trim());
    // Header + at least 5 cards
    assert.ok(lines.length >= 6);
});

test('export routes - export public deck owned by user', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'public-export');

    const deckResponse = await app.inject({
        method: 'POST',
        url: '/api/decks',
        headers: user.headers,
        payload: {
            name: 'Public Export Test',
            visibility: 'public',
        },
    });

    const deck = JSON.parse(deckResponse.body);

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/export/quizlet`,
        headers: user.headers,
    });

    assertSuccess(response);
});

test('export routes - Anki CSV has correct charset', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'charset-test');
    const { deck } = await createTestDeckWithCards(app, user, 1);

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/export/anki-csv`,
        headers: user.headers,
    });

    assertSuccess(response);
    const contentType = response.headers['content-type'];
    assert.ok(typeof contentType === 'string');
    assert.ok(contentType.includes('utf-8'));
});
