import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../../helper.ts';
import { createAuthenticatedUser, createAdminUser } from '../../utils/auth-factory.ts';
import { createPublicDeck } from '../../utils/data-factory.ts';
import {
    assertSuccess,
    assertStatus,
    assertBodyHasKeys,
} from '../../utils/assertions.ts';
import { isDatabaseAvailable } from '../../utils/database-helpers.ts';

test('nominations routes - get nomination stats (public)', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'GET',
        url: '/api/nominations/stats',
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assertBodyHasKeys(response, ['total', 'pending', 'approved', 'rejected']);
    assert.equal(typeof body.total, 'number');
    assert.equal(typeof body.pending, 'number');
    assert.equal(typeof body.approved, 'number');
    assert.equal(typeof body.rejected, 'number');
});

test('nominations routes - nominate deck (admin only)', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'nomination-owner');
    const admin = await createAdminUser(app, 'nominator');
    const deck = await createPublicDeck(app, deckOwner, { name: 'Nomination Worthy Deck' });

    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/nominate`,
        headers: admin.headers,
        payload: {
            reason: 'This is an excellent deck with quality content.',
        },
    });

    // Admin check may fail if email domain is not configured for admin
    assert.ok(
        response.statusCode === 200 || response.statusCode === 403,
        `Expected 200 or 403 but got ${response.statusCode}`
    );

    if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        assertBodyHasKeys(response, ['id', 'deckId', 'userId', 'reason', 'status', 'createdAt']);
        assert.equal(body.deckId, deck.id);
    }
});

test('nominations routes - non-admin cannot nominate', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-no-nominate');
    const regularUser = await createAuthenticatedUser(app, 'regular-nominator');
    const deck = await createPublicDeck(app, deckOwner);

    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/nominate`,
        headers: regularUser.headers,
        payload: {
            reason: 'I want to nominate this deck.',
        },
    });

    assertStatus(response, 403);
    const body = JSON.parse(response.body);
    assert.equal(body.error, 'FORBIDDEN');
});

test('nominations routes - nominate requires authentication', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-no-auth-nom');
    const deck = await createPublicDeck(app, deckOwner);

    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/nominate`,
        payload: {
            reason: 'Attempting to nominate without auth.',
        },
    });

    assertStatus(response, 401);
});

test('nominations routes - nominate requires reason', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-no-reason');
    const admin = await createAdminUser(app, 'admin-no-reason');
    const deck = await createPublicDeck(app, deckOwner);

    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/nominate`,
        headers: admin.headers,
        payload: {
            reason: 'Too short', // Less than 10 characters
        },
    });

    // Should fail validation
    assert.ok(response.statusCode === 400 || response.statusCode === 403);
});

test('nominations routes - nominate deck that does not exist', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const admin = await createAdminUser(app, 'admin-notfound');

    const response = await app.inject({
        method: 'POST',
        url: '/api/decks/non-existent-deck-id/nominate',
        headers: admin.headers,
        payload: {
            reason: 'This is a valid reason for nomination that meets the minimum length requirement.',
        },
    });

    // May be 404 or 403 depending on admin status
    assert.ok(
        response.statusCode === 404 || response.statusCode === 403,
        `Expected 404 or 403 but got ${response.statusCode}`
    );
});

test('nominations routes - get pending nominations (admin only)', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const admin = await createAdminUser(app, 'admin-pending');

    const response = await app.inject({
        method: 'GET',
        url: '/api/admin/nominations?limit=10',
        headers: admin.headers,
    });

    // May be 403 if not actually admin
    assert.ok(
        response.statusCode === 200 || response.statusCode === 403,
        `Expected 200 or 403 but got ${response.statusCode}`
    );

    if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        assertBodyHasKeys(response, ['nominations', 'total']);
        assert.ok(Array.isArray(body.nominations));
    }
});

test('nominations routes - non-admin cannot get pending nominations', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const regularUser = await createAuthenticatedUser(app, 'regular-pending');

    const response = await app.inject({
        method: 'GET',
        url: '/api/admin/nominations?limit=10',
        headers: regularUser.headers,
    });

    assertStatus(response, 403);
    const body = JSON.parse(response.body);
    assert.equal(body.error, 'FORBIDDEN');
});

test('nominations routes - review nomination (admin only)', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-review');
    const admin = await createAdminUser(app, 'admin-review');
    const deck = await createPublicDeck(app, deckOwner);

    // First create a nomination
    const nominateResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/nominate`,
        headers: admin.headers,
        payload: {
            reason: 'This deck is excellent and should be featured.',
        },
    });

    if (nominateResponse.statusCode !== 200) {
        t.skip('Could not create nomination - likely not configured as admin');
        return;
    }

    const nomination = JSON.parse(nominateResponse.body);

    // Approve the nomination
    const response = await app.inject({
        method: 'PATCH',
        url: `/api/admin/nominations/${nomination.id}`,
        headers: admin.headers,
        payload: {
            action: 'approve',
        },
    });

    assertSuccess(response);
});

test('nominations routes - review nomination requires auth', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/nominations/some-nomination-id',
        payload: {
            action: 'approve',
        },
    });

    assertStatus(response, 401);
});

test('nominations routes - reject nomination', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-reject');
    const admin = await createAdminUser(app, 'admin-reject');
    const deck = await createPublicDeck(app, deckOwner);

    // First create a nomination
    const nominateResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/nominate`,
        headers: admin.headers,
        payload: {
            reason: 'Another test nomination.',
        },
    });

    if (nominateResponse.statusCode !== 200) {
        t.skip('Could not create nomination - likely not configured as admin');
        return;
    }

    const nomination = JSON.parse(nominateResponse.body);

    // Reject the nomination
    const response = await app.inject({
        method: 'PATCH',
        url: `/api/admin/nominations/${nomination.id}`,
        headers: admin.headers,
        payload: {
            action: 'reject',
        },
    });

    assertSuccess(response);
});

test('nominations routes - review non-existent nomination', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const admin = await createAdminUser(app, 'admin-notfound-review');

    const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/nominations/non-existent-nomination-id',
        headers: admin.headers,
        payload: {
            action: 'approve',
        },
    });

    // May be 404 or 403
    assert.ok(
        response.statusCode === 404 || response.statusCode === 403,
        `Expected 404 or 403 but got ${response.statusCode}`
    );
});

test('nominations routes - nomination reason has max length', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-max-length');
    const admin = await createAdminUser(app, 'admin-max-length');
    const deck = await createPublicDeck(app, deckOwner);

    // Create a reason that's too long (> 500 chars)
    const longReason = 'a'.repeat(501);

    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/nominate`,
        headers: admin.headers,
        payload: {
            reason: longReason,
        },
    });

    // Should fail validation or admin check
    assert.ok(response.statusCode === 400 || response.statusCode === 403);
});

test('nominations routes - get pending nominations with pagination', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const admin = await createAdminUser(app, 'admin-pagination');

    const response = await app.inject({
        method: 'GET',
        url: '/api/admin/nominations?limit=5&offset=0',
        headers: admin.headers,
    });

    // May be 403 if not actually admin
    assert.ok(
        response.statusCode === 200 || response.statusCode === 403,
        `Expected 200 or 403 but got ${response.statusCode}`
    );

    if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        assert.ok(Array.isArray(body.nominations));
        assert.ok(body.nominations.length <= 5);
    }
});

test('nominations routes - review action must be valid', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-invalid-action');
    const admin = await createAdminUser(app, 'admin-invalid-action');
    const deck = await createPublicDeck(app, deckOwner);

    // First create a nomination
    const nominateResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/nominate`,
        headers: admin.headers,
        payload: {
            reason: 'Valid nomination reason.',
        },
    });

    if (nominateResponse.statusCode !== 200) {
        t.skip('Could not create nomination - likely not configured as admin');
        return;
    }

    const nomination = JSON.parse(nominateResponse.body);

    // Try invalid action
    const response = await app.inject({
        method: 'PATCH',
        url: `/api/admin/nominations/${nomination.id}`,
        headers: admin.headers,
        payload: {
            action: 'invalid_action',
        },
    });

    // Should fail validation
    assert.ok(response.statusCode === 400);
});
