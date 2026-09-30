import type { ResultAsync } from 'neverthrow';
import { db } from '../../db/db.ts';
import { studyReviewEvents, studySessionEvents } from '../auth/auth-schema.ts';
import type { DatabaseError} from '@flashly/shared';
import { errorFactory, safeAsync } from '@flashly/shared';

export type ReviewEventInput = {
    id: string;
    deckId: string;
    cardId: string;
    rating: number;
    reviewedAt: Date;
    responseMs?: number | null;
    deviceId?: string | null;
    clientUpdatedAt?: Date | null;
};

export type SessionEventInput = {
    id: string;
    deckId: string;
    sessionId: string;
    startedAt: Date;
    endedAt?: Date | null;
    durationMs?: number | null;
    deviceId?: string | null;
    clientUpdatedAt?: Date | null;
};

export class StudyEventService {
    recordEvents(options: {
        userId: string;
        reviewEvents?: ReviewEventInput[];
        sessionEvents?: SessionEventInput[];
    }): ResultAsync<{ acceptedIds: string[] }, DatabaseError> {
        return safeAsync(
            (async () => {
                const acceptedIds: string[] = [];
                const reviewEvents = options.reviewEvents ?? [];
                const sessionEvents = options.sessionEvents ?? [];

                if (reviewEvents.length > 0) {
                    await db
                        .insert(studyReviewEvents)
                        .values(
                            reviewEvents.map((event) => ({
                                id: event.id,
                                userId: options.userId,
                                deckId: event.deckId,
                                cardId: event.cardId,
                                rating: event.rating,
                                reviewedAt: event.reviewedAt,
                                responseMs: event.responseMs ?? null,
                                deviceId: event.deviceId ?? null,
                                clientUpdatedAt: event.clientUpdatedAt ?? null,
                            }))
                        )
                        .onConflictDoNothing();
                    acceptedIds.push(...reviewEvents.map((event) => event.id));
                }

                if (sessionEvents.length > 0) {
                    await db
                        .insert(studySessionEvents)
                        .values(
                            sessionEvents.map((event) => ({
                                id: event.id,
                                userId: options.userId,
                                deckId: event.deckId,
                                sessionId: event.sessionId,
                                startedAt: event.startedAt,
                                endedAt: event.endedAt ?? null,
                                durationMs: event.durationMs ?? null,
                                deviceId: event.deviceId ?? null,
                                clientUpdatedAt: event.clientUpdatedAt ?? null,
                            }))
                        )
                        .onConflictDoNothing();
                    acceptedIds.push(...sessionEvents.map((event) => event.id));
                }

                return { acceptedIds };
            })(),
            (error) => errorFactory.database('Failed to record study events', { cause: error })
        );
    }
}

export const studyEventService = new StudyEventService();
