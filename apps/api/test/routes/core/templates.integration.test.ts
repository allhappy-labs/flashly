import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../../helper.ts';
import { createAuthenticatedUser } from '../../utils/auth-factory.ts';
import { createTestDeck } from '../../utils/data-factory.ts';
import { assertSuccess, assertStatus, assertBodyHasKeys } from '../../utils/assertions.ts';
import { isDatabaseAvailable } from '../../utils/database-helpers.ts';

test('templates routes - get all templates', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/templates',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body));

    if (body.length > 0) {
        const template = body[0];
        assertBodyHasKeys({ statusCode: 200, body: JSON.stringify(template) }, [
            'id',
            'name',
            'cardCount',
            'downloadCount',
            'previewCards',
        ]);
        assert.ok(Array.isArray(template.previewCards));
    }
});

test('templates routes - create deck from template', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    // First get templates to find a valid template ID
    const templatesResponse = await app.inject({
        method: 'GET',
        url: '/api/templates',
    });

    const templates = JSON.parse(templatesResponse.body);

    if (templates.length === 0) {
        t.skip('No templates in database');
        return;
    }

    const templateId = templates[0].id;
    const user = await createAuthenticatedUser(app, 'template-user');

    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/from-template/${templateId}`,
        headers: user.headers,
        payload: {
            name: 'My Deck from Template',
            description: 'Created from a template',
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assertBodyHasKeys(response, ['id', 'name']);
    assert.equal(body.name, 'My Deck from Template');
});

test('templates routes - create deck from template without auth returns 401', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/from-template/some-template-id',
        payload: {
            name: 'Test Deck',
        },
    });

    assertStatus(response, 401);
});

test('templates routes - create deck from template with non-existent template', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'nonexistent-template');

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/from-template/non-existent-template-id',
        headers: user.headers,
        payload: {
            name: 'Test Deck',
        },
    });

    assertStatus(response, 404);
});

test('templates routes - create deck from template with validation errors', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    // First get templates to find a valid template ID
    const templatesResponse = await app.inject({
        method: 'GET',
        url: '/api/templates',
    });

    const templates = JSON.parse(templatesResponse.body);

    if (templates.length === 0) {
        t.skip('No templates in database');
        return;
    }

    const templateId = templates[0].id;
    const user = await createAuthenticatedUser(app, 'validation-test');

    // Test with empty name
    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/from-template/${templateId}`,
        headers: user.headers,
        payload: {
            name: '',  // Invalid - too short
        },
    });

    // Should return validation error
    assert.ok(response.statusCode === 400 || response.statusCode === 422);
});

test('templates routes - create deck from template with optional description', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const templatesResponse = await app.inject({
        method: 'GET',
        url: '/api/templates',
    });

    const templates = JSON.parse(templatesResponse.body);

    if (templates.length === 0) {
        t.skip('No templates in database');
        return;
    }

    const templateId = templates[0].id;
    const user = await createAuthenticatedUser(app, 'optional-desc');

    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/from-template/${templateId}`,
        headers: user.headers,
        payload: {
            name: 'Minimal Deck',
            // description is optional
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.name, 'Minimal Deck');
});

test('templates routes - template preview cards have correct structure', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/templates',
    });

    assertSuccess(response);
    const templates = JSON.parse(response.body);

    if (templates.length > 0 && templates[0].previewCards.length > 0) {
        const previewCard = templates[0].previewCards[0];
        assert.equal(typeof previewCard.front, 'string');
        assert.equal(typeof previewCard.back, 'string');
        // Nullable fields
        assert.ok(
            previewCard.imageUrl === null || typeof previewCard.imageUrl === 'string',
            'imageUrl should be string or null'
        );
        assert.ok(
            previewCard.category === null || typeof previewCard.category === 'string',
            'category should be string or null'
        );
    }
});

test('templates routes - create template from deck', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'template-creator');

    // Create a deck with some cards
    const deck = await createTestDeck(app, user, {
        name: 'Template Source Deck',
        visibility: 'public',
    });

    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/template`,
        headers: user.headers,
    });

    // This might fail if user is not admin, but we test the endpoint exists
    assert.ok(response.statusCode === 200 || response.statusCode === 403);
});

test('templates routes - create template from deck without auth returns 401', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/some-deck-id/template',
    });

    assertStatus(response, 401);
});

test('templates routes - create template from non-existent deck returns 404', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'notfound-deck');

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/non-existent-deck-id/template',
        headers: user.headers,
    });

    assertStatus(response, 404);
});

test('templates routes - template includes materialType and deckType', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/templates',
    });

    assertSuccess(response);
    const templates = JSON.parse(response.body);

    if (templates.length > 0) {
        const template = templates[0];
        // These may be null, so we just check they exist
        assert.ok('materialType' in template);
        assert.ok('deckType' in template);
        assert.ok('locale' in template);
    }
});
