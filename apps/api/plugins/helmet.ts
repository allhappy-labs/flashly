import fp from 'fastify-plugin';
import helmet, { type FastifyHelmetOptions } from '@fastify/helmet';

/**
 * Security plugin that adds various HTTP headers to help protect the app
 *
 * @see https://github.com/fastify/fastify-helmet
 */
export default fp<FastifyHelmetOptions>(async (fastify) => {
    fastify.register(helmet, {
        contentSecurityPolicy: {
            directives: {
                connectSrc: ["'self'"], defaultSrc: ["'self'"], fontSrc: ["'self'"], frameSrc: ["'none'"], imgSrc: ["'self'", 'data:', 'https:'], mediaSrc: ["'self'"], objectSrc: ["'none'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
            },
        },
        crossOriginEmbedderPolicy: false,
        hsts: {
            includeSubDomains: true, maxAge: 31536000, preload: true,
        },
    });
});
