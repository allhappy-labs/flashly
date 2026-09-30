import { ResultAsync } from 'neverthrow';
import { eq, and } from 'drizzle-orm';
import { DatabaseError } from '@flashly/shared';
import { getDb } from './database';
import { analyticsCache } from './schema';
import type { DeckAnalytics } from '../types/models';

function buildCacheId(userId: string, deckId: string, windowDays: number) {
  return `${userId}:${deckId}:${windowDays}`;
}

export function getCachedDeckAnalytics(
  userId: string,
  deckId: string,
  windowDays: number
): ResultAsync<DeckAnalytics | null, DatabaseError> {
  return ResultAsync.fromPromise(
    (async () => {
      const db = await getDb();
      const id = buildCacheId(userId, deckId, windowDays);
      const [row] = await db
        .select()
        .from(analyticsCache)
        .where(and(eq(analyticsCache.id, id), eq(analyticsCache.userId, userId)))
        .limit(1);

      if (!row) return null;
      return JSON.parse(row.payload) as DeckAnalytics;
    })(),
    (error) => new DatabaseError('Failed to load analytics cache', { cause: error })
  );
}

export function setCachedDeckAnalytics(
  userId: string,
  deckId: string,
  windowDays: number,
  data: DeckAnalytics
): ResultAsync<void, DatabaseError> {
  return ResultAsync.fromPromise(
    (async () => {
      const db = await getDb();
      const id = buildCacheId(userId, deckId, windowDays);
      const now = Date.now();
      await db
        .insert(analyticsCache)
        .values({
          id,
          userId,
          deckId,
          windowDays,
          payload: JSON.stringify(data),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: analyticsCache.id,
          set: { payload: JSON.stringify(data), updatedAt: now },
        });
    })(),
    (error) => new DatabaseError('Failed to save analytics cache', { cause: error })
  );
}
