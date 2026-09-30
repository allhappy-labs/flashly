/**
 * Recommendation Service - Smart deck recommendations and search
 */

import { eq, and, desc, sql, count, inArray, ilike, or } from 'drizzle-orm';
import type { ResultAsync } from 'neverthrow';
import { errAsync, okAsync } from 'neverthrow';
import {
    createId,
    errorFactory,
    NotFoundError,
    safeAsync,
    ValidationError,
    type DatabaseError,
} from '@flashly/shared';
import { db } from '../../db/db.ts';
import { cards, decks, deckRatings, deckViews } from '../auth/auth-schema.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface SearchSuggestion {
    id: string;
    name: string;
    type: 'deck' | 'category';
}

export interface SimilarDecksResult {
    decks: Array<{
        id: string;
        name: string;
        description: string | null;
        cardCount: number;
        rating: number;
        downloadCount: number;
        matchScore: number;
    }>;
}

export interface TrendingDecksResult {
    decks: Array<{
        id: string;
        name: string;
        description: string | null;
        cardCount: number;
        rating: number;
        downloadCount: number;
        viewCount: number;
    }>;
    period: 'day' | 'week' | 'month' | 'all';
}

// ============================================================================
// RECOMMENDATION SERVICE
// ============================================================================

export class RecommendationService {
    private mapError(error: unknown): DatabaseError | ValidationError | NotFoundError {
        if (error instanceof ValidationError || error instanceof NotFoundError) {
            return error;
        }

        return errorFactory.database('Recommendation service operation failed', { cause: error });
    }

    /**
     * Full-text search for decks
     */
    searchDecks(
        query: string,
        options: {
            limit?: number;
            offset?: number;
            materialType?: string;
            deckType?: string;
            locale?: string;
        } = {}
    ): ResultAsync<{
        decks: Array<{
            id: string;
            name: string;
            description: string | null;
            cardCount: number;
            downloadCount: number;
            rating: number;
            relevance: number;
        }>;
        total: number;
    }, DatabaseError | ValidationError> {
        if (!query || query.trim().length === 0) {
            return errAsync(
                errorFactory.validation('Search query is required', { field: 'query' })
            );
        }

        const limit = options.limit || 20;
        const offset = options.offset || 0;
        const searchTerms = query.trim().split(/\s+/);

        return safeAsync(
            async () => {
                // Build dynamic search conditions using ilike (parameterized)
                const conditions = [];

                // Name matching (higher weight)
                const nameConditions = searchTerms.map((term) =>
                    ilike(decks.name, `%${term}%`)
                );
                conditions.push(...nameConditions);

                // Description matching (lower weight)
                const descConditions = searchTerms.map((term) =>
                    ilike(decks.description, `%${term}%`)
                );
                conditions.push(...descConditions);

                // Material type filter
                let materialTypeFilter = sql`TRUE`;
                if (options.materialType) {
                    materialTypeFilter = eq(decks.materialType, options.materialType);
                }

                // Deck type filter
                let deckTypeFilter = sql`TRUE`;
                if (options.deckType) {
                    deckTypeFilter = eq(decks.deckType, options.deckType);
                }

                // Locale filter
                let localeFilter = sql`TRUE`;
                if (options.locale) {
                    localeFilter = eq(decks.locale, options.locale);
                }

                // Build parameterized scoring SQL
                const nameScoreCases = searchTerms.map((term) =>
                    sql`CASE WHEN ${ilike(decks.name, `%${term}%`)} THEN 2 ELSE 0 END`
                );
                const descScoreCases = searchTerms.map((term) =>
                    sql`CASE WHEN ${ilike(decks.description, `%${term}%`)} THEN 1 ELSE 0 END`
                );

                const scoreExpression = sql.join(
                    [...nameScoreCases, ...descScoreCases],
                    sql` + `
                );

                // Get matching decks with relevance scoring
                const deckRows = await db
                    .select({
                        id: decks.id,
                        name: decks.name,
                        description: decks.description,
                        downloadCount: decks.downloadCount,
                        cardCount: count(cards.id),
                    })
                    .from(decks)
                    .leftJoin(cards, eq(cards.deckId, decks.id))
                    .where(
                        and(
                            materialTypeFilter,
                            deckTypeFilter,
                            localeFilter,
                            eq(decks.visibility, 'public'),
                            or(...conditions)
                        )
                    )
                    .groupBy(decks.id)
                    .orderBy(desc(scoreExpression))
                    .limit(limit)
                    .offset(offset);

                // Get total count
                const [{ total }] = await db
                    .select({ total: count(sql`DISTINCT ${decks.id}`) })
                    .from(decks)
                    .where(
                        and(
                            materialTypeFilter,
                            deckTypeFilter,
                            localeFilter,
                            eq(decks.visibility, 'public'),
                            or(...conditions)
                        )
                    );

                // Get average ratings for each deck
                const deckIds = deckRows.map((d) => d.id);
                const ratingsMap = new Map<string, number>();

                if (deckIds.length > 0) {
                    const ratings = await db
                        .select({
                            deckId: deckRatings.deckId,
                            avgRating: sql<number>`AVG(${deckRatings.rating})`.mapWith(Number),
                        })
                        .from(deckRatings)
                        .where(inArray(deckRatings.deckId, deckIds))
                        .groupBy(deckRatings.deckId);

                    ratings.forEach((r) => {
                        if (r.avgRating) {
                            ratingsMap.set(r.deckId, Math.round(r.avgRating * 10) / 10);
                        }
                    });
                }

                const matchingDecks = deckRows.map((row) => ({
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    cardCount: Number(row.cardCount || 0),
                    downloadCount: Number(row.downloadCount || 0),
                    rating: ratingsMap.get(row.id) || 0,
                    relevance: 0, // Calculated by ORDER BY
                }));

                return {
                    decks: matchingDecks,
                    total: Number(total || 0),
                };
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Get search suggestions for autocomplete
     */
    getSearchSuggestions(query: string, limit: number = 5): ResultAsync<SearchSuggestion[], DatabaseError> {
        if (!query || query.trim().length === 0) {
            return okAsync([]);
        }

        return safeAsync(
            async () => {
                const suggestions: SearchSuggestion[] = [];

                // Search deck names using parameterized ilike
                const deckResults = await db
                    .select({
                        id: decks.id,
                        name: decks.name,
                    })
                    .from(decks)
                    .where(
                        and(
                            eq(decks.visibility, 'public'),
                            ilike(decks.name, `%${query.trim()}%`)
                        )
                    )
                    .orderBy(desc(decks.downloadCount))
                    .limit(Math.floor(limit / 2));

                suggestions.push(
                    ...deckResults.map((d) => ({
                        id: d.id,
                        name: d.name,
                        type: 'deck' as const,
                    }))
                );

                // TODO: Add category suggestions when categories are implemented

                return suggestions;
            },
            (error) => errorFactory.database('Failed to get search suggestions', { cause: error })
        );
    }

    /**
     * Get similar decks based on category, tags, and material type
     */
    getSimilarDecks(deckId: string, limit: number = 6): ResultAsync<SimilarDecksResult, DatabaseError | ValidationError | NotFoundError> {
        if (!deckId) {
            return errAsync(
                errorFactory.validation('Deck ID is required', { field: 'deckId' })
            );
        }

        return safeAsync(
            async () => {
                // Get source deck info
                const [sourceDeck] = await db
                    .select()
                    .from(decks)
                    .where(eq(decks.id, deckId))
                    .limit(1);

                if (!sourceDeck) {
                    throw errorFactory.notFound('Deck not found');
                }

                const [sourceDeckCounts] = await db
                    .select({ cardCount: count(cards.id) })
                    .from(cards)
                    .where(eq(cards.deckId, deckId));
                const sourceCardCount = Number(sourceDeckCounts?.cardCount || 0);

                // Build similarity scoring
                // Score based on: matching materialType (30), deckType (30), locale (20), cards count (20)
                const similarDeckRows = await db
                    .select({
                        id: decks.id,
                        name: decks.name,
                        description: decks.description,
                        materialType: decks.materialType,
                        deckType: decks.deckType,
                        locale: decks.locale,
                        downloadCount: decks.downloadCount,
                        cardCount: count(cards.id),
                    })
                    .from(decks)
                    .leftJoin(cards, eq(cards.deckId, decks.id))
                    .where(
                        and(
                            eq(decks.visibility, 'public'),
                            sql`${decks.id} != ${deckId}`
                        )
                    )
                    .groupBy(decks.id)
                    .orderBy(desc(decks.downloadCount))
                    .limit(limit + 1); // Get one extra to exclude source deck

                // Calculate match scores
                const scoredDecks = similarDeckRows
                    .filter((d) => d.id !== deckId)
                    .map((deck) => {
                        let score = 0;

                        // Material type match
                        if (sourceDeck.materialType && deck.materialType === sourceDeck.materialType) {
                            score += 30;
                        }

                        // Deck type match
                        if (sourceDeck.deckType && deck.deckType === sourceDeck.deckType) {
                            score += 30;
                        }

                        // Locale match
                        if (sourceDeck.locale && deck.locale === sourceDeck.locale) {
                            score += 20;
                        }

                        // Similar card count (within 20%)
                        const deckCardCount = Number(deck.cardCount || 0);
                        if (sourceCardCount > 0 && deckCardCount > 0) {
                            const ratio = Math.min(deckCardCount / sourceCardCount, sourceCardCount / deckCardCount);
                            if (ratio >= 0.8 && ratio <= 1.2) {
                                score += 20;
                            }
                        }

                        return {
                            id: deck.id,
                            name: deck.name,
                            description: deck.description,
                            cardCount: deckCardCount,
                            downloadCount: Number(deck.downloadCount),
                            rating: 0, // TODO: Fetch actual rating
                            matchScore: score,
                        };
                    })
                    .toSorted((a, b) => b.matchScore - a.matchScore)
                    .slice(0, limit);

                return { decks: scoredDecks };
            },
            (error) => this.mapError(error)
        );
    }

    /**
     * Get trending decks based on views, downloads, and recent activity
     */
    getTrendingDecks(period: 'day' | 'week' | 'month' | 'all' = 'week', limit: number = 10): ResultAsync<TrendingDecksResult, DatabaseError> {
        return safeAsync(
            async () => {
                let dateFilter = sql`TRUE`;
                const now = new Date();
                const trendingScore = sql`(
                    COALESCE(${decks.viewCount}, 0) * 0.5
                    + COALESCE(${decks.downloadCount}, 0) * 0.3
                    + COUNT(${cards.id}) * 0.2
                )`;

                if (period === 'day') {
                    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    dateFilter = sql`${decks.createdAt} >= ${oneDayAgo}`;
                } else if (period === 'week') {
                    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    dateFilter = sql`${decks.createdAt} >= ${oneWeekAgo}`;
                } else if (period === 'month') {
                    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    dateFilter = sql`${decks.createdAt} >= ${oneMonthAgo}`;
                }

                const deckRows = await db
                    .select({
                        id: decks.id,
                        name: decks.name,
                        description: decks.description,
                        downloadCount: decks.downloadCount,
                        viewCount: decks.viewCount,
                        cardCount: count(cards.id),
                    })
                    .from(decks)
                    .leftJoin(cards, eq(cards.deckId, decks.id))
                    .where(and(eq(decks.visibility, 'public'), dateFilter))
                    .groupBy(decks.id)
                    .orderBy(desc(trendingScore))
                    .limit(limit);

                const trendingDecks = await Promise.all(
                    deckRows.map(async (row) => {
                        // Get rating
                        const [ratingData] = await db
                            .select({
                                avgRating: sql<number>`AVG(${deckRatings.rating})`.mapWith(Number),
                            })
                            .from(deckRatings)
                            .where(eq(deckRatings.deckId, row.id));

                        return {
                            id: row.id,
                            name: row.name,
                            description: row.description,
                            cardCount: Number(row.cardCount || 0),
                            rating: ratingData?.avgRating ? Math.round(ratingData.avgRating * 10) / 10 : 0,
                            downloadCount: Number(row.downloadCount || 0),
                            viewCount: Number(row.viewCount || 0),
                        };
                    })
                );

                return {
                    decks: trendingDecks,
                    period,
                };
            },
            (error) => errorFactory.database('Failed to get trending decks', { cause: error })
        );
    }

    /**
     * Track deck view (for recommendation algorithm)
     */
    trackDeckView(deckId: string, userId?: string, sessionId?: string): ResultAsync<void, DatabaseError | ValidationError> {
        if (!deckId) {
            return errAsync(
                errorFactory.validation('Deck ID is required', { field: 'deckId' })
            );
        }

        return safeAsync(
            async () => {
                await db.insert(deckViews).values({
                    id: createId(),
                    deckId,
                    userId: userId || null,
                    sessionId: sessionId || null,
                    viewedAt: new Date(),
                });
            },
            (error) => this.mapError(error)
        );
    }
}

// Export singleton instance
export const recommendationService = new RecommendationService();
