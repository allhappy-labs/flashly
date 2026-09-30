import fp from 'fastify-plugin';
import * as Sentry from '@sentry/node';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config/app.ts';

const REDACTED_HEADER_NAMES = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'x-e2e-auth-secret',
    'x-api-key',
]);

function sanitizeHeaders(headers: FastifyRequest['headers']): Record<string, string | string[]> {
    const sanitized: Record<string, string | string[]> = {};

    for (const [headerName, headerValue] of Object.entries(headers)) {
        if (headerValue === undefined) {
            continue;
        }

        if (REDACTED_HEADER_NAMES.has(headerName.toLowerCase())) {
            sanitized[headerName] = '[REDACTED]';
            continue;
        }

        if (Array.isArray(headerValue)) {
            sanitized[headerName] = headerValue.map((value) => String(value));
            continue;
        }

        sanitized[headerName] = String(headerValue);
    }

    return sanitized;
}

/**
 * Sentry error tracking and performance monitoring
 *
 * @see https://docs.sentry.io/platforms/node/
 */
export default fp(async (fastify: FastifyInstance) => {
    // Initialize Sentry if DSN is provided
    if (config.SENTRY_DSN) {
        Sentry.init({
            dsn: config.SENTRY_DSN, environment: config.NODE_ENV, integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()], tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 1,
        });

        // Add Sentry request handler
        fastify.addHook('onRequest', async (request) => {
            Sentry.setContext('request', {
                headers: sanitizeHeaders(request.headers),
                ip: request.ip,
                method: request.method,
                url: request.url,
            });
        });

        // Add Sentry error handler
        fastify.addHook('onError', async (request, reply, error) => {
            Sentry.captureException(error, {
                extra: {
                    headers: sanitizeHeaders(request.headers),
                    params: request.params,
                    query: request.query,
                },
                tags: {
                    method: request.method,
                    url: request.url,
                },
            });
        });

        // Add Sentry to Fastify instance for manual error reporting
        fastify.decorate('sentry', Sentry);

        fastify.log.info('Sentry error tracking initialized');
    } else {
        fastify.log.warn('Sentry DSN not provided, error tracking disabled');
    }
});
