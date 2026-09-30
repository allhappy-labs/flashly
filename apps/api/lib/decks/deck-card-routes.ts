import type { FastifyInstance } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { routeErrorSchema, sendRouteError } from '../../routes/route-error.ts';
import { deckRepository } from './deck-repository.ts';
import {
    bulkCreateCardsResponseSchema,
    bulkDeleteCardsBodySchema,
    bulkUpdateCardsBodySchema,
    bulkUpdateCardQuizzesBodySchema,
    cardSchema,
    countResponseSchema,
    createCardBodySchema,
    deckCardParamsSchema,
    deckIdParamsSchema,
    emptyResponseSchema,
    isBulkCardCreateBody,
    updateCardBodySchema,
} from './deck-route-shared.ts';

export async function registerDeckCardRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/decks/:id/cards',
        {
            schema: {
                params: deckIdParamsSchema,
                body: createCardBodySchema,
                response: {
                    200: z.union([cardSchema, bulkCreateCardsResponseSchema]),
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

            const { id: deckId } = request.params;
            const body = request.body;
            const result = isBulkCardCreateBody(body)
                ? await deckRepository.bulkCreateCards(deckId, session.user.id, body.cards)
                : await deckRepository.createCard(deckId, session.user.id, body);

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 403, 404, 500] })
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().put(
        '/api/decks/:id/cards/:cardId',
        {
            schema: {
                params: deckCardParamsSchema,
                body: updateCardBodySchema,
                response: {
                    200: cardSchema,
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

            const { id: deckId, cardId } = request.params;
            const body = request.body;
            const result = await deckRepository.updateCard(cardId, deckId, session.user.id, body);

            return result.match(
                (card) => reply.code(200).send(card),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 403, 404, 500] })
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().delete(
        '/api/decks/:id/cards/:cardId',
        {
            schema: {
                params: deckCardParamsSchema,
                response: {
                    204: emptyResponseSchema,
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

            const { id: deckId, cardId } = request.params;
            const result = await deckRepository.deleteCard(cardId, deckId, session.user.id);

            return result.match(
                () => reply.code(204).send({}),
                (error) => sendRouteError(reply, error, { allowedStatuses: [403, 404, 500] })
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/decks/:id/cards/bulk/delete',
        {
            schema: {
                params: deckIdParamsSchema,
                body: bulkDeleteCardsBodySchema,
                response: {
                    200: countResponseSchema,
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

            const { id: deckId } = request.params;
            const { cardIds } = request.body;
            const result = await deckRepository.bulkDeleteCards(cardIds, deckId, session.user.id);

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 403, 404, 500] })
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/decks/:id/cards/bulk/update',
        {
            schema: {
                params: deckIdParamsSchema,
                body: bulkUpdateCardsBodySchema,
                response: {
                    200: countResponseSchema,
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

            const { id: deckId } = request.params;
            const { cardIds, ...updates } = request.body;
            const result = await deckRepository.bulkUpdateCards(cardIds, deckId, session.user.id, updates);

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 403, 404, 500] })
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/decks/:id/cards/bulk/quiz',
        {
            schema: {
                params: deckIdParamsSchema,
                body: bulkUpdateCardQuizzesBodySchema,
                response: {
                    200: countResponseSchema,
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

            const { id: deckId } = request.params;
            const result = await deckRepository.bulkUpdateCardQuizzes(
                request.body.updates,
                deckId,
                session.user.id,
            );

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 403, 404, 500] })
            );
        }
    );
}
