import { type FastifyPluginAsyncZod, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { analyticsService } from '../lib/analytics/analytics-service.ts';
import { routeErrorSchema, sendRouteError } from './route-error.ts';

const analyticsRoute: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
    // =========================================================================
    // ANALYTICS ENDPOINTS (Auth Required)
    // =========================================================================

    // Get user stats
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/analytics/user',
        {
            schema: {
                response: {
                    200: z.object({
                        totalDecks: z.number(),
                        totalCards: z.number(),
                        totalStudyTime: z.number(),
                        cardsStudied: z.number(),
                        cardsLearned: z.number(),
                        cardsReviewing: z.number(),
                        averageAccuracy: z.number(),
                        studyStreak: z.number(),
                        decksStudiedThisWeek: z.number(),
                        cardsStudiedThisWeek: z.number(),
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

            const result = await analyticsService.getUserStats(session.user.id);

            return result.match(
                (stats) => reply.code(200).send(stats),
                (error) => {
                    request.log.warn(
                        { error, path: '/api/analytics/user', userId: session.user.id },
                        'Falling back to default user analytics stats'
                    );

                    return reply.code(200).send({
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
                    });
                }
            );
        }
    );

    // Get deck stats
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/analytics/decks/:deckId',
        {
            schema: {
                params: z.object({
                    deckId: z.string(),
                }),
                response: {
                    200: z.object({
                        deckId: z.string(),
                        deckName: z.string(),
                        totalCards: z.number(),
                        cardsStudied: z.number(),
                        cardsLearned: z.number(),
                        cardsReviewing: z.number(),
                        averageAccuracy: z.number(),
                        totalStudyTime: z.number(),
                        lastStudiedAt: z.date().nullable(),
                        studySessions: z.number(),
                        masteryLevel: z.number(),
                    }),
                    401: routeErrorSchema,
                    404: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session?.user?.id) {
                return;
            }

            const { deckId } = request.params;
            const result = await analyticsService.getDeckStats(session.user.id, deckId);

            return result.match(
                (stats) => reply.code(200).send(stats),
                (error) => sendRouteError(reply, error, {
                    allowedStatuses: [404, 500],
                    statusByMessage: { 'Deck not found': 404 },
                    codeByMessage: { 'Deck not found': 'NOT_FOUND' },
                })
            );
        }
    );

    // Get mastery progress
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/analytics/decks/:deckId/mastery',
        {
            schema: {
                params: z.object({
                    deckId: z.string(),
                }),
                response: {
                    200: z.object({
                        notStudied: z.number(),
                        learning: z.number(),
                        mastered: z.number(),
                    }),
                    401: routeErrorSchema,
                    404: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session?.user?.id) {
                return;
            }

            const { deckId } = request.params;
            const result = await analyticsService.getMasteryProgress(session.user.id, deckId);

            return result.match(
                (progress) => reply.code(200).send(progress),
                (error) => sendRouteError(reply, error, {
                    allowedStatuses: [404, 500],
                    statusByMessage: { 'Deck not found': 404 },
                    codeByMessage: { 'Deck not found': 'NOT_FOUND' },
                })
            );
        }
    );

    // Get study time data
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/analytics/user/study-time',
        {
            schema: {
                querystring: z.object({
                    days: z.coerce.number().int().positive().default(30),
                }),
                response: {
                    200: z.array(
                        z.object({
                            date: z.string(),
                            studyTime: z.number(),
                            cardsStudied: z.number(),
                        })
                    ),
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

            const { days } = request.query;
            const result = await analyticsService.getStudyTimeData(session.user.id, days);

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error)
            );
        }
    );

    // Get detailed deck analytics
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/analytics/decks/:deckId/detail',
        {
            schema: {
                params: z.object({
                    deckId: z.string(),
                }),
                querystring: z.object({
                    windowDays: z.coerce.number().int().nonnegative().default(30),
                }),
                response: {
                    200: z.object({
                        totals: z.object({
                            total: z.number(),
                            dueToday: z.number(),
                            newCount: z.number(),
                            learningCount: z.number(),
                            reviewCount: z.number(),
                            relearningCount: z.number(),
                        }),
                        retention: z.number(),
                        easeBuckets: z.array(z.object({ bucket: z.string(), count: z.number() })),
                        dailyHistory: z.array(z.object({ date: z.string(), total: z.number(), passed: z.number() })),
                        ratingCounts: z.array(z.object({ rating: z.number(), count: z.number() })),
                        dueForecast: z.array(z.object({ date: z.string(), count: z.number() })),
                        timeSpent: z.array(z.object({ date: z.string(), minutes: z.number() })),
                        windowDaysUsed: z.number(),
                    }),
                    401: routeErrorSchema,
                    404: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session?.user?.id) {
                return;
            }

            const { deckId } = request.params;
            const { windowDays } = request.query;
            const result = await analyticsService.getDeckAnalyticsDetail(session.user.id, deckId, windowDays);

            return result.match(
                (analytics) => reply.code(200).send(analytics),
                (error) => sendRouteError(reply, error, {
                    allowedStatuses: [404, 500],
                    statusByMessage: { 'Deck not found': 404 },
                    codeByMessage: { 'Deck not found': 'NOT_FOUND' },
                })
            );
        }
    );
};

export default analyticsRoute;
