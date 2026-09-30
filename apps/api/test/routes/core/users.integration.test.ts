import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../../helper.ts';
import {
    createAuthenticatedUser,
    createTestUsers,
} from '../../utils/auth-factory.ts';
import {
    createTestDeck,
    createPublicDeck,
} from '../../utils/data-factory.ts';
import {
    assertStatus,
    assertSuccess,
    assertBodyHasKeys,
} from '../../utils/assertions.ts';
import { isDatabaseAvailable } from '../../utils/database-helpers.ts';

test('users routes - get user profile', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'profile-test');

    // Get own profile
    const response = await app.inject({
        method: 'GET',
        url: `/api/users/${user.userId}`,
        headers: user.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.id, user.userId);
    assert.equal(body.name, user.name);
    assertBodyHasKeys(response, ['id', 'name', 'username', 'followerCount', 'deckCount', 'totalDownloads']);
});

test('users routes - get user profile without auth', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'public-profile');

    // Get profile without auth (public endpoint)
    const response = await app.inject({
        method: 'GET',
        url: `/api/users/${user.userId}`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.id, user.userId);
    assert.equal(body.name, user.name);
});

test('users routes - get non-existent user returns 404', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'not-found-test');

    const response = await app.inject({
        method: 'GET',
        url: '/api/users/non-existent-id',
        headers: user.headers,
    });

    assertStatus(response, 404);
});

test('users routes - update own profile', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'update-profile');

    const updateData = {
        bio: 'This is my test bio',
        website: 'https://example.com',
        twitterHandle: '@testuser',
    };

    const response = await app.inject({
        method: 'PATCH',
        url: `/api/users/${user.userId}`,
        headers: user.headers,
        payload: updateData,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.bio, updateData.bio);
    assert.equal(body.website, updateData.website);
    assert.equal(body.twitterHandle, updateData.twitterHandle);
});

test('users routes - update another users profile returns 403', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user1 = await createAuthenticatedUser(app, 'user1');
    const user2 = await createAuthenticatedUser(app, 'user2');

    const response = await app.inject({
        method: 'PATCH',
        url: `/api/users/${user2.userId}`,
        headers: user1.headers,
        payload: { bio: 'Hacking attempt' },
    });

    assertStatus(response, 403);
});

test('users routes - update profile without auth returns 401', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const response = await app.inject({
        method: 'PATCH',
        url: '/api/users/some-id',
        payload: { bio: 'No auth' },
    });

    assertStatus(response, 401);
});

test('users routes - get user public decks', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'user-decks');

    // Create some test decks
    await createTestDeck(app, user, { name: 'Private Deck 1', visibility: 'private' });
    await createPublicDeck(app, user, { name: 'Public Deck 1' });
    await createPublicDeck(app, user, { name: 'Public Deck 2' });

    const response = await app.inject({
        method: 'GET',
        url: `/api/users/${user.userId}/decks`,
        headers: user.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.decks));
    // Only public decks should be returned
    assert.equal(body.decks.length, 2);
    assert.equal(body.total, 2);
});

test('users routes - get user decks with pagination', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'pagination-user');

    // Create multiple public decks
    for (let i = 0; i < 5; i++) {
        await createPublicDeck(app, user, { name: `Deck ${i}` });
    }

    // Test limit
    const response = await app.inject({
        method: 'GET',
        url: `/api/users/${user.userId}/decks?limit=2`,
        headers: user.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.decks.length, 2);
    assert.equal(body.total, 5);
});

test('users routes - follow user', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const follower = await createAuthenticatedUser(app, 'follower');
    const following = await createAuthenticatedUser(app, 'following');

    const response = await app.inject({
        method: 'POST',
        url: `/api/users/${following.userId}/follow`,
        headers: follower.headers,
    });

    assertSuccess(response);
    // Response should be empty object
    assert.deepEqual(JSON.parse(response.body), {});
});

test('users routes - follow requires authentication', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'auth-test');

    const response = await app.inject({
        method: 'POST',
        url: `/api/users/${user.userId}/follow`,
    });

    assertStatus(response, 401);
});

test('users routes - unfollow user', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const follower = await createAuthenticatedUser(app, 'unfollower');
    const following = await createAuthenticatedUser(app, 'unfollowing');

    // First follow
    await app.inject({
        method: 'POST',
        url: `/api/users/${following.userId}/follow`,
        headers: follower.headers,
    });

    // Then unfollow
    const response = await app.inject({
        method: 'DELETE',
        url: `/api/users/${following.userId}/follow`,
        headers: follower.headers,
    });

    assertSuccess(response);
    assert.deepEqual(JSON.parse(response.body), {});
});

test('users routes - get user followers', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const targetUser = await createAuthenticatedUser(app, 'target');
    const followers = await createTestUsers(app, 3, 'follower');

    // All followers follow the target user
    for (const follower of followers) {
        await app.inject({
            method: 'POST',
            url: `/api/users/${targetUser.userId}/follow`,
            headers: follower.headers,
        });
    }

    const response = await app.inject({
        method: 'GET',
        url: `/api/users/${targetUser.userId}/followers`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.users));
    assert.equal(body.users.length, 3);
    assert.equal(body.total, 3);
});

test('users routes - get user following', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const follower = await createAuthenticatedUser(app, 'main-follower');
    const targets = await createTestUsers(app, 2, 'target');

    // Follow both targets
    for (const target of targets) {
        await app.inject({
            method: 'POST',
            url: `/api/users/${target.userId}/follow`,
            headers: follower.headers,
        });
    }

    const response = await app.inject({
        method: 'GET',
        url: `/api/users/${follower.userId}/following`,
        headers: follower.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.ok(Array.isArray(body.users));
    assert.equal(body.users.length, 2);
    assert.equal(body.total, 2);
});

test('users routes - followers with pagination', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const targetUser = await createAuthenticatedUser(app, 'paginated-target');
    const followers = await createTestUsers(app, 5, 'follower');

    for (const follower of followers) {
        await app.inject({
            method: 'POST',
            url: `/api/users/${targetUser.userId}/follow`,
            headers: follower.headers,
        });
    }

    const response = await app.inject({
        method: 'GET',
        url: `/api/users/${targetUser.userId}/followers?limit=2&offset=1`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.users.length, 2);
    assert.equal(body.total, 5);
});

test('users routes - check isFollowing in profile when logged in', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const follower = await createAuthenticatedUser(app, 'check-follower');
    const following = await createAuthenticatedUser(app, 'check-following');

    // Follow
    await app.inject({
        method: 'POST',
        url: `/api/users/${following.userId}/follow`,
        headers: follower.headers,
    });

    // Get profile as follower
    const response = await app.inject({
        method: 'GET',
        url: `/api/users/${following.userId}`,
        headers: follower.headers,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.isFollowing, true);
});

test('users routes - profile includes followerCount and deckCount', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    const user = await createAuthenticatedUser(app, 'counts-test');

    // Add some followers
    const followers = await createTestUsers(app, 3, 'counter');
    for (const follower of followers) {
        await app.inject({
            method: 'POST',
            url: `/api/users/${user.userId}/follow`,
            headers: follower.headers,
        });
    }

    // Create some decks
    await createPublicDeck(app, user);
    await createPublicDeck(app, user);

    const response = await app.inject({
        method: 'GET',
        url: `/api/users/${user.userId}`,
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.followerCount, 3);
    assert.equal(body.deckCount, 2);
});
