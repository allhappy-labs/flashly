import { and, count, desc, eq, sql } from 'drizzle-orm';
import type { ResultAsync } from 'neverthrow';
import { errAsync } from 'neverthrow';
import {
    createId,
    errorFactory,
    ForbiddenError,
    NotFoundError,
    safeAsync,
    ValidationError,
    type DatabaseError,
} from '@flashly/shared';
import { db } from '../../db/db.ts';
import { deckRatings, deckReviews, decks } from '../auth/auth-schema.ts';
import type {
    CreateRatingInput,
    CreateReviewInput,
    UpdateReviewInput,
} from './rating-schema.ts';

// ============================================================================
// TYPES
// ============================================================================

export type DeckRating = typeof deckRatings.$inferSelect;
export type DeckReview = typeof deckReviews.$inferSelect;

export interface DeckRatingStats {
    averageRating: number;
    totalRatings: number;
    distribution: {
        1: number;
        2: number;
        3: number;
        4: number;
        5: number;
    };
}

// ============================================================================
// RATING REPOSITORY
// ============================================================================

export class RatingRepository {
    private mapError(error: unknown): DatabaseError | ValidationError | NotFoundError | ForbiddenError {
        if (
            error instanceof ValidationError
            || error instanceof NotFoundError
            || error instanceof ForbiddenError
        ) {
            return error;
        }

        return errorFactory.database('Rating repository operation failed', { cause: error });
    }

    private incrementDistribution(distribution: DeckRatingStats['distribution'], rating: number): void {
        switch (rating) {
            case 1:
                distribution[1] += 1;
                break;
            case 2:
                distribution[2] += 1;
                break;
            case 3:
                distribution[3] += 1;
                break;
            case 4:
                distribution[4] += 1;
                break;
            case 5:
                distribution[5] += 1;
                break;
            default:
                break;
        }
    }

    /**
     * Get deck rating statistics
     */
    getDeckRatingStats(deckId: string): ResultAsync<DeckRatingStats, DatabaseError | ValidationError> {
        if (!deckId) {
            return errAsync(
                errorFactory.validation('Deck ID is required', { field: 'deckId' })
            );
        }

        return safeAsync(
            async () => {
                // Get all ratings for the deck
                const ratings = await db
                    .select()
                    .from(deckRatings)
                    .where(eq(deckRatings.deckId, deckId));

                const totalRatings = ratings.length;
                const averageRating =
                    totalRatings > 0
                        ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings
                        : 0;

                // Calculate distribution
                const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                ratings.forEach((ratingRow) => {
                    this.incrementDistribution(distribution, ratingRow.rating);
                });

                return {
                    averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
                    totalRatings,
                    distribution,
                };
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Get user's rating for a deck
     */
    getUserRating(deckId: string, userId: string): ResultAsync<DeckRating | null, DatabaseError | ValidationError> {
        if (!deckId || !userId) {
            return errAsync(
                errorFactory.validation('Deck ID and User ID are required', {
                    field: 'deckId,userId',
                })
            );
        }

        return safeAsync(
            async () => {
                const [rating] = await db
                    .select()
                    .from(deckRatings)
                    .where(and(eq(deckRatings.deckId, deckId), eq(deckRatings.userId, userId)))
                    .limit(1);

                return rating || null;
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Create or update rating
     */
    upsertRating(
        deckId: string,
        userId: string,
        data: CreateRatingInput
    ): ResultAsync<DeckRating, DatabaseError | ValidationError | NotFoundError> {
        if (!deckId || !userId) {
            return errAsync(
                errorFactory.validation('Deck ID and User ID are required', {
                    field: 'deckId,userId',
                })
            );
        }

        return safeAsync(
            async () => {
                // Verify deck exists
                const [deck] = await db.select().from(decks).where(eq(decks.id, deckId)).limit(1);
                if (!deck) {
                    throw errorFactory.notFound('Deck not found');
                }

                const now = new Date();

                // Check if rating already exists
                const [existing] = await db
                    .select()
                    .from(deckRatings)
                    .where(and(eq(deckRatings.deckId, deckId), eq(deckRatings.userId, userId)))
                    .limit(1);

                if (existing) {
                    // Update existing rating
                    const [updated] = await db
                        .update(deckRatings)
                        .set({
                            rating: data.rating,
                            updatedAt: now,
                        })
                        .where(eq(deckRatings.id, existing.id))
                        .returning();

                    if (!updated) {
                        throw errorFactory.database('Failed to update rating');
                    }
                    return updated;
                } else {
                    // Create new rating
                    const rating = {
                        id: createId(),
                        deckId,
                        userId,
                        rating: data.rating,
                        createdAt: now,
                        updatedAt: now,
                    };

                    const [created] = await db.insert(deckRatings).values(rating).returning();
                    if (!created) {
                        throw errorFactory.database('Failed to create rating');
                    }
                    return created;
                }
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Delete rating
     */
    deleteRating(deckId: string, userId: string): ResultAsync<void, DatabaseError | ValidationError> {
        if (!deckId || !userId) {
            return errAsync(
                errorFactory.validation('Deck ID and User ID are required', {
                    field: 'deckId,userId',
                })
            );
        }

        return safeAsync(
            async () => {
                await db
                    .delete(deckRatings)
                    .where(and(eq(deckRatings.deckId, deckId), eq(deckRatings.userId, userId)));
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Get reviews for a deck (paginated)
     */
    getDeckReviews(
        deckId: string,
        options: { page?: number; limit?: number; sortBy?: 'recent' | 'helpful' } = {}
    ): ResultAsync<
        {
            reviews: Array<DeckReview & { authorName: string | null }>;
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        },
        DatabaseError | ValidationError
    > {
        if (!deckId) {
            return errAsync(
                errorFactory.validation('Deck ID is required', { field: 'deckId' })
            );
        }

        const page = options.page || 1;
        const limit = Math.min(options.limit || 10, 100);
        const offset = (page - 1) * limit;

        return safeAsync(
            async () => {
                // Get total count
                const [{ total }] = await db
                    .select({ total: count() })
                    .from(deckReviews)
                    .where(eq(deckReviews.deckId, deckId));

                // Get reviews with author info
                const reviews = await db
                    .select({
                        id: deckReviews.id,
                        deckId: deckReviews.deckId,
                        userId: deckReviews.userId,
                        rating: deckReviews.rating,
                        title: deckReviews.title,
                        content: deckReviews.content,
                        helpfulCount: deckReviews.helpfulCount,
                        createdAt: deckReviews.createdAt,
                        updatedAt: deckReviews.updatedAt,
                    })
                    .from(deckReviews)
                    .where(eq(deckReviews.deckId, deckId))
                    .orderBy(
                        options.sortBy === 'helpful'
                            ? desc(deckReviews.helpfulCount)
                            : desc(deckReviews.createdAt)
                    )
                    .limit(limit)
                    .offset(offset);

                // TODO: Join with user table to get author names
                // For now, we'll return null for authorName
                const reviewsWithAuthors = reviews.map((review) => ({
                    ...review,
                    authorName: null,
                }));

                const totalPages = Math.ceil(Number(total || 0) / limit);

                return {
                    reviews: reviewsWithAuthors,
                    total: Number(total || 0),
                    page,
                    limit,
                    totalPages,
                };
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Create review
     */
    createReview(
        deckId: string,
        userId: string,
        data: CreateReviewInput
    ): ResultAsync<DeckReview, DatabaseError | ValidationError | NotFoundError> {
        if (!deckId || !userId) {
            return errAsync(
                errorFactory.validation('Deck ID and User ID are required', {
                    field: 'deckId,userId',
                })
            );
        }

        return safeAsync(
            async () => {
                // Verify deck exists
                const [deck] = await db.select().from(decks).where(eq(decks.id, deckId)).limit(1);
                if (!deck) {
                    throw errorFactory.notFound('Deck not found');
                }

                const now = new Date();
                const review = {
                    id: createId(),
                    deckId,
                    userId,
                    rating: data.rating,
                    title: data.title ?? null,
                    content: data.content,
                    helpfulCount: 0,
                    createdAt: now,
                    updatedAt: now,
                };

                const [created] = await db.insert(deckReviews).values(review).returning();
                if (!created) {
                    throw errorFactory.database('Failed to create review');
                }
                return created;
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Update review
     */
    updateReview(
        reviewId: string,
        userId: string,
        data: UpdateReviewInput
    ): ResultAsync<DeckReview, DatabaseError | NotFoundError | ForbiddenError | ValidationError> {
        if (!reviewId || !userId) {
            return errAsync(
                errorFactory.validation('Review ID and User ID are required', {
                    field: 'reviewId,userId',
                })
            );
        }

        return safeAsync(
            async () => {
                // Verify ownership
                const [existing] = await db
                    .select()
                    .from(deckReviews)
                    .where(and(eq(deckReviews.id, reviewId), eq(deckReviews.userId, userId)))
                    .limit(1);

                if (!existing) {
                    throw errorFactory.notFound('Review not found or access denied');
                }

                // Build update object
                const values: Record<string, unknown> = {
                    updatedAt: new Date(),
                };

                if (data.title !== undefined) values.title = data.title;
                if (data.content !== undefined) values.content = data.content;

                const [updated] = await db
                    .update(deckReviews)
                    .set(values)
                    .where(eq(deckReviews.id, reviewId))
                    .returning();

                if (!updated) {
                    throw errorFactory.notFound('Review not found');
                }
                return updated;
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Delete review
     */
    deleteReview(reviewId: string, userId: string): ResultAsync<void, DatabaseError | NotFoundError | ValidationError> {
        if (!reviewId || !userId) {
            return errAsync(
                errorFactory.validation('Review ID and User ID are required', {
                    field: 'reviewId,userId',
                })
            );
        }

        return safeAsync(
            async () => {
                await db
                    .delete(deckReviews)
                    .where(and(eq(deckReviews.id, reviewId), eq(deckReviews.userId, userId)));
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Mark review as helpful
     */
    markReviewHelpful(reviewId: string): ResultAsync<DeckReview, DatabaseError | NotFoundError | ValidationError> {
        if (!reviewId) {
            return errAsync(
                errorFactory.validation('Review ID is required', { field: 'reviewId' })
            );
        }

        return safeAsync(
            async () => {
                const [updated] = await db
                    .update(deckReviews)
                    .set({
                        helpfulCount: sql`${deckReviews.helpfulCount} + 1`,
                    })
                    .where(eq(deckReviews.id, reviewId))
                    .returning();

                if (!updated) {
                    throw errorFactory.notFound('Review not found');
                }

                return updated;
            },
            (error) => this.mapError(error)
        );
    }
}

// Export singleton instance
export const ratingRepository = new RatingRepository();
