import { sql } from 'drizzle-orm';

/**
 * Database helper functions for test setup and teardown.
 */

/**
 * Checks if the database is available for testing.
 *
 * @returns true if database is available, false otherwise
 */
export async function isDatabaseAvailable(): Promise<boolean> {
    try {
        const dbModule = await import('../../db/db.ts');
        const db = dbModule.db;
        await db.execute(sql`select 1`);
        return true;
    } catch {
        return false;
    }
}

/**
 * Truncates all test data in the database.
 * Use with caution - this deletes ALL data.
 *
 * @returns void
 */
export async function truncateAllTables(): Promise<void> {
    const dbModule = await import('../../db/db.ts');
    const db = dbModule.db;

    // Delete in order of dependencies
    const tables = [
        'study_events',
        'card_learning_state',
        'review_helpful_votes',
        'reviews',
        'ratings',
        'cards',
        'follows',
        'nominations',
        'decks',
        'upload',
        'sync_change_log',
        'user',
    ];

    for (const table of tables) {
        try {
            await db.execute(sql`DELETE FROM ${sql.identifier(table)}`);
        } catch {
            // Table might not exist, continue
        }
    }
}

/**
 * Counts rows in a table.
 *
 * @param tableName - Name of the table
 * @returns Number of rows
 */
export async function countRows(tableName: string): Promise<number> {
    const dbModule = await import('../../db/db.ts');
    const db = dbModule.db;

    const result = await db.execute(sql`SELECT COUNT(*) as count FROM ${sql.identifier(tableName)}`);
    const rows = result.rows as Array<{ count: bigint | string | number }>;
    const count = rows[0]?.count;
    return typeof count === 'bigint' ? Number(count) : Number(count);
}

/**
 * Deletes a user and all their associated data.
 *
 * @param userId - User ID to delete
 * @returns void
 */
export async function deleteUserWithCascade(userId: string): Promise<void> {
    const dbModule = await import('../../db/db.ts');
    const db = dbModule.db;

    await db.execute(sql`DELETE FROM study_events WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM card_learning_state WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM cards WHERE deck_id IN (SELECT id FROM decks WHERE user_id = ${userId})`);
    await db.execute(sql`DELETE FROM decks WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM upload WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM nominations WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM reviews WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM ratings WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM follows WHERE follower_id = ${userId} OR following_id = ${userId}`);
    await db.execute(sql`DELETE FROM user WHERE id = ${userId}`);
}

/**
 * Deletes a deck and all its cards.
 *
 * @param deckId - Deck ID to delete
 * @returns void
 */
export async function deleteDeckWithCards(deckId: string): Promise<void> {
    const dbModule = await import('../../db/db.ts');
    const db = dbModule.db;

    await db.execute(sql`DELETE FROM card_learning_state WHERE card_id IN (SELECT id FROM cards WHERE deck_id = ${deckId})`);
    await db.execute(sql`DELETE FROM cards WHERE deck_id = ${deckId}`);
    await db.execute(sql`DELETE FROM decks WHERE id = ${deckId}`);
}

/**
 * Gets a deck by ID directly from the database.
 *
 * @param deckId - Deck ID
 * @returns Deck object or null
 */
export async function getDeckById(deckId: string): Promise<unknown | null> {
    const dbModule = await import('../../db/db.ts');
    const db = dbModule.db;

    const result = await db.execute(sql`SELECT * FROM decks WHERE id = ${deckId}`);

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

/**
 * Gets cards for a deck directly from the database.
 *
 * @param deckId - Deck ID
 * @returns Array of cards
 */
export async function getCardsByDeckId(deckId: string): Promise<unknown[]> {
    const dbModule = await import('../../db/db.ts');
    const db = dbModule.db;

    const result = await db.execute(sql`SELECT * FROM cards WHERE deck_id = ${deckId} ORDER BY created_at`);

    return result.rows;
}

/**
 * Gets a user by ID directly from the database.
 *
 * @param userId - User ID
 * @returns User object or null
 */
export async function getUserById(userId: string): Promise<unknown | null> {
    const dbModule = await import('../../db/db.ts');
    const db = dbModule.db;

    const result = await db.execute(sql`SELECT * FROM user WHERE id = ${userId}`);

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

/**
 * Checks if a user follows another user.
 *
 * @param followerId - Follower user ID
 * @param followingId - User being followed ID
 * @returns true if following, false otherwise
 */
export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const dbModule = await import('../../db/db.ts');
    const db = dbModule.db;

    const result = await db.execute(sql`
        SELECT 1 FROM follows
        WHERE follower_id = ${followerId}
        AND following_id = ${followingId}
        LIMIT 1
    `);

    return result.rows.length > 0;
}

/**
 * Gets follower count for a user.
 *
 * @param userId - User ID
 * @returns Number of followers
 */
export async function getFollowerCount(userId: string): Promise<number> {
    const dbModule = await import('../../db/db.ts');
    const db = dbModule.db;

    const result = await db.execute(sql`SELECT COUNT(*) as count FROM follows WHERE following_id = ${userId}`);

    const row = result.rows[0] as { count: bigint | string | number };
    return typeof row.count === 'bigint' ? Number(row.count) : Number(row.count);
}

/**
 * Gets following count for a user.
 *
 * @param userId - User ID
 * @returns Number of users being followed
 */
export async function getFollowingCount(userId: string): Promise<number> {
    const dbModule = await import('../../db/db.ts');
    const db = dbModule.db;

    const result = await db.execute(sql`SELECT COUNT(*) as count FROM follows WHERE follower_id = ${userId}`);

    const row = result.rows[0] as { count: bigint | string | number };
    return typeof row.count === 'bigint' ? Number(row.count) : Number(row.count);
}

/**
 * Gets deck count for a user.
 *
 * @param userId - User ID
 * @returns Number of decks
 */
export async function getDeckCount(userId: string): Promise<number> {
    const dbModule = await import('../../db/db.ts');
    const db = dbModule.db;

    const result = await db.execute(sql`SELECT COUNT(*) as count FROM decks WHERE user_id = ${userId}`);

    const row = result.rows[0] as { count: bigint | string | number };
    return typeof row.count === 'bigint' ? Number(row.count) : Number(row.count);
}

/**
 * Gets card count for a deck.
 *
 * @param deckId - Deck ID
 * @returns Number of cards
 */
export async function getCardCount(deckId: string): Promise<number> {
    const dbModule = await import('../../db/db.ts');
    const db = dbModule.db;

    const result = await db.execute(sql`SELECT COUNT(*) as count FROM cards WHERE deck_id = ${deckId}`);

    const row = result.rows[0] as { count: bigint | string | number };
    return typeof row.count === 'bigint' ? Number(row.count) : Number(row.count);
}

/**
 * Runs a cleanup function after a test completes.
 * Use with t.after() in Node.js test.
 *
 * @param cleanupFn - Cleanup function to run
 * @returns Cleanup function that can be passed to t.after
 */
export function createCleanup(cleanupFn: () => Promise<void> | void): () => Promise<void> {
    return async () => {
        try {
            await cleanupFn();
        } catch {
            // Ignore cleanup errors
        }
    };
}

/**
 * Creates a test database schema guard.
 * Returns true if running in test environment.
 *
 * @returns true if NODE_ENV is 'test'
 */
export function isTestEnvironment(): boolean {
    return process.env.NODE_ENV === 'test';
}
