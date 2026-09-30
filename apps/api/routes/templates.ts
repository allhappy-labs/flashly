import { type FastifyPluginAsyncZod, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { templateRepository } from '../lib/templates/template-repository.ts';
import { routeErrorSchema, sendRouteError } from './route-error.ts';

const templatesRoute: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
    // =========================================================================
    // TEMPLATE ENDPOINTS
    // =========================================================================

    // Get all templates (public)
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/templates',
        {
            schema: {
                response: {
                    200: z.array(
                        z.object({
                            id: z.string(),
                            name: z.string(),
                            description: z.string().nullable(),
                            materialType: z.string().nullable(),
                            deckType: z.string().nullable(),
                            locale: z.string().nullable(),
                            cardCount: z.number(),
                            downloadCount: z.number(),
                            previewCards: z.array(
                                z.object({
                                    front: z.string(),
                                    back: z.string(),
                                    imageUrl: z.string().nullable(),
                                    category: z.string().nullable(),
                                })
                            ),
                        })
                    ),
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const result = await templateRepository.getTemplates();

            return result.match(
                (templates) => reply.code(200).send(templates),
                (error) => sendRouteError(reply, error)
            );
        }
    );

    // Create deck from template (auth required)
    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/decks/from-template/:templateId',
        {
            schema: {
                params: z.object({
                    templateId: z.string(),
                }),
                body: z.object({
                    name: z.string().min(1).max(200),
                    description: z.string().optional(),
                }),
                response: {
                    200: z.object({
                        id: z.string(),
                        name: z.string(),
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
            if (!session?.user?.id) {
                return;
            }

            const { templateId } = request.params;
            const body = request.body;
            const result = await templateRepository.createFromTemplate(session.user.id, {
                templateId,
                ...body,
            });

            return result.match(
                (deck) => reply.code(200).send(deck),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 404, 500] })
            );
        }
    );

    // Create template from deck (admin only - for now, auth required)
    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/decks/:id/template',
        {
            schema: {
                params: z.object({
                    id: z.string(),
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

            const { id: deckId } = request.params;
            const result = await templateRepository.createTemplate(deckId, session.user.id);

            return result.match(
                () => reply.code(200).send({}),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 404, 500] })
            );
        }
    );
};

export default templatesRoute;
