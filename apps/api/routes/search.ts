import { type FastifyPluginAsyncZod, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { recommendationService } from '../lib/search/recommendation-service.ts';
import { routeErrorSchema, sendRouteError } from './route-error.ts';

const searchRoute: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
    // =========================================================================
    // SEARCH ENDPOINTS (Public)
    // =========================================================================

    // Enhanced search endpoint
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/marketplace/search',
        {
            schema: {
                querystring: z.object({
                    q: z.string(),
                    page: z.coerce.number().int().positive().default(1),
                    limit: z.coerce.number().int().positive().max(100).default(20),
                    materialType: z.string().optional(),
                    deckType: z.string().optional(),
                    locale: z.string().optional(),
                }),
                response: {
                    200: z.object({
                        decks: z.array(
                            z.object({
                                id: z.string(),
                                name: z.string(),
                                description: z.string().nullable(),
                                cardCount: z.number(),
                                downloadCount: z.number(),
                                rating: z.number(),
                                relevance: z.number(),
                            })
                        ),
                        total: z.number(),
                    }),
                    400: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const { q, ...options } = request.query;

            if (!q) {
                return reply.code(400).send({
                    error: 'VALIDATION_ERROR',
                    message: 'Search query is required',
                });
            }

            const offset = (options.page - 1) * options.limit;
            const result = await recommendationService.searchDecks(q, {
                limit: options.limit,
                offset,
                materialType: options.materialType,
                deckType: options.deckType,
                locale: options.locale,
            });

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error)
            );
        }
    );

    // Search suggestions for autocomplete
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/search/suggestions',
        {
            schema: {
                querystring: z.object({
                    q: z.string(),
                    limit: z.coerce.number().int().positive().max(10).default(5),
                }),
                response: {
                    200: z.array(
                        z.object({
                            id: z.string(),
                            name: z.string(),
                            type: z.enum(['deck', 'category']),
                        })
                    ),
                    400: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const { q, limit } = request.query;

            if (!q) {
                return reply.code(400).send({
                    error: 'VALIDATION_ERROR',
                    message: 'Search query is required',
                });
            }

            const result = await recommendationService.getSearchSuggestions(q, limit);

            return result.match(
                (suggestions) => reply.code(200).send(suggestions),
                (error) => sendRouteError(reply, error)
            );
        }
    );

    // Get similar decks
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/marketplace/:id/similar',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                querystring: z.object({
                    limit: z.coerce.number().int().positive().max(20).default(6),
                }),
                response: {
                    200: z.object({
                        decks: z.array(
                            z.object({
                                id: z.string(),
                                name: z.string(),
                                description: z.string().nullable(),
                                cardCount: z.number(),
                                rating: z.number(),
                                downloadCount: z.number(),
                                matchScore: z.number(),
                            })
                        ),
                    }),
                    404: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const { id } = request.params;
            const { limit } = request.query;
            const result = await recommendationService.getSimilarDecks(id, limit);

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error, {
                    allowedStatuses: [404, 500],
                    statusByMessage: { 'Deck not found': 404 },
                    codeByMessage: { 'Deck not found': 'NOT_FOUND' },
                })
            );
        }
    );

    // Get trending decks
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/marketplace/trending',
        {
            schema: {
                querystring: z.object({
                    period: z.enum(['day', 'week', 'month', 'all']).default('week'),
                    limit: z.coerce.number().int().positive().max(50).default(10),
                }),
                response: {
                    200: z.object({
                        decks: z.array(
                            z.object({
                                id: z.string(),
                                name: z.string(),
                                description: z.string().nullable(),
                                cardCount: z.number(),
                                rating: z.number(),
                                downloadCount: z.number(),
                                viewCount: z.number(),
                            })
                        ),
                        period: z.enum(['day', 'week', 'month', 'all']),
                    }),
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const { period, limit } = request.query;
            const result = await recommendationService.getTrendingDecks(period, limit);

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error)
            );
        }
    );

    // Track deck view
    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/marketplace/:id/view',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                response: {
                    200: z.object({}).strict(),
                    400: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const { id: deckId } = request.params;

            // Try to get user session for tracking
            let userId: string | undefined;
            const session = await fastify.getAuthSession(request);
            userId = session?.user?.id;
            const sessionHeader = request.headers['x-session-id'];
            const sessionId = typeof sessionHeader === 'string' ? sessionHeader : undefined;

            const result = await recommendationService.trackDeckView(deckId, userId, sessionId);
            if (result.isErr()) {
                fastify.log.warn({ error: result.error, deckId }, 'Failed to persist deck view');
            }

            // View tracking is best-effort and should not fail the user flow.
            return reply.code(200).send({});
        }
    );
};

export default searchRoute;
