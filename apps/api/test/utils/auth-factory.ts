import type { FastifyInstance } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { sql } from 'drizzle-orm';

const TEST_PASSWORD = 'FlashlyTestPass!2026';

export interface AuthenticatedUser {
    headers: { authorization: string };
    userId: string;
    email: string;
    name: string;
}

/**
 * Creates an authenticated user for integration tests.
 * Uses nonce-based unique emails to avoid conflicts.
 *
 * @param app - Fastify instance
 * @param label - Label for the user (used in email generation)
 * @param options - Optional user properties
 * @returns Authenticated user with headers and ID
 */
export async function createAuthenticatedUser(
    app: FastifyInstance,
    label: string,
    options: {
        name?: string;
        email?: string;
        password?: string;
    } = {}
): Promise<AuthenticatedUser> {
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const email = options.email || `integration-${label}-${nonce}@example.com`;
    const name = options.name || `Integration ${label}`;
    const password = options.password || TEST_PASSWORD;

    const authHeaders = fromNodeHeaders({});
    const authModule = await import('../../lib/auth/auth.ts');
    const auth = authModule.createAuth(app.log);

    const signUpResult = await auth.api.signUpEmail({
        body: {
            email,
            name,
            password,
        },
        headers: authHeaders,
    });

    // Check if sign up was successful
    if (!signUpResult.user) {
        const error = 'error' in signUpResult ? signUpResult.error : undefined;
        throw new Error(`Failed to sign up user ${email}: ${JSON.stringify(error)}`);
    }

    const signInResult = await auth.api.signInEmail({
        body: {
            email,
            password,
            rememberMe: true,
        },
        headers: authHeaders,
    });

    if (!signInResult?.token || typeof signInResult.user?.id !== 'string') {
        throw new Error(`Failed to authenticate integration test user ${email}`);
    }

    return {
        headers: {
            authorization: `Bearer ${signInResult.token}`,
        },
        userId: signInResult.user.id,
        email,
        name,
    };
}

/**
 * Creates an authenticated admin user for integration tests.
 * Admin status is determined by email domain matching configured admin domains.
 *
 * @param app - Fastify instance
 * @param label - Label for the admin user
 * @returns Authenticated admin user with headers and ID
 */
export async function createAdminUser(
    app: FastifyInstance,
    label: string
): Promise<AuthenticatedUser> {
    // Use admin@flashly.dev or similar domain that matches admin configuration
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const email = `admin-${label}-${nonce}@flashly.dev`;
    const name = `Admin ${label}`;

    return createAuthenticatedUser(app, label, { email, name });
}

/**
 * Cleans up a test user by deleting their account.
 * Note: This is optional - tests may prefer to leave data for inspection.
 *
 * @param app - Fastify instance
 * @param userId - ID of the user to delete
 */
export async function cleanupUser(app: FastifyInstance, userId: string): Promise<void> {
    const dbModule = await import('../../db/db.ts');
    const db = dbModule.db;

    // Delete in order of dependencies - use direct value interpolation
    await db.execute(sql`DELETE FROM study_events WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM card_learning_state WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM cards WHERE deck_id IN (SELECT id FROM decks WHERE user_id = ${userId})`);
    await db.execute(sql`DELETE FROM decks WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM upload WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM nominations WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM reviews WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM ratings WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM follows WHERE follower_id = ${userId} OR following_id = ${userId}`);

    // Delete user account
    await db.execute(sql`DELETE FROM user WHERE id = ${userId}`);
}

/**
 * Creates multiple authenticated users for testing social features.
 *
 * @param app - Fastify instance
 * @param count - Number of users to create
 * @param prefix - Prefix for user labels
 * @returns Array of authenticated users
 */
export async function createTestUsers(
    app: FastifyInstance,
    count: number,
    prefix: string = 'user'
): Promise<AuthenticatedUser[]> {
    const users: AuthenticatedUser[] = [];

    for (let i = 0; i < count; i++) {
        const user = await createAuthenticatedUser(app, `${prefix}-${i}`);
        users.push(user);
    }

    return users;
}

/**
 * Creates authentication headers from a bearer token.
 * Useful when you have a token but need the full headers object.
 *
 * @param token - Bearer token
 * @returns Headers object with authorization
 */
export function createAuthHeaders(token: string): { authorization: string } {
    return {
        authorization: `Bearer ${token}`,
    };
}
