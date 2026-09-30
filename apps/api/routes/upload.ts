import { access } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { type FastifyPluginAsyncZod, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { uploadService } from '../lib/upload/upload-service.ts';
import { UploadImageSchema, UploadAudioSchema } from '../lib/upload/upload-schema.ts';
import { config } from '../config/app.ts';
import { buildRateLimitKey } from '../lib/utils/rate-limit-key.ts';
import { routeErrorSchema, sendRouteError } from './route-error.ts';

function getValidationMessage(result: z.ZodError): string {
    return result.issues[0]?.message ?? 'Invalid upload payload.';
}

function getWildcardParam(params: unknown): string | null {
    if (typeof params !== 'object' || params === null) {
        return null;
    }

    const value = Reflect.get(params, '*');
    return typeof value === 'string' ? value : null;
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

const uploadRoute: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
    // =========================================================================
    // UPLOAD ENDPOINTS (Auth Required)
    // =========================================================================

    // Upload image
    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/upload/image',
        {
            config: {
                rateLimit: {
                    keyGenerator: (req) => buildRateLimitKey(req, 'upload-image'),
                    max: 30,
                    timeWindow: '10 minute',
                },
            },
            schema: {
                response: {
                    200: z.object({
                        id: z.string(),
                        fileName: z.string(),
                        fileType: z.string(),
                        fileSize: z.number(),
                        storageKey: z.string(),
                        url: z.string(),
                    }),
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

            // Parse multipart form data
            const data = await request.file();
            if (!data) {
                return reply.code(400).send({
                    error: 'INVALID_REQUEST',
                    message: 'No file uploaded.',
                });
            }

            const buffer = await data.toBuffer();

            // Validate input
            const validationResult = UploadImageSchema.safeParse({
                fileName: data.filename,
                fileType: data.mimetype,
                fileSize: buffer.length,
            });

            if (!validationResult.success) {
                return reply.code(400).send({
                    error: 'VALIDATION_ERROR',
                    message: getValidationMessage(validationResult.error),
                });
            }

            const result = await uploadService.uploadImage(
                session.user.id,
                validationResult.data,
                buffer
            );

            return result.match(
                (upload) => reply.code(200).send(upload),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 500] })
            );
        }
    );

    // Upload audio
    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/upload/audio',
        {
            config: {
                rateLimit: {
                    keyGenerator: (req) => buildRateLimitKey(req, 'upload-audio'),
                    max: 30,
                    timeWindow: '10 minute',
                },
            },
            schema: {
                response: {
                    200: z.object({
                        id: z.string(),
                        fileName: z.string(),
                        fileType: z.string(),
                        fileSize: z.number(),
                        storageKey: z.string(),
                        url: z.string(),
                    }),
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

            // Parse multipart form data
            const data = await request.file();
            if (!data) {
                return reply.code(400).send({
                    error: 'INVALID_REQUEST',
                    message: 'No file uploaded.',
                });
            }

            const buffer = await data.toBuffer();

            // Validate input
            const validationResult = UploadAudioSchema.safeParse({
                fileName: data.filename,
                fileType: data.mimetype,
                fileSize: buffer.length,
            });

            if (!validationResult.success) {
                return reply.code(400).send({
                    error: 'VALIDATION_ERROR',
                    message: getValidationMessage(validationResult.error),
                });
            }

            const result = await uploadService.uploadAudio(
                session.user.id,
                validationResult.data,
                buffer
            );

            return result.match(
                (upload) => reply.code(200).send(upload),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 500] })
            );
        }
    );

    // Delete uploaded file
    fastify.withTypeProvider<ZodTypeProvider>().delete(
        '/api/upload/:id',
        {
            config: {
                rateLimit: {
                    keyGenerator: (req) => buildRateLimitKey(req, 'upload-delete'),
                    max: 60,
                    timeWindow: '10 minute',
                },
            },
            schema: {
                params: z.object({
                    id: z.string(),
                }),
                response: {
                    200: z.object({
                        success: z.boolean(),
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

            const { id: uploadId } = request.params;
            const result = await uploadService.deleteFileForUser(session.user.id, uploadId);

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error, { allowedStatuses: [400, 404, 500] })
            );
        }
    );

    // Serve uploaded files (static file route)
    fastify.get('/uploads/*', {
        config: {
            rateLimit: {
                keyGenerator: (req) => buildRateLimitKey(req, 'upload-download'),
                max: config.UPLOAD_DOWNLOAD_RATE_LIMIT_MAX,
                timeWindow: '1 minute',
            },
        },
    }, async (request, reply) => {
        const session = await fastify.requireAuthSession(request, reply);
        if (!session?.user?.id) {
            return;
        }

        const filePath = getWildcardParam(request.params);
        if (!filePath) {
            return reply.code(400).send('Invalid path');
        }

        // Security: Prevent path traversal attacks
        // 1. Normalize and validate the path
        const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
        if (normalizedPath.length === 0 || normalizedPath.includes('..')) {
            return reply.code(403).send('Access denied');
        }

        const pathSegments = normalizedPath.split('/').filter(Boolean);
        if (pathSegments.length < 2) {
            return reply.code(403).send('Access denied');
        }

        const ownerId = pathSegments[0];
        if (ownerId !== session.user.id) {
            return reply.code(403).send('Access denied');
        }

        const sanitizedPath = pathSegments.join('/');

        // 2. Resolve to absolute path and verify it's within upload directory
        const uploadDir = resolve(process.env.UPLOAD_DIR || './uploads');
        const fullPath = resolve(uploadDir, sanitizedPath);
        const uploadDirPrefix = `${uploadDir}/`;

        // 3. Verify the resolved path is still within upload directory
        if (fullPath !== uploadDir && !fullPath.startsWith(uploadDirPrefix)) {
            return reply.code(403).send('Access denied');
        }

        // 4. Validate file extension against whitelist
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp3', 'wav', 'ogg', 'm4a'];
        const ext = sanitizedPath.split('.').pop()?.toLowerCase();
        if (!ext || !allowedExtensions.includes(ext)) {
            return reply.code(403).send('Invalid file type');
        }

        try {
            const fileExists = await pathExists(fullPath);
            if (!fileExists) {
                return reply.code(404).send('File not found');
            }

            // Determine content type
            const contentTypes: Record<string, string> = {
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                png: 'image/png',
                gif: 'image/gif',
                webp: 'image/webp',
                mp3: 'audio/mpeg',
                wav: 'audio/wav',
                ogg: 'audio/ogg',
                m4a: 'audio/mp4',
            };

            const contentType = contentTypes[ext || ''] || 'application/octet-stream';
            reply.type(contentType);

            return reply.send(createReadStream(fullPath));
        } catch  {
            return reply.code(500).send('Internal server error');
        }
    });
};

export default uploadRoute;
