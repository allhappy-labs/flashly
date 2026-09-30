import { ResultAsync, okAsync } from 'neverthrow';
import { asc, inArray, sql, and, or, isNull, lte, eq, gt } from 'drizzle-orm';
import { DatabaseError } from '@flashly/shared';
import { getDb } from '../../db/database';
import { studyEventOutbox } from '../../db/schema';
import { createId } from '../../utils/ids';

export type StudyEventOutboxItem = typeof studyEventOutbox.$inferSelect;

export type StudyEventType = 'review' | 'session';

export class StudyEventRepository {
    enqueueEvent(
        eventType: StudyEventType,
        payload: Record<string, unknown>,
        userId?: string | null
    ): ResultAsync<void, DatabaseError> {
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                const now = Date.now();
                const id = String(payload.id ?? createId());
                await db.insert(studyEventOutbox).values({
                    id,
                    eventType,
                    payload: JSON.stringify(payload),
                    createdAt: now,
                    retries: 0,
                    userId: userId ?? null,
                });
            })(),
            (error) => new DatabaseError('Failed to enqueue study event', { cause: error })
        );
    }

    getPendingEvents(
        limit: number = 100,
        userId?: string | null,
        maxRetries?: number
    ): ResultAsync<StudyEventOutboxItem[], DatabaseError> {
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                const userCondition = userId
                    ? or(eq(studyEventOutbox.userId, userId), isNull(studyEventOutbox.userId))
                    : undefined;
                const retriesCondition = maxRetries !== undefined
                    ? lte(studyEventOutbox.retries, maxRetries)
                    : undefined;
                const whereClause = userCondition && retriesCondition
                    ? and(userCondition, retriesCondition)
                    : (userCondition ?? retriesCondition);
                return await db
                    .select()
                    .from(studyEventOutbox)
                    .where(whereClause)
                    .orderBy(asc(studyEventOutbox.createdAt))
                    .limit(limit);
            })(),
            (error) => new DatabaseError('Failed to load study events', { cause: error })
        );
    }

    markEventsAccepted(ids: string[], userId?: string | null): ResultAsync<void, DatabaseError> {
        if (!ids.length) return okAsync(undefined);
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                const whereClause = userId
                    ? and(
                        inArray(studyEventOutbox.id, ids),
                        or(eq(studyEventOutbox.userId, userId), isNull(studyEventOutbox.userId))
                    )
                    : inArray(studyEventOutbox.id, ids);
                await db.delete(studyEventOutbox).where(whereClause);
            })(),
            (error) => new DatabaseError('Failed to delete accepted study events', { cause: error })
        );
    }

    markEventsFailed(ids: string[], errorMessage: string, userId?: string | null): ResultAsync<void, DatabaseError> {
        if (!ids.length) return okAsync(undefined);
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                const now = Date.now();
                const whereClause = userId
                    ? and(
                        inArray(studyEventOutbox.id, ids),
                        or(eq(studyEventOutbox.userId, userId), isNull(studyEventOutbox.userId))
                    )
                    : inArray(studyEventOutbox.id, ids);
                await db.update(studyEventOutbox)
                    .set({
                        retries: sql`${studyEventOutbox.retries} + 1`,
                        lastAttemptAt: now,
                        error: errorMessage,
                    })
                    .where(whereClause);
            })(),
            (error) => new DatabaseError('Failed to mark study events failed', { cause: error })
        );
    }

    claimAnonymousEvents(userId: string): ResultAsync<void, DatabaseError> {
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                await db
                    .update(studyEventOutbox)
                    .set({ userId })
                    .where(isNull(studyEventOutbox.userId));
            })(),
            (error) => new DatabaseError('Failed to claim anonymous events', { cause: error })
        );
    }

    clearFailedEvents(maxRetries: number, userId?: string | null): ResultAsync<void, DatabaseError> {
        return ResultAsync.fromPromise(
            (async () => {
                const db = await getDb();
                const whereClause = userId
                    ? and(
                        or(eq(studyEventOutbox.userId, userId), isNull(studyEventOutbox.userId)),
                        gt(studyEventOutbox.retries, maxRetries)
                    )
                    : gt(studyEventOutbox.retries, maxRetries);
                await db.delete(studyEventOutbox).where(whereClause);
            })(),
            (error) => new DatabaseError('Failed to clear study events', { cause: error })
        );
    }
}

let studyEventRepositoryInstance: StudyEventRepository | null = null;

export function getStudyEventRepository(): StudyEventRepository {
    if (!studyEventRepositoryInstance) {
        studyEventRepositoryInstance = new StudyEventRepository();
    }
    return studyEventRepositoryInstance;
}
