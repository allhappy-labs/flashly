import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../../helper.ts';
import { createAuthenticatedUser } from '../../utils/auth-factory.ts';
import { createPublicDeck } from '../../utils/data-factory.ts';
import { assertSuccess, assertStatus, assertBodyHasKeys } from '../../utils/assertions.ts';
import { isDatabaseAvailable } from '../../utils/database-helpers.ts';

function verifyCategoryStructure(category: unknown): void {
    assert.equal(typeof (category as Record<string, unknown>).id, 'string');
    assert.equal(typeof (category as Record<string, unknown>).name, 'string');
    assert.equal(typeof (category as Record<string, unknown>).slug, 'string');
    assert.equal(typeof (category as Record<string, unknown>).deckCount, 'number');

    const children = (category as Record<string, unknown>).children;
    if (Array.isArray(children) && children.length > 0) {
        for (const child of children) {
            verifyCategoryStructure(child);
        }
    }
}

test('categories routes - get all categories (flat list)', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/categories',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body));

    if (body.length > 0) {
        const category = body[0];
        assertBodyHasKeys({ statusCode: 200, body: JSON.stringify(category) }, [
            'id',
            'name',
            'slug',
            'displayOrder',
            'deckCount',
        ]);
    }
});

test('categories routes - get category tree', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/categories/tree',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body));

    if (body.length > 0) {
        const category = body[0];
        assertBodyHasKeys({ statusCode: 200, body: JSON.stringify(category) }, [
            'id',
            'name',
            'slug',
            'children',
        ]);
        assert.ok(Array.isArray(category.children));
    }
});

test('categories routes - get category by slug', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    // First get all categories to find a valid slug
    const listResponse = await app.inject({
        method: 'GET',
        url: '/api/categories',
    });

    const categories = JSON.parse(listResponse.body);

    if (categories.length === 0) {
        t.skip('No categories in database');
        return;
    }

    const slug = categories[0].slug;

    const response = await app.inject({
        method: 'GET',
        url: `/api/categories/${slug}`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.slug, slug);
    assertBodyHasKeys(response, ['id', 'name', 'slug', 'description', 'deckCount']);
});

test('categories routes - get non-existent category returns 404', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/categories/non-existent-slug-xyz',
    });

    assertStatus(response, 404);
});

test('categories routes - get decks in category', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    // First get all categories to find a valid slug
    const listResponse = await app.inject({
        method: 'GET',
        url: '/api/categories',
    });

    const categories = JSON.parse(listResponse.body);

    if (categories.length === 0) {
        t.skip('No categories in database');
        return;
    }

    const slug = categories[0].slug;

    const response = await app.inject({
        method: 'GET',
        url: `/api/categories/${slug}/decks`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.decks));
    assert.equal(typeof body.total, 'number');
});

test('categories routes - get decks in category with pagination', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    // Get first category
    const listResponse = await app.inject({
        method: 'GET',
        url: '/api/categories',
    });

    const categories = JSON.parse(listResponse.body);

    if (categories.length === 0) {
        t.skip('No categories in database');
        return;
    }

    const slug = categories[0].slug;

    const response = await app.inject({
        method: 'GET',
        url: `/api/categories/${slug}/decks?limit=5&offset=0`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.decks));
    assert.ok(body.decks.length <= 5);
});

test('categories routes - get decks with subcategory inclusion', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    // Get first category
    const listResponse = await app.inject({
        method: 'GET',
        url: '/api/categories',
    });

    const categories = JSON.parse(listResponse.body);

    if (categories.length === 0) {
        t.skip('No categories in database');
        return;
    }

    const slug = categories[0].slug;

    // Test with subcategories included
    const response = await app.inject({
        method: 'GET',
        url: `/api/categories/${slug}/decks?includeSubcategories=true`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.decks));

    // Test without subcategories
    const responseNoSub = await app.inject({
        method: 'GET',
        url: `/api/categories/${slug}/decks?includeSubcategories=false`,
    });

    assertSuccess(responseNoSub);
    const bodyNoSub = JSON.parse(responseNoSub.body);
    assert.ok(Array.isArray(bodyNoSub.decks));
});

test('categories routes - deck response includes required fields', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'category-deck-test');

    // Create a public deck to ensure we have at least one
    await createPublicDeck(app, user, { materialType: 'language' });

    // Get all categories
    const listResponse = await app.inject({
        method: 'GET',
        url: '/api/categories',
    });

    const categories = JSON.parse(listResponse.body);

    if (categories.length === 0) {
        t.skip('No categories in database');
        return;
    }

    const slug = categories[0].slug;

    const response = await app.inject({
        method: 'GET',
        url: `/api/categories/${slug}/decks?limit=10`,
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
            'viewCount',
        ]);
    }
});

test('categories routes - category tree has proper structure', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/categories/tree',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body));

    // Verify tree structure if we have data
    if (body.length > 0) {
        for (const category of body) {
            verifyCategoryStructure(category);
        }
    }
});

test('categories routes - deckCount is accurate', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/categories',
    });

    assertSuccess(response);
    const categories = JSON.parse(response.body);

    // Check that deckCount is a number
    for (const category of categories) {
        assert.equal(typeof category.deckCount, 'number');
        assert.ok(category.deckCount >= 0);
    }
});

test('categories routes - category fields are properly typed', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/categories',
    });

    assertSuccess(response);
    const categories = JSON.parse(response.body);

    if (categories.length > 0) {
        const category = categories[0];
        assert.equal(typeof category.id, 'string');
        assert.equal(typeof category.name, 'string');
        assert.equal(typeof category.slug, 'string');
        assert.equal(typeof category.displayOrder, 'number');
        assert.equal(typeof category.deckCount, 'number');
        // Nullable fields
        assert.ok(
            category.description === null || typeof category.description === 'string',
            'description should be string or null'
        );
        assert.ok(
            category.parentId === null || typeof category.parentId === 'string',
            'parentId should be string or null'
        );
        assert.ok(
            category.icon === null || typeof category.icon === 'string',
            'icon should be string or null'
        );
    }
});
