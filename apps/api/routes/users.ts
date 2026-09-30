import { type FastifyPluginAsyncZod, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { userRepository } from '../lib/users/user-repository.ts';
import { routeErrorSchema, sendRouteError } from './route-error.ts';

function toUserProfileResponse(profile: {
        id: string;
        name: string;
        username: string | null;
        image?: string | null;
        bio?: string | null;
        website?: string | null;
        twitterHandle?: string | null;
        followerCount?: number;
        deckCount?: number;
        totalDownloads?: number;
        isFollowing?: boolean;
    }) {
    return {
        ...profile,
        bio: profile.bio ?? null,
        deckCount: profile.deckCount ?? 0,
        followerCount: profile.followerCount ?? 0,
        image: profile.image ?? null,
        totalDownloads: profile.totalDownloads ?? 0,
        twitterHandle: profile.twitterHandle ?? null,
        website: profile.website ?? null,
    };
}

const usersRoute: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
    // =========================================================================
    // USER PROFILE ENDPOINTS
    // =========================================================================

    // Get user profile (public)
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/users/:id',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                response: {
                    200: z.object({
                        id: z.string(),
                        name: z.string(),
                        username: z.string().nullable(),
                        image: z.string().nullable(),
                        bio: z.string().nullable(),
                        website: z.string().nullable(),
                        twitterHandle: z.string().nullable(),
                        followerCount: z.number(),
                        isFollowing: z.boolean().optional(),
                        deckCount: z.number(),
                        totalDownloads: z.number(),
                    }),
                    404: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const { id: userId } = request.params;

            // Check if requester is following this user
            const session = await fastify.getAuthSession(request);

            const result = await userRepository.getUserById(userId);

            return result.match(
                async (profile) => {
                    let finalProfile = toUserProfileResponse(profile);

                    // Check follow status if logged in
                    if (session?.user?.id) {
                        const isFollowingResult = await userRepository.isFollowing(
                            session.user.id,
                            userId
                        );
                        isFollowingResult.match(
                            (isFollowing) => {
                                finalProfile = { ...finalProfile, isFollowing };
                            },
                            () => {
                                // Ignore error, continue without follow status
                            }
                        );
                    }

                    return reply.code(200).send(finalProfile);
                },
                (error) => {
                    return sendRouteError(reply, error, { allowedStatuses: [404, 500] });
                }
            );
        }
    );

    // Update user profile (auth required)
    fastify.withTypeProvider<ZodTypeProvider>().patch(
        '/api/users/:id',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                body: z.object({
                    bio: z.string().optional(),
                    website: z.string().optional(),
                    twitterHandle: z.string().optional(),
                }),
                response: {
                    200: z.object({
                        id: z.string(),
                        name: z.string(),
                        bio: z.string().nullable(),
                        website: z.string().nullable(),
                        twitterHandle: z.string().nullable(),
                        followerCount: z.number(),
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

            const { id: userId } = request.params;
            const body = request.body;

            // Verify user is updating their own profile
            if (session.user.id !== userId) {
                return reply.code(403).send({
                    error: 'FORBIDDEN',
                    message: 'You can only update your own profile.',
                });
            }

            const result = await userRepository.updateUserProfile(userId, body);

            return result.match(
                (user) => reply.code(200).send(user),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 404, 500] })
            );
        }
    );

    // Get user's public decks
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/users/:id/decks',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                querystring: z.object({
                    limit: z.coerce.number().int().positive().max(100).default(20),
                    offset: z.coerce.number().int().nonnegative().default(0),
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
                                createdAt: z.date(),
                            })
                        ),
                        total: z.number(),
                    }),
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const { id: userId } = request.params;
            const { limit, offset } = request.query;
            const result = await userRepository.getUserDecks(userId, { limit, offset });

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error)
            );
        }
    );

    // =========================================================================
    // FOLLOW ENDPOINTS
    // =========================================================================

    // Follow user
    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/users/:id/follow',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                response: {
                    200: z.object({}).strict(),
                    400: routeErrorSchema,
                    401: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session?.user?.id) {
                return;
            }

            const { id: followingId } = request.params;
            const result = await userRepository.followUser(session.user.id, followingId);

            return result.match(
                () => reply.code(200).send({}),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 500] })
            );
        }
    );

    // Unfollow user
    fastify.withTypeProvider<ZodTypeProvider>().delete(
        '/api/users/:id/follow',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                response: {
                    200: z.object({}).strict(),
                    400: routeErrorSchema,
                    401: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session?.user?.id) {
                return;
            }

            const { id: followingId } = request.params;
            const result = await userRepository.unfollowUser(session.user.id, followingId);

            return result.match(
                () => reply.code(200).send({}),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 500] })
            );
        }
    );

    // Get user's followers
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/users/:id/followers',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                querystring: z.object({
                    limit: z.coerce.number().int().positive().max(100).default(20),
                    offset: z.coerce.number().int().nonnegative().default(0),
                }),
                response: {
                    200: z.object({
                        users: z.array(
                            z.object({
                                id: z.string(),
                                name: z.string(),
                                username: z.string().nullable(),
                                image: z.string().nullable(),
                                bio: z.string().nullable(),
                            })
                        ),
                        total: z.number(),
                    }),
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const { id: userId } = request.params;
            const { limit, offset } = request.query;
            const result = await userRepository.getFollowers(userId, { limit, offset });

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error)
            );
        }
    );

    // Get user's following
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/users/:id/following',
        {
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                querystring: z.object({
                    limit: z.coerce.number().int().positive().max(100).default(20),
                    offset: z.coerce.number().int().nonnegative().default(0),
                }),
                response: {
                    200: z.object({
                        users: z.array(
                            z.object({
                                id: z.string(),
                                name: z.string(),
                                username: z.string().nullable(),
                                image: z.string().nullable(),
                                bio: z.string().nullable(),
                            })
                        ),
                        total: z.number(),
                    }),
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const { id: userId } = request.params;
            const { limit, offset } = request.query;
            const result = await userRepository.getFollowing(userId, { limit, offset });

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error)
            );
        }
    );
};

export default usersRoute;
