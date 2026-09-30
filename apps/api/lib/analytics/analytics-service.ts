import { eq, and, sql, count, gte, lte, isNotNull } from 'drizzle-orm';
import type { ResultAsync } from 'neverthrow';
import { errAsync } from 'neverthrow';
import { errorFactory, NotFoundError, safeAsync, ValidationError, type DatabaseError } from '@flashly/shared';
import { db } from '../../db/db.ts';
import { decks, cards, studyReviewEvents, studySessionEvents } from '../auth/auth-schema.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface UserStats {
    totalDecks: number;
    totalCards: number;
    totalStudyTime: number;
    cardsStudied: number;
    cardsLearned: number;
    cardsReviewing: number;
    averageAccuracy: number;
    studyStreak: number;
    decksStudiedThisWeek: number;
    cardsStudiedThisWeek: number;
}

export interface DeckStats {
    deckId: string;
    deckName: string;
    totalCards: number;
    cardsStudied: number;
    cardsLearned: number;
    cardsReviewing: number;
    averageAccuracy: number;
    totalStudyTime: number;
    lastStudiedAt: Date | null;
    studySessions: number;
    masteryLevel: number; // 0-100
}

export interface StudyTimeData {
    date: string;
    studyTime: number;
    cardsStudied: number;
}

export interface MasteryProgress {
    notStudied: number;
    learning: number;
    mastered: number;
}

export interface DeckAnalyticsDetail {
    totals: {
        total: number;
        dueToday: number;
        newCount: number;
        learningCount: number;
        reviewCount: number;
        relearningCount: number;
    };
    retention: number;
    easeBuckets: { bucket: string; count: number }[];
    dailyHistory: { date: string; total: number; passed: number }[];
    ratingCounts: { rating: number; count: number }[];
    dueForecast: { date: string; count: number }[];
    timeSpent: { date: string; minutes: number }[];
    windowDaysUsed: number;
}

function getUtcDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

// ============================================================================
// ANALYTICS SERVICE
// ============================================================================

export class AnalyticsService {
    private mapError(error: unknown): DatabaseError | ValidationError | NotFoundError {
        if (error instanceof ValidationError || error instanceof NotFoundError) {
            return error;
        }

        return errorFactory.database('Failed analytics operation', { cause: error });
    }

    private getErrorCode(error: unknown): string | undefined {
        if (!error || typeof error !== 'object') {
            return undefined;
        }

        const code = Reflect.get(error, 'code');
        if (typeof code === 'string') {
            return code;
        }

        const cause = Reflect.get(error, 'cause');
        if (!cause || typeof cause !== 'object') {
            return undefined;
        }

        const causeCode = Reflect.get(cause, 'code');
        return typeof causeCode === 'string' ? causeCode : undefined;
    }

    private isMissingColumnError(error: unknown): boolean {
        return this.getErrorCode(error) === '42703';
    }

    private toFiniteNumber(value: unknown): number {
        const num = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(num) ? num : 0;
    }

    private async ensureDeckBelongsToUser(userId: string, deckId: string): Promise<void> {
        const [deck] = await db
            .select({ id: decks.id })
            .from(decks)
            .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
            .limit(1);

        if (!deck) {
            throw errorFactory.notFound('Deck not found');
        }
    }

    /**
     * Get overall user statistics
     */
    getUserStats(userId: string): ResultAsync<UserStats, DatabaseError | ValidationError> {
        if (!userId) {
            return errAsync(errorFactory.validation('User ID is required', { field: 'userId' }));
        }

        const defaultStats: UserStats = {
            totalDecks: 0,
            totalCards: 0,
            totalStudyTime: 0,
            cardsStudied: 0,
            cardsLearned: 0,
            cardsReviewing: 0,
            averageAccuracy: 0,
            studyStreak: 0,
            decksStudiedThisWeek: 0,
            cardsStudiedThisWeek: 0,
        };

        return safeAsync(
            async () => {
                try {
                    // Get deck counts
                    let deckCounts: { totalDecks: number; totalCards: number } | undefined;
                    try {
                        [deckCounts] = await db
                            .select({
                                totalDecks: sql<number>`COUNT(DISTINCT ${decks.id})`,
                                totalCards: sql<number>`COUNT(${cards.id})`,
                            })
                            .from(decks)
                            .leftJoin(cards, eq(decks.id, cards.deckId))
                            .where(eq(decks.userId, userId));
                    } catch {
                        deckCounts = undefined;
                    }

                    // Get study stats
                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

                    let studyStats: { cardsStudied: number; decksStudiedThisWeek: number } | undefined;
                    try {
                        [studyStats] = await db
                            .select({
                                cardsStudied: sql<number>`COUNT(DISTINCT ${cards.id})`,
                                decksStudiedThisWeek: sql<number>`COUNT(DISTINCT ${cards.deckId})`,
                            })
                            .from(cards)
                            .innerJoin(decks, eq(cards.deckId, decks.id))
                            .where(and(eq(decks.userId, userId), gte(cards.lastReviewedAt, oneWeekAgo)));
                    } catch {
                        studyStats = undefined;
                    }

                    let stateStats: { cardsLearned: number; cardsReviewing: number } | undefined;
                    try {
                        [stateStats] = await db
                            .select({
                                cardsLearned: sql<number>`SUM(CASE WHEN learn_state = 'mastered' THEN 1 ELSE 0 END)`,
                                cardsReviewing: sql<number>`SUM(CASE WHEN learn_state = 'learning' THEN 1 ELSE 0 END)`,
                            })
                            .from(cards)
                            .innerJoin(decks, eq(cards.deckId, decks.id))
                            .where(eq(decks.userId, userId));
                    } catch {
                        stateStats = undefined;
                    }

                    // Calculate accuracy (correct / total attempts)
                    let accuracyStats: { totalAttempts: number; correctAttempts: number } | undefined;
                    try {
                        [accuracyStats] = await db
                            .select({
                                totalAttempts: sql<number>`SUM(learn_correct_total + learn_incorrect_total)`,
                                correctAttempts: sql<number>`SUM(learn_correct_total)`,
                            })
                            .from(cards)
                            .innerJoin(decks, eq(cards.deckId, decks.id))
                            .where(eq(decks.userId, userId));
                    } catch {
                        accuracyStats = undefined;
                    }

                    const totalAttempts = this.toFiniteNumber(accuracyStats?.totalAttempts);
                    const correctAttempts = this.toFiniteNumber(accuracyStats?.correctAttempts);
                    const averageAccuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;

                    return {
                        totalDecks: this.toFiniteNumber(deckCounts?.totalDecks),
                        totalCards: this.toFiniteNumber(deckCounts?.totalCards),
                        totalStudyTime: 0,
                        cardsStudied: this.toFiniteNumber(studyStats?.cardsStudied),
                        cardsLearned: this.toFiniteNumber(stateStats?.cardsLearned),
                        cardsReviewing: this.toFiniteNumber(stateStats?.cardsReviewing),
                        averageAccuracy: this.toFiniteNumber(Math.round(averageAccuracy)),
                        studyStreak: 0,
                        decksStudiedThisWeek: this.toFiniteNumber(studyStats?.decksStudiedThisWeek),
                        cardsStudiedThisWeek: this.toFiniteNumber(studyStats?.cardsStudied),
                    };
                } catch {
                    return defaultStats;
                }
            },
            (error) => this.mapError(error),
        );
    }

    /**
     * Get statistics for a specific deck
     */
    getDeckStats(userId: string, deckId: string): ResultAsync<DeckStats, DatabaseError | ValidationError | NotFoundError> {
        if (!userId) {
            return errAsync(errorFactory.validation('User ID is required', { field: 'userId' }));
        }
        if (!deckId) {
            return errAsync(errorFactory.validation('Deck ID is required', { field: 'deckId' }));
        }

        return safeAsync(
            async () => {
                await this.ensureDeckBelongsToUser(userId, deckId);

                // Get deck info
                const [deckInfo] = await db
                    .select({
                        deckName: decks.name,
                        totalCards: count(cards.id),
                        lastStudiedAt: sql<Date>`MAX(${cards.lastReviewedAt})`,
                    })
                    .from(decks)
                    .leftJoin(cards, eq(decks.id, cards.deckId))
                    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
                    .groupBy(decks.id, decks.name);

                if (!deckInfo) {
                    throw errorFactory.notFound('Deck not found');
                }

                // Get learning state counts
                let stateStats: { cardsStudied: number; cardsLearned: number; cardsReviewing: number } | undefined;
                try {
                    [stateStats] = await db
                        .select({
                            cardsStudied: sql<number>`SUM(CASE WHEN last_reviewed_at IS NOT NULL THEN 1 ELSE 0 END)`,
                            cardsLearned: sql<number>`SUM(CASE WHEN learn_state = 'mastered' THEN 1 ELSE 0 END)`,
                            cardsReviewing: sql<number>`SUM(CASE WHEN learn_state = 'learning' THEN 1 ELSE 0 END)`,
                        })
                        .from(cards)
                        .where(eq(cards.deckId, deckId));
                } catch (error) {
                    if (!this.isMissingColumnError(error)) {
                        throw error;
                    }
                }

                // Calculate accuracy
                let accuracyStats: { totalAttempts: number; correctAttempts: number } | undefined;
                try {
                    [accuracyStats] = await db
                        .select({
                            totalAttempts: sql<number>`SUM(learn_correct_total + learn_incorrect_total)`,
                            correctAttempts: sql<number>`SUM(learn_correct_total)`,
                        })
                        .from(cards)
                        .where(eq(cards.deckId, deckId));
                } catch (error) {
                    if (!this.isMissingColumnError(error)) {
                        throw error;
                    }
                }

                const totalAttempts = Number(accuracyStats?.totalAttempts || 0);
                const correctAttempts = Number(accuracyStats?.correctAttempts || 0);
                const averageAccuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;

                // Calculate mastery level (0-100)
                const totalCards = Number(deckInfo.totalCards || 0);
                const cardsLearned = Number(stateStats?.cardsLearned || 0);
                const cardsReviewing = Number(stateStats?.cardsReviewing || 0);
                const masteryLevel =
                    totalCards > 0 ? Math.round((cardsLearned * 100 + cardsReviewing * 50) / totalCards) : 0;

                return {
                    deckId,
                    deckName: deckInfo.deckName,
                    totalCards,
                    cardsStudied: Number(stateStats?.cardsStudied || 0),
                    cardsLearned,
                    cardsReviewing,
                    averageAccuracy: Math.round(averageAccuracy),
                    totalStudyTime: 0, // TODO: Implement
                    lastStudiedAt: deckInfo.lastStudiedAt,
                    studySessions: 0, // TODO: Implement
                    masteryLevel,
                };
            },
            (error) => this.mapError(error),
        );
    }

    /**
     * Get study time data for charts (last 30 days)
     */
    getStudyTimeData(userId: string, _days: number = 30): ResultAsync<StudyTimeData[], DatabaseError | ValidationError> {
        if (!userId) {
            return errAsync(errorFactory.validation('User ID is required', { field: 'userId' }));
        }

        return safeAsync(
            async () => {
                // TODO: Implement proper study time tracking with timestamps
                // For now, return empty array
                return [];
            },
            (error) => this.mapError(error),
        );
    }

    /**
     * Get mastery progress breakdown
     */
    getMasteryProgress(userId: string, deckId: string): ResultAsync<MasteryProgress, DatabaseError | ValidationError | NotFoundError> {
        if (!userId) {
            return errAsync(errorFactory.validation('User ID is required', { field: 'userId' }));
        }
        if (!deckId) {
            return errAsync(errorFactory.validation('Deck ID is required', { field: 'deckId' }));
        }

        return safeAsync(
            async () => {
                await this.ensureDeckBelongsToUser(userId, deckId);

                let progress: { notStudied: number; learning: number; mastered: number } | undefined;
                try {
                    [progress] = await db
                        .select({
                            notStudied: sql<number>`SUM(CASE WHEN last_reviewed_at IS NULL THEN 1 ELSE 0 END)`,
                            learning: sql<number>`SUM(CASE WHEN learn_state = 'learning' THEN 1 ELSE 0 END)`,
                            mastered: sql<number>`SUM(CASE WHEN learn_state = 'mastered' THEN 1 ELSE 0 END)`,
                        })
                        .from(cards)
                        .innerJoin(decks, eq(cards.deckId, decks.id))
                        .where(and(eq(cards.deckId, deckId), eq(decks.userId, userId)));
                } catch (error) {
                    if (!this.isMissingColumnError(error)) {
                        throw error;
                    }
                }

                return {
                    notStudied: Number(progress?.notStudied || 0),
                    learning: Number(progress?.learning || 0),
                    mastered: Number(progress?.mastered || 0),
                };
            },
            (error) => this.mapError(error),
        );
    }

    /**
     * Get detailed deck analytics (server-sourced)
     */
    getDeckAnalyticsDetail(
        userId: string,
        deckId: string,
        windowDays: number = 30,
    ): ResultAsync<DeckAnalyticsDetail, DatabaseError | ValidationError | NotFoundError> {
        if (!userId) {
            return errAsync(errorFactory.validation('User ID is required', { field: 'userId' }));
        }
        if (!deckId) {
            return errAsync(errorFactory.validation('Deck ID is required', { field: 'deckId' }));
        }

        return safeAsync(
            async () => {
                await this.ensureDeckBelongsToUser(userId, deckId);

                const now = new Date();
                const endOfToday = new Date(
                    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
                );
                const startWindow = windowDays > 0 ? endOfToday.getTime() - windowDays * 24 * 60 * 60 * 1000 : 0;
                const forecastEnd = endOfToday.getTime() + 14 * 24 * 60 * 60 * 1000;

                const [totalsRow] = await db
                    .select({
                        totalCount: count(cards.id),
                        dueCount: sql<number>`sum(CASE WHEN ${cards.due} <= ${endOfToday} THEN 1 ELSE 0 END)`,
                        newCount: sql<number>`sum(CASE WHEN ${cards.state} = 'new' THEN 1 ELSE 0 END)`,
                        learningCount: sql<number>`sum(CASE WHEN ${cards.state} = 'learning' THEN 1 ELSE 0 END)`,
                        reviewCount: sql<number>`sum(CASE WHEN ${cards.state} = 'review' THEN 1 ELSE 0 END)`,
                        relearningCount: sql<number>`sum(CASE WHEN ${cards.state} = 'relearning' THEN 1 ELSE 0 END)`,
                    })
                    .from(cards)
                    .innerJoin(decks, eq(cards.deckId, decks.id))
                    .where(and(eq(cards.deckId, deckId), eq(decks.userId, userId)));

                const [easeRow] = await db
                    .select({
                        bucket1: sql<number>`sum(CASE WHEN ${cards.difficulty} < 2 THEN 1 ELSE 0 END)`,
                        bucket2: sql<number>`sum(CASE WHEN ${cards.difficulty} >= 2 AND ${cards.difficulty} < 4 THEN 1 ELSE 0 END)`,
                        bucket3: sql<number>`sum(CASE WHEN ${cards.difficulty} >= 4 AND ${cards.difficulty} < 6 THEN 1 ELSE 0 END)`,
                        bucket4: sql<number>`sum(CASE WHEN ${cards.difficulty} >= 6 AND ${cards.difficulty} < 8 THEN 1 ELSE 0 END)`,
                        bucket5: sql<number>`sum(CASE WHEN ${cards.difficulty} >= 8 THEN 1 ELSE 0 END)`,
                    })
                    .from(cards)
                    .innerJoin(decks, eq(cards.deckId, decks.id))
                    .where(and(eq(cards.deckId, deckId), eq(decks.userId, userId)));

                const reviewRows = await db
                    .select({
                        date: sql<string>`to_char(${studyReviewEvents.reviewedAt} at time zone 'utc', 'YYYY-MM-DD')`,
                        total: count(studyReviewEvents.id),
                        passed: sql<number>`sum(CASE WHEN ${studyReviewEvents.rating} != 1 THEN 1 ELSE 0 END)`,
                    })
                    .from(studyReviewEvents)
                    .where(
                        and(
                            eq(studyReviewEvents.userId, userId),
                            eq(studyReviewEvents.deckId, deckId),
                            gte(studyReviewEvents.reviewedAt, new Date(startWindow)),
                        ),
                    )
                    .groupBy(sql`date`);

                const ratingRows = await db
                    .select({
                        rating: studyReviewEvents.rating,
                        count: count(studyReviewEvents.id),
                    })
                    .from(studyReviewEvents)
                    .where(and(eq(studyReviewEvents.userId, userId), eq(studyReviewEvents.deckId, deckId)))
                    .groupBy(studyReviewEvents.rating);

                const sessionRows = await db
                    .select({
                        date: sql<string>`to_char(${studySessionEvents.startedAt} at time zone 'utc', 'YYYY-MM-DD')`,
                        totalMs: sql<number>`sum(COALESCE(${studySessionEvents.durationMs}, 0))`,
                    })
                    .from(studySessionEvents)
                    .where(
                        and(
                            eq(studySessionEvents.userId, userId),
                            eq(studySessionEvents.deckId, deckId),
                            gte(studySessionEvents.startedAt, new Date(startWindow)),
                        ),
                    )
                    .groupBy(sql`date`);

                const dueRows = await db
                    .select({ due: cards.due })
                    .from(cards)
                    .innerJoin(decks, eq(cards.deckId, decks.id))
                    .where(
                        and(
                            eq(cards.deckId, deckId),
                            eq(decks.userId, userId),
                            isNotNull(cards.due),
                            lte(cards.due, new Date(forecastEnd)),
                            gte(cards.due, endOfToday),
                        ),
                    );

                const easeBuckets = [
                    { bucket: '1-2', count: Number(easeRow?.bucket1 ?? 0) },
                    { bucket: '2-4', count: Number(easeRow?.bucket2 ?? 0) },
                    { bucket: '4-6', count: Number(easeRow?.bucket3 ?? 0) },
                    { bucket: '6-8', count: Number(easeRow?.bucket4 ?? 0) },
                    { bucket: '8-10', count: Number(easeRow?.bucket5 ?? 0) },
                ];

                const dayMap: Record<string, { total: number; passed: number }> = {};
                let earliestDayStart: number | null = null;
                for (const row of reviewRows) {
                    const key = row.date;
                    const dayStart = Date.parse(`${key}T00:00:00Z`);
                    if (earliestDayStart === null || dayStart < earliestDayStart) {
                        earliestDayStart = dayStart;
                    }
                    dayMap[key] = { total: Number(row.total ?? 0), passed: Number(row.passed ?? 0) };
                }

                let spanDays = windowDays;
                if (windowDays === 0) {
                    if (earliestDayStart !== null) {
                        spanDays = Math.max(
                            1,
                            Math.round((endOfToday.getTime() - earliestDayStart) / (24 * 60 * 60 * 1000)) + 1,
                        );
                    } else {
                        spanDays = 30;
                    }
                }

                const dailyHistory: { date: string; total: number; passed: number }[] = [];
                for (let i = spanDays - 1; i >= 0; i -= 1) {
                    const day = new Date(endOfToday.getTime() - i * 24 * 60 * 60 * 1000);
                    const key = getUtcDateKey(day);
                    const entry = dayMap[key] ?? { total: 0, passed: 0 };
                    dailyHistory.push({ date: key, total: entry.total, passed: entry.passed });
                }

                const windowTotal = dailyHistory.reduce((sum, entry) => sum + entry.total, 0);
                const windowPassed = dailyHistory.reduce((sum, entry) => sum + entry.passed, 0);

                const ratingCounts = [1, 2, 3, 4].map((rating) => ({
                    rating,
                    count: Number(ratingRows.find((row) => row.rating === rating)?.count ?? 0),
                }));

                const totalRatings = ratingCounts.reduce((sum, row) => sum + row.count, 0);
                const passedRatings = totalRatings - (ratingCounts.find((row) => row.rating === 1)?.count ?? 0);
                const retention =
                    windowTotal > 0 ? windowPassed / windowTotal : totalRatings > 0 ? passedRatings / totalRatings : 1;

                const dueMap: Record<string, number> = {};
                for (const row of dueRows) {
                    if (!row.due) continue;
                    const key = getUtcDateKey(new Date(row.due));
                    dueMap[key] = (dueMap[key] ?? 0) + 1;
                }

                const dueForecast: { date: string; count: number }[] = [];
                for (let i = 0; i <= 14; i += 1) {
                    const day = new Date(endOfToday.getTime() + i * 24 * 60 * 60 * 1000);
                    const key = getUtcDateKey(day);
                    dueForecast.push({ date: key, count: dueMap[key] ?? 0 });
                }

                const timeMap: Record<string, number> = {};
                for (const row of sessionRows) {
                    const minutes = Number(row.totalMs ?? 0) / 60000;
                    timeMap[row.date] = (timeMap[row.date] ?? 0) + minutes;
                }

                const timeSpent: { date: string; minutes: number }[] = [];
                for (let i = spanDays - 1; i >= 0; i -= 1) {
                    const day = new Date(endOfToday.getTime() - i * 24 * 60 * 60 * 1000);
                    const key = getUtcDateKey(day);
                    const minutes = timeMap[key] ?? 0;
                    timeSpent.push({ date: key, minutes: Math.round(minutes * 10) / 10 });
                }

                return {
                    totals: {
                        total: Number(totalsRow?.totalCount ?? 0),
                        dueToday: Number(totalsRow?.dueCount ?? 0),
                        newCount: Number(totalsRow?.newCount ?? 0),
                        learningCount: Number(totalsRow?.learningCount ?? 0),
                        reviewCount: Number(totalsRow?.reviewCount ?? 0),
                        relearningCount: Number(totalsRow?.relearningCount ?? 0),
                    },
                    retention,
                    easeBuckets,
                    dailyHistory,
                    ratingCounts,
                    dueForecast,
                    timeSpent,
                    windowDaysUsed: spanDays,
                };
            },
            (error) => this.mapError(error),
        );
    }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
