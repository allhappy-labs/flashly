import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../../helper.ts';
import { createAuthenticatedUser, createTestUsers } from '../../utils/auth-factory.ts';
import { createPublicDeck, createTestRating, createTestReview } from '../../utils/data-factory.ts';
import {
    assertSuccess,
    assertStatus,
    assertBodyHasKeys,
} from '../../utils/assertions.ts';
import { isDatabaseAvailable } from '../../utils/database-helpers.ts';

test('ratings routes - get deck rating stats', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'rating-stats');
    const deck = await createPublicDeck(app, user, { name: 'Rateable Deck' });

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/ratings`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assertBodyHasKeys(response, ['averageRating', 'totalRatings', 'distribution']);
    assert.equal(typeof body.averageRating, 'number');
    assert.equal(typeof body.totalRatings, 'number');
    assert.ok(typeof body.distribution === 'object');
});

test('ratings routes - get user rating for deck', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'deck-owner');
    const rater = await createAuthenticatedUser(app, 'rater');
    const deck = await createPublicDeck(app, deckOwner);

    // Create a rating
    await createTestRating(app, rater, deck.id, 4);

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/ratings/user`,
        headers: rater.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.deckId, deck.id);
    assert.equal(body.userId, rater.userId);
    assert.equal(body.rating, 4);
});

test('ratings routes - get user rating when not rated returns 404', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-not-rated');
    const user = await createAuthenticatedUser(app, 'not-rated');
    const deck = await createPublicDeck(app, deckOwner);

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/ratings/user`,
        headers: user.headers,
    });

    assertStatus(response, 404);
});

test('ratings routes - create rating', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-create');
    const rater = await createAuthenticatedUser(app, 'create-rater');
    const deck = await createPublicDeck(app, deckOwner);

    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/ratings`,
        headers: rater.headers,
        payload: { rating: 5 },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.deckId, deck.id);
    assert.equal(body.userId, rater.userId);
    assert.equal(body.rating, 5);
});

test('ratings routes - create rating without auth returns 401', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-noauth');
    const deck = await createPublicDeck(app, deckOwner);

    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/ratings`,
        payload: { rating: 4 },
    });

    assertStatus(response, 401);
});

test('ratings routes - update existing rating', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-update');
    const rater = await createAuthenticatedUser(app, 'update-rater');
    const deck = await createPublicDeck(app, deckOwner);

    // Create initial rating
    await createTestRating(app, rater, deck.id, 3);

    // Update rating
    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/ratings`,
        headers: rater.headers,
        payload: { rating: 5 },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.rating, 5);
});

test('ratings routes - delete rating', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-delete');
    const rater = await createAuthenticatedUser(app, 'delete-rater');
    const deck = await createPublicDeck(app, deckOwner);

    // Create a rating first
    await createTestRating(app, rater, deck.id, 4);

    // Delete the rating
    const response = await app.inject({
        method: 'DELETE',
        url: `/api/decks/${deck.id}/ratings`,
        headers: rater.headers,
    });

    assertStatus(response, 204);
});

test('ratings routes - delete rating without auth returns 401', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-delete-noauth');
    const deck = await createPublicDeck(app, deckOwner);

    const response = await app.inject({
        method: 'DELETE',
        url: `/api/decks/${deck.id}/ratings`,
    });

    assertStatus(response, 401);
});

test('ratings routes - rating values are 1-5', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-values');
    const rater = await createAuthenticatedUser(app, 'value-rater');
    const deck = await createPublicDeck(app, deckOwner);

    for (const rating of [1, 2, 3, 4, 5]) {
        const response = await app.inject({
            method: 'POST',
            url: `/api/decks/${deck.id}/ratings`,
            headers: rater.headers,
            payload: { rating },
        });

        assertSuccess(response);
        const body = JSON.parse(response.body);
        assert.equal(body.rating, rating);
    }
});

test('ratings routes - get deck reviews', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-reviews');
    const reviewers = await createTestUsers(app, 3, 'reviewer');
    const deck = await createPublicDeck(app, deckOwner);

    // Create some reviews
    for (let i = 0; i < 3; i++) {
        await createTestReview(app, reviewers[i], deck.id, {
            rating: 5 - i,
            title: `Review ${i + 1}`,
            content: `This is review ${i + 1}`,
        });
    }

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/reviews?page=1&limit=10`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.reviews));
    assert.equal(body.reviews.length, 3);
    assert.equal(body.total, 3);
    assertBodyHasKeys(response, ['reviews', 'total', 'page', 'limit', 'totalPages']);
});

test('ratings routes - create review', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-create-review');
    const reviewer = await createAuthenticatedUser(app, 'reviewer-create');
    const deck = await createPublicDeck(app, deckOwner);

    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/reviews`,
        headers: reviewer.headers,
        payload: {
            rating: 5,
            title: 'Excellent deck!',
            content: 'This deck really helped me learn.',
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.deckId, deck.id);
    assert.equal(body.userId, reviewer.userId);
    assert.equal(body.rating, 5);
    assert.equal(body.title, 'Excellent deck!');
    assert.equal(body.content, 'This deck really helped me learn.');
});

test('ratings routes - create review without title', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-no-title');
    const reviewer = await createAuthenticatedUser(app, 'reviewer-no-title');
    const deck = await createPublicDeck(app, deckOwner);

    const response = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/reviews`,
        headers: reviewer.headers,
        payload: {
            rating: 4,
            content: 'Good deck without title',
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.rating, 4);
    assert.equal(body.content, 'Good deck without title');
});

test('ratings routes - update review', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-update-review');
    const reviewer = await createAuthenticatedUser(app, 'reviewer-update');
    const deck = await createPublicDeck(app, deckOwner);

    // Create review first
    const createResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/reviews`,
        headers: reviewer.headers,
        payload: {
            rating: 3,
            title: 'Original title',
            content: 'Original content',
        },
    });

    const createdReview = JSON.parse(createResponse.body);

    // Update review
    const response = await app.inject({
        method: 'PATCH',
        url: `/api/reviews/${createdReview.id}`,
        headers: reviewer.headers,
        payload: {
            rating: 5,
            title: 'Updated title',
            content: 'Updated content',
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.rating, 5);
    assert.equal(body.title, 'Updated title');
    assert.equal(body.content, 'Updated content');
});

test('ratings routes - update review of another user returns 403', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-forbidden');
    const reviewer1 = await createAuthenticatedUser(app, 'reviewer1');
    const reviewer2 = await createAuthenticatedUser(app, 'reviewer2');
    const deck = await createPublicDeck(app, deckOwner);

    // Create review with reviewer1
    const createResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/reviews`,
        headers: reviewer1.headers,
        payload: {
            rating: 4,
            content: 'My review',
        },
    });

    const createdReview = JSON.parse(createResponse.body);

    // Try to update with reviewer2
    const response = await app.inject({
        method: 'PATCH',
        url: `/api/reviews/${createdReview.id}`,
        headers: reviewer2.headers,
        payload: {
            content: 'Hacking attempt',
        },
    });

    assertStatus(response, 403);
});

test('ratings routes - delete review', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-delete-review');
    const reviewer = await createAuthenticatedUser(app, 'reviewer-delete');
    const deck = await createPublicDeck(app, deckOwner);

    // Create review first
    const createResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/reviews`,
        headers: reviewer.headers,
        payload: {
            rating: 3,
            content: 'Delete me',
        },
    });

    const createdReview = JSON.parse(createResponse.body);

    // Delete review
    const response = await app.inject({
        method: 'DELETE',
        url: `/api/reviews/${createdReview.id}`,
        headers: reviewer.headers,
    });

    assertStatus(response, 204);
});

test('ratings routes - mark review as helpful', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-helpful');
    const reviewer = await createAuthenticatedUser(app, 'reviewer-helpful');
    const voter = await createAuthenticatedUser(app, 'voter');
    const deck = await createPublicDeck(app, deckOwner);

    // Create review
    const createResponse = await app.inject({
        method: 'POST',
        url: `/api/decks/${deck.id}/reviews`,
        headers: reviewer.headers,
        payload: {
            rating: 5,
            content: 'Very helpful review',
        },
    });

    const createdReview = JSON.parse(createResponse.body);

    // Mark as helpful
    const response = await app.inject({
        method: 'POST',
        url: `/api/reviews/${createdReview.id}/helpful`,
        headers: voter.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.helpfulCount, 1);
});

test('ratings routes - sort reviews by helpful', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-sort');
    const reviewers = await createTestUsers(app, 3, 'sort-reviewer');
    const voters = await createTestUsers(app, 5, 'voter');
    const deck = await createPublicDeck(app, deckOwner);

    // Create reviews
    const reviewIds: string[] = [];
    for (let i = 0; i < 3; i++) {
        const createResponse = await app.inject({
            method: 'POST',
            url: `/api/decks/${deck.id}/reviews`,
            headers: reviewers[i].headers,
            payload: {
                rating: 5,
                content: `Review ${i}`,
            },
        });
        const review = JSON.parse(createResponse.body);
        reviewIds.push(review.id);

        // Add votes to first review
        if (i === 0) {
            for (const voter of voters) {
                await app.inject({
                    method: 'POST',
                    url: `/api/reviews/${review.id}/helpful`,
                    headers: voter.headers,
                });
            }
        }
    }

    // Get reviews sorted by helpful
    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/reviews?sortBy=helpful&page=1&limit=10`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.reviews));
    // First review should have most helpful votes
    assert.equal(body.reviews[0].id, reviewIds[0]);
});

test('ratings routes - rating distribution is accurate', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const deckOwner = await createAuthenticatedUser(app, 'owner-dist');
    const raters = await createTestUsers(app, 15, 'dist-rater');
    const deck = await createPublicDeck(app, deckOwner);

    // Create various ratings
    const ratings = [1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5];
    for (let i = 0; i < raters.length; i++) {
        await createTestRating(app, raters[i], deck.id, ratings[i]);
    }

    const response = await app.inject({
        method: 'GET',
        url: `/api/decks/${deck.id}/ratings`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.totalRatings, 15);
    assert.equal(body.distribution[1], 2);
    assert.equal(body.distribution[2], 3);
    assert.equal(body.distribution[3], 4);
    assert.equal(body.distribution[4], 3);
    assert.equal(body.distribution[5], 3);
});
