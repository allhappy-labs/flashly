import type { FastifyInstance } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { deckRepository } from '../decks/deck-repository.ts';
import {
    createMarketplaceCloneLogger,
    logMarketplaceCloneFailure,
    logMarketplaceCloneStart,
    logMarketplaceCloneSuccess,
} from '../utils/marketplace-clone-logger.ts';
import { routeErrorSchema, sendRouteError } from '../../routes/route-error.ts';
import {
    attachAddedStateToDecks,
    attachAuthorsToDecks,
    cardSchema,
    marketplaceDeckSchema,
} from './marketplace-route-shared.ts';

export async function registerMarketplaceCloneRoute(fastify: FastifyInstance): Promise<void> {
    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/marketplace/:id/clone',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                response: {
                    200: marketplaceDeckSchema.extend({
                        cards: z.array(cardSchema),
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

            const cloneLogger = createMarketplaceCloneLogger(fastify.log, {
                requestId: request.id,
                deckId: request.params.id,
                userId: session.user.id,
            });

            logMarketplaceCloneStart(cloneLogger);
            const result = await deckRepository.cloneDeck(request.params.id, session.user.id);

            return result.match(
                async (clonedDeck) => {
                    const normalizedDeck = {
                        ...clonedDeck,
                        cardCount: Array.isArray(clonedDeck.cards) ? clonedDeck.cards.length : 0,
                    };
                    const [deckWithAddedState] = await attachAddedStateToDecks([normalizedDeck], session.user.id);
                    const [deckWithAuthor] = await attachAuthorsToDecks([deckWithAddedState]);
                    logMarketplaceCloneSuccess(cloneLogger, clonedDeck.id);
                    return reply.code(200).send(deckWithAuthor);
                },
                (error) => {
                    logMarketplaceCloneFailure(cloneLogger, error);
                    if (error.code === 'NOT_FOUND') {
                        return sendRouteError(reply, error, { allowedStatuses: [404] });
                    }
                    return reply.code(500).send({
                        error: 'SERVER_ERROR',
                        message: 'Unable to add this deck right now.',
                    });
                }
            );
        }
    );
}
