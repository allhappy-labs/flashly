import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import closeWithGrace from 'close-with-grace';

/**
 * Graceful shutdown plugin using close-with-grace
 * Handles SIGINT, SIGTERM, and other shutdown signals gracefully
 *
 * @see https://www.npmjs.com/package/close-with-grace
 */
export default fp(async (fastify: FastifyInstance) => {
    // Register graceful shutdown handler
    const closeListeners = closeWithGrace(
        {
            delay: 10000, // 10 seconds grace period
            logger: {
                error: (message: string) => fastify.log.error(`[graceful-shutdown] ${message}`),
            },
        },
        async ({ signal, err }) => {
            if (err) {
                fastify.log.error({ err }, 'Server closing due to error');
            } else {
                fastify.log.info(`Received ${signal}, initiating graceful shutdown`);
            }

            try {
                // Close Fastify server gracefully
                await fastify.close();
                fastify.log.info('Server closed gracefully');
            } catch (error) {
                fastify.log.error({ error }, 'Error during server shutdown');
                throw error;
            }
        },
    );

    // Clean up listeners when Fastify closes
    fastify.addHook('onClose', async () => {
        closeListeners.uninstall();
    });

    fastify.log.info('Graceful shutdown handler registered');
});
