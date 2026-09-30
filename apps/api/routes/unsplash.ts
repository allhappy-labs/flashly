import { type FastifyPluginAsyncZod, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { config } from '../config/app.ts';

const ErrorResponseSchema = z.object({
    error: z.string(),
    message: z.string(),
});

const UnsplashSearchQuerySchema = z.object({
    query: z.string().trim().min(1).max(80),
    count: z.coerce.number().int().positive().max(30).default(5),
});

const UnsplashSearchResponseSchema = z.object({
    results: z.array(
        z.object({
            id: z.string(),
            urls: z.object({
                raw: z.string().optional(),
                small: z.string().optional(),
            }).partial().optional(),
            links: z.object({
                download_location: z.string().optional(),
            }).partial().optional(),
            description: z.string().nullable().optional(),
            user: z.object({
                name: z.string().optional(),
                links: z.object({
                    html: z.string().optional(),
                }).partial().optional(),
            }).partial().optional(),
        }),
    ).default([]),
});

const UnsplashTrackBodySchema = z.object({
    downloadLocation: z.url(),
});

const UnsplashTrackResponseSchema = z.object({}).strict();

function isValidUnsplashDownloadLocation(downloadLocation: string): boolean {
    try {
        const url = new URL(downloadLocation);
        if (url.protocol !== 'https:') return false;
        if (url.hostname !== 'api.unsplash.com') return false;
        return /^\/photos\/[^/]+\/download(?:\/)?$/.test(url.pathname);
    } catch {
        return false;
    }
}

const unsplashRoute: FastifyPluginAsyncZod = async (fastify) => {
    fastify.withTypeProvider<ZodTypeProvider>().get(
        '/api/unsplash/search',
        {
            schema: {
                querystring: UnsplashSearchQuerySchema,
                response: {
                    200: UnsplashSearchResponseSchema,
                    401: ErrorResponseSchema,
                    503: ErrorResponseSchema,
                    502: ErrorResponseSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session) {
                return;
            }

            if (!config.UNSPLASH_ACCESS_KEY) {
                return reply.code(503).send({
                    error: 'UNSPLASH_NOT_CONFIGURED',
                    message: 'Unsplash is not configured on this server.',
                });
            }

            const url = new URL('https://api.unsplash.com/search/photos');
            url.searchParams.set('query', request.query.query);
            url.searchParams.set('per_page', String(request.query.count));
            url.searchParams.set('content_filter', 'high');
            url.searchParams.set('orientation', 'landscape');

            try {
                const response = await fetch(url.toString(), {
                    headers: {
                        Authorization: `Client-ID ${config.UNSPLASH_ACCESS_KEY}`,
                        'Accept-Version': 'v1',
                    },
                });

                if (!response.ok) {
                    fastify.log.warn(
                        { status: response.status, requestId: request.id },
                        'Unsplash search request failed',
                    );
                    return reply.code(502).send({
                        error: 'UNSPLASH_REQUEST_FAILED',
                        message: `Unsplash request failed with status ${response.status}.`,
                    });
                }

                const payload = await response.json();
                const parsed = UnsplashSearchResponseSchema.safeParse(payload);
                if (!parsed.success) {
                    fastify.log.warn({ requestId: request.id }, 'Invalid Unsplash search response payload');
                    return reply.code(502).send({
                        error: 'UNSPLASH_INVALID_RESPONSE',
                        message: 'Unsplash returned an invalid response.',
                    });
                }

                return reply.code(200).send(parsed.data);
            } catch (error) {
                fastify.log.error({ err: error, requestId: request.id }, 'Unsplash search proxy failed');
                return reply.code(502).send({
                    error: 'UNSPLASH_PROXY_FAILED',
                    message: 'Unable to fetch Unsplash images at this time.',
                });
            }
        },
    );

    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/unsplash/download/track',
        {
            schema: {
                body: UnsplashTrackBodySchema,
                response: {
                    200: UnsplashTrackResponseSchema,
                    400: ErrorResponseSchema,
                    401: ErrorResponseSchema,
                    503: ErrorResponseSchema,
                    502: ErrorResponseSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session) {
                return;
            }

            if (!config.UNSPLASH_ACCESS_KEY) {
                return reply.code(503).send({
                    error: 'UNSPLASH_NOT_CONFIGURED',
                    message: 'Unsplash is not configured on this server.',
                });
            }

            if (!isValidUnsplashDownloadLocation(request.body.downloadLocation)) {
                return reply.code(400).send({
                    error: 'INVALID_DOWNLOAD_LOCATION',
                    message: 'Invalid Unsplash download location.',
                });
            }

            try {
                const response = await fetch(request.body.downloadLocation, {
                    method: 'HEAD',
                    headers: {
                        Authorization: `Client-ID ${config.UNSPLASH_ACCESS_KEY}`,
                    },
                });

                if (!response.ok) {
                    fastify.log.warn(
                        { status: response.status, requestId: request.id },
                        'Unsplash download tracking request failed',
                    );
                    return reply.code(502).send({
                        error: 'UNSPLASH_TRACK_FAILED',
                        message: `Unsplash download tracking failed with status ${response.status}.`,
                    });
                }

                return reply.code(200).send({});
            } catch (error) {
                fastify.log.error({ err: error, requestId: request.id }, 'Unsplash download tracking proxy failed');
                return reply.code(502).send({
                    error: 'UNSPLASH_TRACK_PROXY_FAILED',
                    message: 'Unable to track Unsplash download at this time.',
                });
            }
        },
    );
};

export default unsplashRoute;
