import fp from 'fastify-plugin';
import { type FastifyPluginAsync, type FastifyReply, type FastifyRequest } from 'fastify';
import { handleRequest } from '@better-upload/server';
import { uploadRouter } from '../config/upload-router.ts';
import { createAuth } from '../lib/auth/auth.ts';
import { fromNodeHeaders } from 'better-auth/node';
import { config } from '../config/app.ts';
import { createSanitizedError } from '../lib/utils/error-handling.ts';
import { fastifyToWebRequest } from '../lib/utils/request-conversion.ts';
import { safeAsync, ValidationError, AuthenticationError } from '@flashly/shared';

const uploadPlugin: FastifyPluginAsync = async (fastify) => {
    const auth = createAuth(fastify.log);
    // Unified upload handler for all routes
    const uploadHandler = async (request: FastifyRequest, reply: FastifyReply) => {
        // Check authentication before processing upload (if required)
        if (config.UPLOAD_AUTH_REQUIRED) {
            const sessionResult = await safeAsync(
                (async () => auth.api.getSession({
                    headers: fromNodeHeaders(request.headers),
                }))(),
                (error) => new AuthenticationError('Failed to validate session', { cause: error })
            );

            if (sessionResult.isErr()) {
                const sanitizedError = createSanitizedError(
                    'AUTHENTICATION_ERROR',
                    fastify.log,
                    sessionResult.error,
                    'upload-auth',
                    'AUTH_REQUIRED',
                );
                reply.status(401).send(sanitizedError);
                return;
            }

            const session = sessionResult.value;
            if (!session?.user || !session?.session) {
                const sanitizedError = createSanitizedError(
                    'AUTHENTICATION_ERROR',
                    fastify.log,
                    new AuthenticationError('Authentication required for file uploads'),
                    'upload-auth',
                    'AUTH_REQUIRED',
                );
                reply.status(401).send(sanitizedError);
                return;
            }
        }

        // Convert Fastify request to Web API request and handle upload
        const uploadResult = await safeAsync(
            (async () => {
                const webRequest = fastifyToWebRequest(request);
                const response = await handleRequest(webRequest, uploadRouter);
                const responseText = await response.text();
                return { status: response.status, headers: response.headers, text: responseText };
            })(),
            (error) => new ValidationError('Upload processing failed', { cause: error })
        );

        if (uploadResult.isErr()) {
            const sanitizedError = createSanitizedError('UPLOAD_ERROR', fastify.log, uploadResult.error, 'upload', 'UPLOAD_FAILED');
            reply.status(500).send(sanitizedError);
            return;
        }

        const { status, headers, text } = uploadResult.value;
        reply.status(status).headers(Object.fromEntries(headers.entries())).send(text);
    };

    // Register upload routes
    fastify.post('/api/upload', uploadHandler);

    // Health check endpoint
    fastify.get('/api/upload/health', async () => {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    });
};

export default fp(uploadPlugin, {
    name: 'upload',
});
