import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import AutoLoad, { type AutoloadPluginOptions } from '@fastify/autoload';
import type { FastifyPluginAsync, FastifyServerOptions } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { createAuth } from './lib/auth/auth.ts';
import fastifyCors from '@fastify/cors';
import { config } from './config/app.ts';
import { createSanitizedError } from './lib/utils/error-handling.ts';
import { fastifyToWebRequest } from './lib/utils/request-conversion.ts';
import { safeAsync, ExternalServiceError } from '@flashly/shared';

const appFilePath = fileURLToPath(import.meta.url);
const appDirectoryPath = dirname(appFilePath);

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {
    trustProxy: config.TRUST_PROXY,
};

const app: FastifyPluginAsync<AppOptions> = async (fastify, opts): Promise<void> => {
    // Add Zod type provider support
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);

    // Configure CORS policies (must be registered before routes)
    await fastify.register(fastifyCors, {
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-E2E-Auth-Secret'], credentials: true, maxAge: 86400, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], origin: (origin, callback) => {
            if (!origin) {
                // Allow requests without origin (direct browser navigation, so magic links work)
                return callback(null, true);
            }

            // Check if the origin is in our allowed list
            if (config.CLIENT_ORIGIN.includes(origin)) {
                return callback(null, true);
            }

            // Reject the origin
            return callback(new Error('Not allowed by CORS'), false);
        },
    });

    const auth = createAuth(fastify.log);

    // Register authentication endpoint
    fastify.route({
        async handler(request, reply) {
            const authResult = await safeAsync(
                (async () => {
                    // Convert Fastify request to Web API request
                    const req = fastifyToWebRequest(request);

                    // Process authentication request
                    const response = await auth.handler(req);

                    // Forward response to client
                    reply.status(response.status);
                    for (const [key, value] of response.headers) {
                        reply.header(key, value);
                    }
                    reply.send(response.body ? await response.text() : null);
                })(),
                (error) => new ExternalServiceError('Authentication request processing failed', 'better-auth', { cause: error })
            );

            if (authResult.isErr()) {
                const sanitizedError = createSanitizedError(
                    'AUTHENTICATION_ERROR',
                    fastify.log,
                    authResult.error,
                    'auth-handler',
                    'AUTH_FAILURE',
                );
                reply.status(500).send(sanitizedError);
            }
        }, method: ['GET', 'POST'], url: '/api/auth/*',
    });

    // Do not touch the following lines

    // This loads all plugins defined in plugins
    // those should be support plugins that are reused
    // through your application
    await fastify.register(AutoLoad, {
        dir: join(appDirectoryPath, 'plugins'),
        options: opts,
    });

    // This loads all plugins defined in routes
    // define your routes in one of these
    await fastify.register(AutoLoad, {
        dir: join(appDirectoryPath, 'routes'),
        options: opts,
    });
};

export default app;
export { app, options };
