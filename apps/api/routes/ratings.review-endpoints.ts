import type { FastifyInstance } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ratingRepository } from '../lib/ratings/rating-repository.ts';
import { CreateReviewSchema, UpdateReviewSchema } from '../lib/ratings/rating-schema.ts';
import { routeErrorSchema, sendRouteError } from './route-error.ts';

export async function registerReviewEndpoints(fastify: FastifyInstance): Promise<void> {
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/decks/:id/reviews',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                querystring: z.object({
                    page: z.coerce.number().int().positive().default(1),
                    limit: z.coerce.number().int().positive().max(100).default(10),
                    sortBy: z.enum(['recent', 'helpful']).default('recent'),
                }),
                response: {
                    200: z.object({
                        reviews: z.array(
                            z.object({
                                id: z.string(),
                                deckId: z.string(),
                                userId: z.string(),
                                rating: z.number(),
                                title: z.string().nullable(),
                                content: z.string(),
                                helpfulCount: z.number(),
                                createdAt: z.date(),
                                updatedAt: z.date(),
                                authorName: z.string().nullable(),
                            })
                        ),
                        total: z.number(),
                        page: z.number(),
                        limit: z.number(),
                        totalPages: z.number(),
                    }),
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const { id: deckId } = request.params;
            const { page, limit, sortBy } = request.query;
            const result = await ratingRepository.getDeckReviews(deckId, { page, limit, sortBy });

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error)
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/decks/:id/reviews',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                body: CreateReviewSchema,
                response: {
                    200: z.object({
                        id: z.string(),
                        deckId: z.string(),
                        userId: z.string(),
                        rating: z.number(),
                        title: z.string().nullable(),
                        content: z.string(),
                        helpfulCount: z.number(),
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
            const result = await ratingRepository.createReview(deckId, session.user.id, body);

            return result.match(
                (review) => reply.code(200).send(review),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 404, 500] })
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().patch(
        '/api/reviews/:reviewId',
        {
            schema: {
                params: z.object({
                    reviewId: z.string(),
                }),
                body: UpdateReviewSchema,
                response: {
                    200: z.object({
                        id: z.string(),
                        deckId: z.string(),
                        userId: z.string(),
                        rating: z.number(),
                        title: z.string().nullable(),
                        content: z.string(),
                        helpfulCount: z.number(),
                        createdAt: z.date(),
                        updatedAt: z.date(),
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
            if (!session) {
                return;
            }

            const { reviewId } = request.params;
            const body = request.body;
            const result = await ratingRepository.updateReview(reviewId, session.user.id, body);

            return result.match(
                (review) => reply.code(200).send(review),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 404, 500] })
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().delete(
        '/api/reviews/:reviewId',
        {
            schema: {
                params: z.object({
                    reviewId: z.string(),
                }),
                response: {
                    204: z.object({}).strict(),
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

            const { reviewId } = request.params;
            const result = await ratingRepository.deleteReview(reviewId, session.user.id);

            return result.match(
                () => reply.code(204).send({}),
                (error) => sendRouteError(reply, error, { allowedStatuses: [404, 500] })
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/reviews/:reviewId/helpful',
        {
            schema: {
                params: z.object({
                    reviewId: z.string(),
                }),
                response: {
                    200: z.object({
                        id: z.string(),
                        deckId: z.string(),
                        userId: z.string(),
                        rating: z.number(),
                        title: z.string().nullable(),
                        content: z.string(),
                        helpfulCount: z.number(),
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

            const { reviewId } = request.params;
            const result = await ratingRepository.markReviewHelpful(reviewId);

            return result.match(
                (review) => reply.code(200).send(review),
                (error) => sendRouteError(reply, error, { allowedStatuses: [404, 500] })
            );
        }
    );
}
