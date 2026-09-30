import type { FastifyInstance } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { deckRepository } from '../decks/deck-repository.ts';
import { routeErrorSchema, sendRouteError } from '../../routes/route-error.ts';
import {
    attachAddedStateToDecks,
    attachAuthorsToDecks,
    cardSchema,
    getOptionalSessionUserId,
    marketplaceDeckSchema,
} from './marketplace-route-shared.ts';

export async function registerMarketplacePublicRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/marketplace',
        {
            schema: {
                querystring: z.object({
                    materialType: z.string().optional(),
                    deckType: z.string().optional(),
                    locale: z.string().optional(),
                    level: z.string().optional(),
                    skill: z.string().optional(),
                    regionalVariant: z.string().optional(),
                    hasAudio: z.preprocess((value) => {
                        if (value === true || value === 'true') return true;
                        if (value === false || value === 'false') return false;
                        return value;
                    }, z.boolean()).optional(),
                    script: z.string().optional(),
                    romanization: z.enum([
                        'native_only',
                        'with_romanization',
                        'romanized_only',
                    ]).optional(),
                    licenseCode: z.string().optional(),
                    search: z.string().optional(),
                    sortBy: z.enum([
                        'newest',
                        'most_downloaded',
                        'most_viewed',
                        'created',
                        'updated',
                        'name',
                        'downloadCount',
                        'viewCount',
                    ]).optional(),
                    sortOrder: z.enum(['asc', 'desc']).optional(),
                    page: z.coerce.number().int().positive().default(1),
                    limit: z.coerce.number().int().positive().max(100).default(20),
                }),
                response: {
                    200: z.object({
                        items: z.array(marketplaceDeckSchema),
                        total: z.number(),
                        page: z.number(),
                        limit: z.number(),
                        totalPages: z.number(),
                        hasMore: z.boolean(),
                    }),
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const currentUserId = await getOptionalSessionUserId(fastify, request);
            const result = await deckRepository.listMarketplaceDecks({
                materialType: request.query.materialType,
                deckType: request.query.deckType,
                locale: request.query.locale,
                level: request.query.level,
                skill: request.query.skill,
                regionalVariant: request.query.regionalVariant,
                hasAudio: request.query.hasAudio,
                script: request.query.script,
                romanization: request.query.romanization,
                licenseCode: request.query.licenseCode,
                search: request.query.search,
                sortBy: request.query.sortBy,
                sortOrder: request.query.sortOrder,
                page: request.query.page,
                limit: request.query.limit,
            });

            return result.match(
                async (paginated) => {
                    const decksWithAddedState = await attachAddedStateToDecks(paginated.items, currentUserId);
                    const decksWithAuthors = await attachAuthorsToDecks(decksWithAddedState);
                    return reply.code(200).send({
                        ...paginated,
                        items: decksWithAuthors,
                    });
                },
                (error) => sendRouteError(reply, error)
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/marketplace/featured',
        {
            schema: {
                querystring: z.object({
                    limit: z.coerce.number().int().positive().max(50).default(10),
                }),
                response: {
                    200: z.array(marketplaceDeckSchema),
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const currentUserId = await getOptionalSessionUserId(fastify, request);
            const result = await deckRepository.getFeaturedDecks(request.query.limit);

            return result.match(
                async (decks) => {
                    const decksWithAddedState = await attachAddedStateToDecks(decks, currentUserId);
                    const decksWithAuthors = await attachAuthorsToDecks(decksWithAddedState);
                    return reply.code(200).send(decksWithAuthors);
                },
                (error) => sendRouteError(reply, error)
            );
        }
    );

    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/marketplace/:id',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                response: {
                    200: marketplaceDeckSchema.extend({
                        cards: z.array(cardSchema),
                    }),
                    403: routeErrorSchema,
                    404: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const currentUserId = await getOptionalSessionUserId(fastify, request);
            const result = await deckRepository.getDeckById(request.params.id);

            return result.match(
                async (deckWithCards) => {
                    if (deckWithCards.visibility !== 'public') {
                        return reply.code(403).send({
                            error: 'ACCESS_DENIED',
                            message: 'This deck is not publicly available.',
                        });
                    }

                    await deckRepository.incrementViewCount(request.params.id);

                    const normalizedDeck = {
                        ...deckWithCards,
                        cardCount: Array.isArray(deckWithCards.cards) ? deckWithCards.cards.length : 0,
                    };
                    const [deckWithAddedState] = await attachAddedStateToDecks([normalizedDeck], currentUserId);
                    const [deckWithAuthor] = await attachAuthorsToDecks([deckWithAddedState]);
                    return reply.code(200).send(deckWithAuthor);
                },
                (error) => sendRouteError(reply, error, { allowedStatuses: [404, 500] })
            );
        }
    );
}
