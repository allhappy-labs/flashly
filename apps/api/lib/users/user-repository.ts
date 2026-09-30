import { eq, and, desc, count, sql } from 'drizzle-orm';
import type { ResultAsync } from 'neverthrow';
import { errAsync } from 'neverthrow';
import {
    errorFactory,
    NotFoundError,
    safeAsync,
    ValidationError,
    type DatabaseError,
} from '@flashly/shared';
import { db } from '../../db/db.ts';
import { user, userFollows, decks } from '../auth/auth-schema.ts';

// ============================================================================
// TYPES
// ============================================================================

export type User = typeof user.$inferSelect;
export type UserFollow = typeof userFollows.$inferSelect;

export interface UserProfile extends User {
    isFollowing?: boolean;
    deckCount?: number;
    totalDownloads?: number;
}

export interface UserPublicProfile {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
    bio: string | null;
    website: string | null;
    twitterHandle: string | null;
    followerCount: number;
    isFollowing?: boolean;
    deckCount?: number;
    totalDownloads?: number;
}

export type UserListItem = Pick<User, 'id' | 'name' | 'username' | 'image' | 'bio'>;

// ============================================================================
// USER REPOSITORY
// ============================================================================

export class UserRepository {
    private mapError(error: unknown): DatabaseError | ValidationError | NotFoundError {
        if (error instanceof ValidationError || error instanceof NotFoundError) {
            return error;
        }

        return errorFactory.database('User repository operation failed', { cause: error });
    }

    /**
     * Get user by ID with public profile data
     */
    getUserById(userId: string): ResultAsync<UserPublicProfile, DatabaseError | NotFoundError | ValidationError> {
        if (!userId) {
            return errAsync(
                errorFactory.validation('User ID is required', { field: 'userId' })
            );
        }

        return safeAsync(
            async () => {
                const [userRecord] = await db
                    .select()
                    .from(user)
                    .where(eq(user.id, userId))
                    .limit(1);

                if (!userRecord) {
                    throw errorFactory.notFound('User not found');
                }

                // Get deck count and download count
                const [deckStats] = await db
                    .select({
                        deckCount: count(decks.id),
                        totalDownloads: sql<number>`COALESCE(SUM(${decks.downloadCount}), 0)`.mapWith(Number),
                    })
                    .from(decks)
                    .where(eq(decks.userId, userId));

                return {
                    id: userRecord.id,
                    name: userRecord.name,
                    username: userRecord.username,
                    image: userRecord.image,
                    bio: userRecord.bio,
                    website: userRecord.website,
                    twitterHandle: userRecord.twitterHandle,
                    followerCount: userRecord.followerCount,
                    deckCount: deckStats?.deckCount || 0,
                    totalDownloads: deckStats?.totalDownloads || 0,
                };
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Get user's public decks
     */
    getUserDecks(
        userId: string,
        options: { limit?: number; offset?: number } = {}
    ): ResultAsync<
        {
            decks: Array<{
                id: string;
                name: string;
                description: string | null;
                cardCount: number;
                downloadCount: number;
                createdAt: Date;
            }>;
            total: number;
        },
        DatabaseError | ValidationError
    > {
        if (!userId) {
            return errAsync(
                errorFactory.validation('User ID is required', { field: 'userId' })
            );
        }

        const limit = options.limit || 20;
        const offset = options.offset || 0;

        return safeAsync(
            async () => {
                // Get public decks with card counts
                const deckRows = await db
                    .select({
                        id: decks.id,
                        name: decks.name,
                        description: decks.description,
                        downloadCount: decks.downloadCount,
                        createdAt: decks.createdAt,
                        cardCount: count(sql<number>`*`),
                    })
                    .from(decks)
                    .where(and(eq(decks.userId, userId), eq(decks.visibility, 'public')))
                    .groupBy(decks.id)
                    .orderBy(desc(decks.downloadCount), desc(decks.createdAt))
                    .limit(limit)
                    .offset(offset);

                // Get total count
                const [{ total }] = await db
                    .select({ total: count() })
                    .from(decks)
                    .where(and(eq(decks.userId, userId), eq(decks.visibility, 'public')));

                return {
                    decks: deckRows.map((row) => ({
                        ...row,
                        cardCount: Number(row.cardCount),
                    })),
                    total: Number(total || 0),
                };
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Update user profile
     */
    updateUserProfile(
        userId: string,
        data: {
            bio?: string;
            website?: string;
            twitterHandle?: string;
        }
    ): ResultAsync<User, DatabaseError | ValidationError | NotFoundError> {
        if (!userId) {
            return errAsync(
                errorFactory.validation('User ID is required', { field: 'userId' })
            );
        }

        return safeAsync(
            async () => {
                // Build update object
                const values: Partial<Pick<typeof user.$inferInsert, 'bio' | 'website' | 'twitterHandle'>> = {};

                if (data.bio !== undefined) values.bio = data.bio;
                if (data.website !== undefined) values.website = data.website;
                if (data.twitterHandle !== undefined) values.twitterHandle = data.twitterHandle;

                if (Object.keys(values).length === 0) {
                    // No updates, return existing user
                    const [existingUser] = await db
                        .select()
                        .from(user)
                        .where(eq(user.id, userId))
                        .limit(1);

                    if (!existingUser) {
                        throw errorFactory.notFound('User not found');
                    }

                    return existingUser;
                }

                const [updatedUser] = await db
                    .update(user)
                    .set(values)
                    .where(eq(user.id, userId))
                    .returning();

                if (!updatedUser) {
                    throw errorFactory.notFound('User not found');
                }

                return updatedUser;
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Follow a user
     */
    followUser(
        followerId: string,
        followingId: string
    ): ResultAsync<void, DatabaseError | ValidationError> {
        if (!followerId || !followingId) {
            return errAsync(
                errorFactory.validation('Follower ID and Following ID are required', {
                    field: 'followerId,followingId',
                })
            );
        }

        if (followerId === followingId) {
            return errAsync(
                errorFactory.validation('Cannot follow yourself', { field: 'followingId' })
            );
        }

        return safeAsync(
            async () => {
                // Check if already following
                const [existing] = await db
                    .select()
                    .from(userFollows)
                    .where(
                        and(
                            eq(userFollows.followerId, followerId),
                            eq(userFollows.followingId, followingId)
                        )
                    )
                    .limit(1);

                if (existing) {
                    throw errorFactory.validation('Already following this user', {
                        field: 'followingId',
                    });
                }

                // Create follow relationship
                await db.transaction(async (tx) => {
                    // Add follow
                    await tx.insert(userFollows).values({
                        followerId,
                        followingId,
                        createdAt: new Date(),
                    });

                    // Increment follower count
                    await tx
                        .update(user)
                        .set({
                            followerCount: sql`${user.followerCount} + 1`,
                        })
                        .where(eq(user.id, followingId));
                });
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Unfollow a user
     */
    unfollowUser(
        followerId: string,
        followingId: string
    ): ResultAsync<void, DatabaseError | ValidationError> {
        if (!followerId || !followingId) {
            return errAsync(
                errorFactory.validation('Follower ID and Following ID are required', {
                    field: 'followerId,followingId',
                })
            );
        }

        return safeAsync(
            async () => {
                await db.transaction(async (tx) => {
                    // Delete follow relationship
                    const result = await tx
                        .delete(userFollows)
                        .where(
                            and(
                                eq(userFollows.followerId, followerId),
                                eq(userFollows.followingId, followingId)
                            )
                        )
                        .returning();

                    if (result.length > 0) {
                        // Decrement follower count
                        await tx
                            .update(user)
                            .set({
                                followerCount: sql`${user.followerCount} - 1`,
                            })
                            .where(eq(user.id, followingId));
                    }
                });
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Check if user is following another user
     */
    isFollowing(
        followerId: string,
        followingId: string
    ): ResultAsync<boolean, DatabaseError | ValidationError> {
        if (!followerId || !followingId) {
            return errAsync(
                errorFactory.validation('Follower ID and Following ID are required', {
                    field: 'followerId,followingId',
                })
            );
        }

        return safeAsync(
            async () => {
                const [follow] = await db
                    .select()
                    .from(userFollows)
                    .where(
                        and(
                            eq(userFollows.followerId, followerId),
                            eq(userFollows.followingId, followingId)
                        )
                    )
                    .limit(1);

                return !!follow;
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Get user's followers
     */
    getFollowers(
        userId: string,
        options: { limit?: number; offset?: number } = {}
    ): ResultAsync<
        {
            users: UserListItem[];
            total: number;
        },
        DatabaseError | ValidationError
    > {
        if (!userId) {
            return errAsync(
                errorFactory.validation('User ID is required', { field: 'userId' })
            );
        }

        const limit = options.limit || 20;
        const offset = options.offset || 0;

        return safeAsync(
            async () => {
                const followers = await db
                    .select({
                        id: user.id,
                        name: user.name,
                        username: user.username,
                        image: user.image,
                        bio: user.bio,
                    })
                    .from(userFollows)
                    .innerJoin(user, eq(userFollows.followerId, user.id))
                    .where(eq(userFollows.followingId, userId))
                    .orderBy(desc(userFollows.createdAt))
                    .limit(limit)
                    .offset(offset);

                const [{ total }] = await db
                    .select({ total: count() })
                    .from(userFollows)
                    .where(eq(userFollows.followingId, userId));

                return {
                    users: followers,
                    total: Number(total || 0),
                };
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Get user's following
     */
    getFollowing(
        userId: string,
        options: { limit?: number; offset?: number } = {}
    ): ResultAsync<
        {
            users: UserListItem[];
            total: number;
        },
        DatabaseError | ValidationError
    > {
        if (!userId) {
            return errAsync(
                errorFactory.validation('User ID is required', { field: 'userId' })
            );
        }

        const limit = options.limit || 20;
        const offset = options.offset || 0;

        return safeAsync(
            async () => {
                const following = await db
                    .select({
                        id: user.id,
                        name: user.name,
                        username: user.username,
                        image: user.image,
                        bio: user.bio,
                    })
                    .from(userFollows)
                    .innerJoin(user, eq(userFollows.followingId, user.id))
                    .where(eq(userFollows.followerId, userId))
                    .orderBy(desc(userFollows.createdAt))
                    .limit(limit)
                    .offset(offset);

                const [{ total }] = await db
                    .select({ total: count() })
                    .from(userFollows)
                    .where(eq(userFollows.followerId, userId));

                return {
                    users: following,
                    total: Number(total || 0),
                };
            },
            (error) => this.mapError(error)
        );
    }
}

// Export singleton instance
export const userRepository = new UserRepository();
