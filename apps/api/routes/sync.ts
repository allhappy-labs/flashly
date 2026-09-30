import { type FastifyPluginAsyncZod, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { FullSyncQuizSchema } from '../lib/decks/deck-schema.ts';
import { syncService } from '../lib/sync/sync-service.ts';
import type { ClientDeck, SyncChange } from '../lib/sync/sync-types.ts';
import { routeErrorSchema, sendRouteError } from './route-error.ts';

const syncRoute: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
    // Full sync
    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/sync/full',
        {
            schema: {
                body: z.object({
                    clientDecks: z.array(z.object({
                        id: z.string(),
                        name: z.string(),
                        description: z.string().nullable().optional(),
                        accentKey: z.string().nullable().optional(),
                        materialType: z.string().nullable().optional(),
                        deckType: z.string().nullable().optional(),
                        locale: z.string().nullable().optional(),
                        visibility: z.enum(['private', 'public']).optional(),
                        createdAt: z.coerce.date().optional(),
                        updatedAt: z.coerce.date().optional(),
                        lastStudiedAt: z.coerce.date().nullable().optional(),
                        cards: z.array(z.object({
                            id: z.string(),
                            deckId: z.string(),
                            front: z.string(),
                            back: z.string(),
                            imageUrl: z.string().nullable().optional(),
                            audioUrl: z.string().nullable().optional(),
                            category: z.string().nullable().optional(),
                            pos: z.string().nullable().optional(),
                            gender: z.string().nullable().optional(),
                            example: z.string().nullable().optional(),
                            tags: z.array(z.string()).optional(),
                            quiz: FullSyncQuizSchema,
                            isStarred: z.boolean().optional(),
                            learnState: z.enum(['not_studied', 'learning', 'mastered']).optional(),
                            learnCorrectStreak: z.number().optional(),
                            learnCorrectTotal: z.number().optional(),
                            learnIncorrectTotal: z.number().optional(),
                            learnLastAnsweredAt: z.coerce.date().nullable().optional(),
                            createdAt: z.coerce.date().optional(),
                            updatedAt: z.coerce.date().optional(),
                            lastReviewedAt: z.coerce.date().nullable().optional(),
                            due: z.coerce.date().nullable().optional(),
                            stability: z.number().optional(),
                            difficulty: z.number().optional(),
                            elapsed_days: z.number().optional(),
                            scheduled_days: z.number().optional(),
                            learning_steps: z.number().optional(),
                            reps: z.number().optional(),
                            lapses: z.number().optional(),
                            state: z.enum(['new', 'learning', 'review', 'relearning']).optional(),
                        })).optional(),
                    })).optional(),
                    lastSyncAt: z.coerce.date().optional(),
                    force: z.boolean().optional().default(false),
                }),
                response: {
                    200: z.object({
                        success: z.boolean(),
                        direction: z.enum(['upload', 'download', 'bidirectional']),
                        uploaded: z.number(),
                        downloaded: z.number(),
                        deleted: z.number(),
                        conflicts: z.array(z.object({
                            entityType: z.enum(['deck', 'card']),
                            entityId: z.string(),
                            localVersion: z.number(),
                            remoteVersion: z.number(),
                            localData: z.any(),
                            remoteData: z.any(),
                            conflictType: z.string(),
                            resolved: z.boolean().optional(),
                            resolution: z.enum(['local_wins', 'remote_wins', 'merge', 'manual']).optional(),
                        })),
                        duration: z.number(),
                        syncedAt: z.coerce.date(),
                        changes: z.array(z.object({
                            seq: z.number(),
                            entityType: z.enum(['deck', 'card']),
                            entityId: z.string(),
                            operation: z.enum(['create', 'update', 'delete']),
                            data: z.any().optional(),
                            changedAt: z.string(),
                        })).optional(),
                        cursor: z.string().optional(),
                        hasMore: z.boolean().optional(),
                    }),
                    400: routeErrorSchema,
                    401: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session?.user?.id) {
                return;
            }

            const body = request.body as {
                clientDecks?: ClientDeck[];
                lastSyncAt?: Date;
                force?: boolean;
            };

            const result = await syncService.fullSync({
                userId: session.user.id,
                clientDecks: body.clientDecks,
                lastSyncAt: body.lastSyncAt,
                force: body.force,
            });

            return result.match(
                (syncResult) => reply.code(200).send(syncResult),
                (error) => {
                    fastify.log.error({ err: error, userId: session.user.id }, 'Full sync failed');
                    return sendRouteError(reply, error);
                }
            );
        }
    );

    // Incremental sync
    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/sync/incremental',
        {
            schema: {
                body: z.object({
                    cursor: z.string().optional(),
                    limit: z.coerce.number().int().positive().max(500).default(100),
                    changes: z.array(z.object({
                        entityType: z.enum(['deck', 'card']),
                        entityId: z.string(),
                        operation: z.enum(['create', 'update', 'delete']),
                        data: z.any().optional(),
                        clientUpdatedAt: z.string().optional(),
                    })).optional(),
                }),
                response: {
                    200: z.object({
                        success: z.boolean(),
                        direction: z.enum(['upload', 'download', 'bidirectional']),
                        uploaded: z.number(),
                        downloaded: z.number(),
                        deleted: z.number(),
                        conflicts: z.array(z.object({
                            entityType: z.enum(['deck', 'card']),
                            entityId: z.string(),
                            localVersion: z.number(),
                            remoteVersion: z.number(),
                            localData: z.any(),
                            remoteData: z.any(),
                            conflictType: z.string(),
                            resolved: z.boolean().optional(),
                            resolution: z.enum(['local_wins', 'remote_wins', 'merge', 'manual']).optional(),
                        })),
                        duration: z.number(),
                        syncedAt: z.coerce.date(),
                        changes: z.array(z.object({
                            seq: z.number(),
                            entityType: z.enum(['deck', 'card']),
                            entityId: z.string(),
                            operation: z.enum(['create', 'update', 'delete']),
                            data: z.any().optional(),
                            changedAt: z.string(),
                        })).optional(),
                        cursor: z.string().optional(),
                        hasMore: z.boolean().optional(),
                    }),
                    400: routeErrorSchema,
                    401: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session?.user?.id) {
                return;
            }

            const body = request.body as {
                cursor?: string;
                limit?: number;
                changes?: SyncChange[];
            };

            const result = await syncService.incrementalSync({
                userId: session.user.id,
                cursor: body.cursor,
                limit: body.limit,
                changes: body.changes,
            });

            return result.match(
                (syncResult) => reply.code(200).send(syncResult),
                (error) => {
                    fastify.log.error({ err: error, userId: session.user.id }, 'Incremental sync failed');
                    return sendRouteError(reply, error);
                }
            );
        }
    );

    // Get sync state
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/sync/state',
        {
            schema: {
                response: {
                    200: z.object({
                        userId: z.string(),
                        lastSyncAt: z.coerce.date(),
                        syncCursor: z.string().nullable(),
                        pendingChanges: z.number(),
                    }),
                    401: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session?.user?.id) {
                return;
            }

            const result = await syncService.getSyncState(session.user.id);

            return result.match(
                (syncState) => reply.code(200).send(syncState),
                (error) => sendRouteError(reply, error)
            );
        }
    );
};

export default syncRoute;
