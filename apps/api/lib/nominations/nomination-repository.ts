/**
 * Nomination Repository - Manage deck nominations for featuring
 */

import { eq, and, desc, sql, count } from 'drizzle-orm';
import type { ResultAsync } from 'neverthrow';
import { errAsync } from 'neverthrow';
import {
    createId,
    errorFactory,
    NotFoundError,
    safeAsync,
    ValidationError,
    type DatabaseError,
} from '@flashly/shared';
import { db } from '../../db/db.ts';
import { deckNominations, decks, deckRatings, user as usersTable } from '../auth/auth-schema.ts';

// ============================================================================
// TYPES
// ============================================================================

export type Nomination = typeof deckNominations.$inferSelect;

export interface CreateNominationInput {
    reason: string;
}

export interface NominationStats {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
}

// ============================================================================
// NOMINATION REPOSITORY
// ============================================================================

export class NominationRepository {
    private mapError(error: unknown): DatabaseError | ValidationError | NotFoundError {
        if (error instanceof ValidationError || error instanceof NotFoundError) {
            return error;
        }

        return errorFactory.database('Nomination repository operation failed', { cause: error });
    }

    /**
     * Nominate a deck for featuring
     */
    nominateDeck(
        deckId: string,
        userId: string,
        input: CreateNominationInput
    ): ResultAsync<Nomination, DatabaseError | ValidationError | NotFoundError> {
        if (!deckId || !userId) {
            return errAsync(
                errorFactory.validation('Deck ID and User ID are required', {
                    field: 'deckId,userId',
                })
            );
        }

        if (!input.reason || input.reason.trim().length === 0) {
            return errAsync(
                errorFactory.validation('Reason is required', { field: 'reason' })
            );
        }

        return safeAsync(
            async () => {
                // Verify deck exists and is public
                const [deck] = await db
                    .select()
                    .from(decks)
                    .where(and(eq(decks.id, deckId), eq(decks.visibility, 'public')))
                    .limit(1);

                if (!deck) {
                    throw errorFactory.notFound('Deck not found or not public');
                }

                // Check if user already nominated this deck
                const [existing] = await db
                    .select()
                    .from(deckNominations)
                    .where(and(eq(deckNominations.deckId, deckId), eq(deckNominations.userId, userId)))
                    .limit(1);

                if (existing) {
                    throw errorFactory.validation('You have already nominated this deck', {
                        field: 'deckId',
                    });
                }

                // Create nomination
                const nomination = {
                    id: createId(),
                    deckId,
                    userId,
                    reason: input.reason.trim(),
                    status: 'pending' as const,
                    reviewedBy: null,
                    reviewedAt: null,
                    createdAt: new Date(),
                };

                const [created] = await db.insert(deckNominations).values(nomination).returning();
                if (!created) {
                    throw errorFactory.database('Failed to create nomination');
                }
                return created;
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Get pending nominations (for admin)
     */
    getPendingNominations(options: { limit?: number; offset?: number } = {}): ResultAsync<
        {
            nominations: Array<Nomination & { deckName: string; userName: string; deckRating: number }>;
            total: number;
        },
        DatabaseError
    > {
        const limit = options.limit || 20;
        const offset = options.offset || 0;

        return safeAsync(
            async () => {
                // Get nominations with deck and user info
                const nominations = await db
                    .select({
                        id: deckNominations.id,
                        deckId: deckNominations.deckId,
                        userId: deckNominations.userId,
                        reason: deckNominations.reason,
                        status: deckNominations.status,
                        reviewedBy: deckNominations.reviewedBy,
                        reviewedAt: deckNominations.reviewedAt,
                        createdAt: deckNominations.createdAt,
                    })
                    .from(deckNominations)
                    .where(eq(deckNominations.status, 'pending'))
                    .orderBy(desc(deckNominations.createdAt))
                    .limit(limit)
                    .offset(offset);

                const totalResult = await db
                    .select({ total: count() })
                    .from(deckNominations)
                    .where(eq(deckNominations.status, 'pending'));

                const nominationsWithInfo = await Promise.all(
                    nominations.map(async (nomination) => {
                        // Get deck name
                        const [deck] = await db
                            .select({ name: decks.name })
                            .from(decks)
                            .where(eq(decks.id, nomination.deckId))
                            .limit(1);

                        // Get user name
                        const [userRow] = await db
                            .select({ name: usersTable.name })
                            .from(usersTable)
                            .where(eq(usersTable.id, nomination.userId))
                            .limit(1);

                        // Get deck rating
                        const [ratingData] = await db
                            .select({
                                avgRating: sql<number>`AVG(${deckRatings.rating})`.mapWith(Number),
                            })
                            .from(deckRatings)
                            .where(eq(deckRatings.deckId, nomination.deckId))
                            .limit(1);

                        return {
                            ...nomination,
                            deckName: deck?.name || 'Unknown Deck',
                            userName: userRow?.name || 'Unknown User',
                            deckRating: ratingData?.avgRating ? Math.round(ratingData.avgRating * 10) / 10 : 0,
                        };
                    })
                );

                const total = Number(totalResult[0]?.total || 0);

                return {
                    nominations: nominationsWithInfo,
                    total,
                };
            },
            (error) => errorFactory.database('Failed to get nominations', { cause: error })
        );
    }

    /**
     * Review a nomination (admin only)
     */
    reviewNomination(
        nominationId: string,
        adminId: string,
        action: 'approve' | 'reject'
    ): ResultAsync<void, DatabaseError | NotFoundError | ValidationError> {
        if (!nominationId || !adminId) {
            return errAsync(
                errorFactory.validation('Nomination ID and Admin ID are required', {
                    field: 'nominationId,adminId',
                })
            );
        }

        return safeAsync(
            async () => {
                const [nomination] = await db
                    .select()
                    .from(deckNominations)
                    .where(eq(deckNominations.id, nominationId))
                    .limit(1);

                if (!nomination) {
                    throw errorFactory.notFound('Nomination not found');
                }

                // Update nomination status
                const [updated] = await db
                    .update(deckNominations)
                    .set({
                        status: action === 'approve' ? 'approved' : 'rejected',
                        reviewedBy: adminId,
                        reviewedAt: new Date(),
                    })
                    .where(eq(deckNominations.id, nominationId))
                    .returning();

                // If approved, mark deck as featured
                if (action === 'approve' && updated) {
                    await db
                        .update(decks)
                        .set({ isFeatured: true })
                        .where(eq(decks.id, nomination.deckId));
                }

                return;
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Get nomination statistics
     */
    getNominationStats(): ResultAsync<NominationStats, DatabaseError> {
        return safeAsync(
            async () => {
                const stats = await db
                    .select({
                        total: count(),
                        pending: sql<number>`SUM(CASE WHEN ${deckNominations.status} = 'pending' THEN 1 ELSE 0 END)`,
                        approved: sql<number>`SUM(CASE WHEN ${deckNominations.status} = 'approved' THEN 1 ELSE 0 END)`,
                        rejected: sql<number>`SUM(CASE WHEN ${deckNominations.status} = 'rejected' THEN 1 ELSE 0 END)`,
                    })
                    .from(deckNominations);

                return {
                    total: Number(stats[0]?.total || 0),
                    pending: Number(stats[0]?.pending || 0),
                    approved: Number(stats[0]?.approved || 0),
                    rejected: Number(stats[0]?.rejected || 0),
                };
            },
            (error) => errorFactory.database('Failed to get nomination stats', { cause: error })
        );
    }
}

// Export singleton instance
export const nominationRepository = new NominationRepository();
