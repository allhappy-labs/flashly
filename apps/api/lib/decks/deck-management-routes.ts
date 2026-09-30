import type { FastifyInstance } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { routeErrorSchema, sendRouteError } from '../../routes/route-error.ts';
import { deckRepository } from './deck-repository.ts';
import { UpdateDeckSchema } from './deck-schema.ts';
import {
    createDeckBodySchema,
    deckIdParamsSchema,
    deckSchema,
    deckWithCardsSchema,
    emptyResponseSchema,
    isDeckDebugEnabled,
    listDecksQuerySchema,
    paginatedDeckListSchema,
    setVisibilityBodySchema,
    toSerializableError,
} from './deck-route-shared.ts';

export async function registerDeckManagementRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/decks',
        {
            schema: {
                body: createDeckBodySchema,
                response: {
                    200: deckSchema,
                    400: routeErrorSchema,
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

            const body = request.body;
            const result = await deckRepository.createDeck(session.user.id, {
                ...body,
                visibility: body.visibility ?? 'private',
            });

            return result.match(
                (deck) => reply.code(200).send(deck),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 500] })
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/decks',
        {
            schema: {
                querystring: listDecksQuerySchema,
                response: {
                    200: paginatedDeckListSchema,
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

            const { page, limit } = request.query;
            const result = await deckRepository.listUserDecks(session.user.id, { page, limit });

            return result.match(
                (paginated) => reply.code(200).send(paginated),
                (error) => sendRouteError(reply, error)
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/decks/:id',
        {
            schema: {
                params: deckIdParamsSchema,
                response: {
                    200: deckWithCardsSchema,
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

            const { id } = request.params;
            const result = await deckRepository.getDeckById(id);

            return result.match(
                (deckWithCards) => {
                    if (deckWithCards.userId !== session.user.id && deckWithCards.visibility !== 'public') {
                        return reply.code(403).send({
                            error: 'ACCESS_DENIED',
                            message: 'You do not have access to this deck.',
                        });
                    }

                    return reply.code(200).send(deckWithCards);
                },
                (error) => sendRouteError(reply, error, { allowedStatuses: [404, 500] })
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().put(
        '/api/decks/:id',
        {
            schema: {
                params: deckIdParamsSchema,
                body: UpdateDeckSchema,
                response: {
                    200: deckSchema,
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

            const { id } = request.params;
            const body = request.body;
            const result = await deckRepository.updateDeck(id, session.user.id, body);

            return result.match(
                (deck) => reply.code(200).send(deck),
                (error) => {
                    const debugEnabled = isDeckDebugEnabled();
                    request.log.error(
                        {
                            event: 'deck_update_failed',
                            operation: 'update_deck',
                            requestId: request.id,
                            deckId: id,
                            userId: session.user.id,
                            bodyKeys: Object.keys(body ?? {}),
                            visibility: body.visibility ?? null,
                            error: toSerializableError(error, debugEnabled),
                        },
                        'Deck update failed'
                    );

                    return sendRouteError(reply, error, { allowedStatuses: [400, 403, 404, 500] });
                }
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().delete(
        '/api/decks/:id',
        {
            schema: {
                params: deckIdParamsSchema,
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

            const { id } = request.params;
            const result = await deckRepository.deleteDeck(id, session.user.id);

            return result.match(
                () => reply.code(204).send({}),
                (error) => sendRouteError(reply, error, { allowedStatuses: [403, 404, 500] })
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().patch(
        '/api/decks/:id/visibility',
        {
            schema: {
                params: deckIdParamsSchema,
                body: setVisibilityBodySchema,
                response: {
                    200: emptyResponseSchema,
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

            const { id } = request.params;
            const { visibility } = request.body;
            const result = await deckRepository.setDeckVisibility(id, session.user.id, visibility);

            return result.match(
                () => reply.code(200).send({}),
                (error) => {
                    const debugEnabled = isDeckDebugEnabled();
                    request.log.error(
                        {
                            event: 'deck_update_failed',
                            operation: 'set_deck_visibility',
                            requestId: request.id,
                            deckId: id,
                            userId: session.user.id,
                            visibility,
                            error: toSerializableError(error, debugEnabled),
                        },
                        'Deck visibility update failed'
                    );

                    return sendRouteError(reply, error, { allowedStatuses: [400, 403, 404, 500] });
                }
            );
        }
    );
}
