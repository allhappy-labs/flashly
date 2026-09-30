import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { pgPool } from '../db/db.ts';
import { config } from '../config/app.ts';

let poolClosed = false;

export default fp(async (fastify: FastifyInstance) => {
    fastify.addHook('onClose', async () => {
        if (poolClosed) {
            return;
        }

        // Tests may spin app instances up/down in one process; keep the shared pool reusable there.
        if (config.NODE_ENV === 'test') {
            fastify.log.debug('Skipping PG pool shutdown in test environment');
            return;
        }

        await pgPool.end();
        poolClosed = true;
        fastify.log.info('PostgreSQL pool closed');
    });
});
