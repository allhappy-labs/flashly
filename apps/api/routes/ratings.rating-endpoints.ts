import type { FastifyInstance } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ratingRepository } from '../lib/ratings/rating-repository.ts';
import { CreateRatingSchema } from '../lib/ratings/rating-schema.ts';
import { routeErrorSchema, sendRouteError } from './route-error.ts';

export async function registerRatingEndpoints(fastify: FastifyInstance): Promise<void> {
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/decks/:id/ratings',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                response: {
                    200: z.object({
                        averageRating: z.number(),
                        totalRatings: z.number(),
                        distribution: z.object({
                            1: z.number(),
                            2: z.number(),
                            3: z.number(),
                            4: z.number(),
                            5: z.number(),
                        }),
                    }),
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const { id: deckId } = request.params;
            const result = await ratingRepository.getDeckRatingStats(deckId);

            return result.match(
                (stats) => reply.code(200).send(stats),
                (error) => sendRouteError(reply, error)
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/decks/:id/ratings/user',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                response: {
                    200: z.object({
                        id: z.string(),
                        deckId: z.string(),
                        userId: z.string(),
                        rating: z.number(),
                        createdAt: z.date(),
                        updatedAt: z.date(),
                    }),
                    401: routeErrorSchema,
                    404: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session) {
                return;
            }

            const { id: deckId } = request.params;
            const result = await ratingRepository.getUserRating(deckId, session.user.id);

            return result.match(
                (rating) => {
                    if (!rating) {
                        return reply.code(404).send({
                            error: 'NOT_FOUND',
                            message: 'Rating not found',
                        });
                    }
                    return reply.code(200).send(rating);
                },
                (error) => sendRouteError(reply, error)
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/decks/:id/ratings',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                body: CreateRatingSchema,
                response: {
                    200: z.object({
                        id: z.string(),
                        deckId: z.string(),
                        userId: z.string(),
                        rating: z.number(),
                        createdAt: z.date(),
                        updatedAt: z.date(),
                    }),
                    400: routeErrorSchema,
                    401: routeErrorSchema,
                    404: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session) {
                return;
            }

            const { id: deckId } = request.params;
            const body = request.body;
            const result = await ratingRepository.upsertRating(deckId, session.user.id, body);

            return result.match(
                (rating) => reply.code(200).send(rating),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 404, 500] })
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().delete(
        '/api/decks/:id/ratings',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                response: {
                    204: z.object({}).strict(),
                    401: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session) {
                return;
            }

            const { id: deckId } = request.params;
            const result = await ratingRepository.deleteRating(deckId, session.user.id);

            return result.match(
                () => reply.code(204).send({}),
                (error) => sendRouteError(reply, error)
            );
        }
    );
}
