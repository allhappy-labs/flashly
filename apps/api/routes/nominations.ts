import { type FastifyPluginAsyncZod, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { nominationRepository } from '../lib/nominations/nomination-repository.ts';
import { isAdmin } from '../lib/auth/admin-utils.ts';
import { routeErrorSchema, sendRouteError } from './route-error.ts';

const nominationsRoute: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
    // =========================================================================
    // NOMINATION ENDPOINTS (Auth Required)
    // =========================================================================

    // Nominate a deck for featuring
    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/decks/:id/nominate',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                body: z.object({
                    reason: z.string().min(10, 'Reason must be at least 10 characters').max(500, 'Reason is too long'),
                }),
                response: {
                    200: z.object({
                        id: z.string(),
                        deckId: z.string(),
                        userId: z.string(),
                        reason: z.string(),
                        status: z.string(),
                        createdAt: z.date(),
                    }),
                    400: routeErrorSchema,
                    401: routeErrorSchema,
                    403: routeErrorSchema,
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

            if (!isAdmin(session.user)) {
                return reply.code(403).send({
                    error: 'FORBIDDEN',
                    message: 'Admin access required.',
                });
            }

            const { id: deckId } = request.params;
            const body = request.body;
            const result = await nominationRepository.nominateDeck(deckId, session.user.id, body);

            return result.match(
                (nomination) => reply.code(200).send(nomination),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 404, 500] })
            );
        }
    );

    // Get nomination stats (public)
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/nominations/stats',
        {
            schema: {
                response: {
                    200: z.object({
                        total: z.number(),
                        pending: z.number(),
                        approved: z.number(),
                        rejected: z.number(),
                    }),
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const result = await nominationRepository.getNominationStats();

            return result.match(
                (stats) => reply.code(200).send(stats),
                (error) => sendRouteError(reply, error)
            );
        }
    );

    // Get pending nominations (admin only)
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/admin/nominations',
        {
            schema: {
                querystring: z.object({
                    limit: z.coerce.number().int().positive().max(100).default(20),
                    offset: z.coerce.number().int().nonnegative().default(0),
                }),
                response: {
                    200: z.object({
                        nominations: z.array(
                            z.object({
                                id: z.string(),
                                deckId: z.string(),
                                userId: z.string(),
                                reason: z.string(),
                                status: z.string(),
                                deckName: z.string(),
                                userName: z.string(),
                                deckRating: z.number(),
                                createdAt: z.date(),
                            })
                        ),
                        total: z.number(),
                    }),
                    401: routeErrorSchema,
                    403: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session?.user?.id) {
                return;
            }

            // Check if user is admin
            if (!isAdmin(session.user)) {
                return reply.code(403).send({
                    error: 'FORBIDDEN',
                    message: 'Admin access required.',
                });
            }

            const { limit, offset } = request.query;
            const result = await nominationRepository.getPendingNominations({ limit, offset });

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error)
            );
        }
    );

    // Review a nomination (admin only)
    fastify.withTypeProvider<ZodTypeProvider>().patch(
        '/api/admin/nominations/:id',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                body: z.object({
                    action: z.enum(['approve', 'reject']),
                }),
                response: {
                    200: z.object({}).strict(),
                    400: routeErrorSchema,
                    401: routeErrorSchema,
                    403: routeErrorSchema,
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

            // Check if user is admin
            if (!isAdmin(session.user)) {
                return reply.code(403).send({
                    error: 'FORBIDDEN',
                    message: 'Admin access required.',
                });
            }

            const { id } = request.params;
            const { action } = request.body;
            const result = await nominationRepository.reviewNomination(id, session.user.id, action);

            return result.match(
                () => reply.code(200).send({}),
                (error) => sendRouteError(reply, error, { allowedStatuses: [404, 500] })
            );
        }
    );
};

export default nominationsRoute;
