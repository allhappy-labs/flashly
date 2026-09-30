import { type FastifyPluginAsyncZod, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
    categoryRepository,
    type CategoryTree,
} from '../lib/categories/category-repository.ts';
import { routeErrorSchema, sendRouteError } from './route-error.ts';

const categoryTreeResponseSchema: z.ZodType<CategoryTree> = z.lazy(() =>
    z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        description: z.string().nullable(),
        parentId: z.string().nullable(),
        icon: z.string().nullable(),
        displayOrder: z.number(),
        deckCount: z.number(),
        children: z.array(categoryTreeResponseSchema),
    })
);

const categoriesRoute: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
    // =========================================================================
    // CATEGORY ENDPOINTS (Public)
    // =========================================================================

    // Get all categories (flat list)
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/categories',
        {
            schema: {
                response: {
                    200: z.array(
                        z.object({
                            id: z.string(),
                            name: z.string(),
                            slug: z.string(),
                            description: z.string().nullable(),
                            parentId: z.string().nullable(),
                            icon: z.string().nullable(),
                            displayOrder: z.number(),
                            deckCount: z.number(),
                            createdAt: z.date(),
                        })
                    ),
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const result = await categoryRepository.getAllCategories();

            return result.match(
                (categories) => reply.code(200).send(categories),
                (error) => sendRouteError(reply, error)
            );
        }
    );

    // Get category tree
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/categories/tree',
        {
            schema: {
                response: {
                    200: z.array(categoryTreeResponseSchema),
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const result = await categoryRepository.getCategoryTree();

            return result.match(
                (tree) => reply.code(200).send(tree),
                (error) => sendRouteError(reply, error)
            );
        }
    );

    // Get single category by slug
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/categories/:slug',
        {
            schema: {
                params: z.object({
                    slug: z.string(),
                }),
                response: {
                    200: z.object({
                        id: z.string(),
                        name: z.string(),
                        slug: z.string(),
                        description: z.string().nullable(),
                        parentId: z.string().nullable(),
                        icon: z.string().nullable(),
                        displayOrder: z.number(),
                        deckCount: z.number(),
                        createdAt: z.date(),
                    }),
                    404: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const { slug } = request.params as { slug: string };
            const result = await categoryRepository.getCategoryBySlug(slug);

            return result.match(
                (category) => reply.code(200).send(category),
                (error) => sendRouteError(reply, error, { allowedStatuses: [404, 500] })
            );
        }
    );

    // Get decks in a category
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/categories/:slug/decks',
        {
            schema: {
                params: z.object({
                    slug: z.string(),
                }),
                querystring: z.object({
                    limit: z.coerce.number().int().positive().max(100).default(20),
                    offset: z.coerce.number().int().nonnegative().default(0),
                    includeSubcategories: z.coerce.boolean().default(true),
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
                                viewCount: z.number(),
                            })
                        ),
                        total: z.number(),
                    }),
                    404: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const { slug } = request.params as { slug: string };
            const { limit, offset, includeSubcategories } = request.query as {
                limit: number;
                offset: number;
                includeSubcategories: boolean;
            };
            const result = await categoryRepository.getCategoryDecks(slug, {
                limit,
                offset,
                includeSubcategories,
            });

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error, { allowedStatuses: [404, 500] })
            );
        }
    );
};

export default categoriesRoute;
