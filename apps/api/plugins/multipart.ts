import fp from 'fastify-plugin';
import multipart, { type FastifyMultipartOptions } from '@fastify/multipart';
import { config } from '../config/app.ts';

/**
 * Plugin for handling multipart/form-data (file uploads)
 *
 * @see https://github.com/fastify/fastify-multipart
 */
export default fp<FastifyMultipartOptions>(async (fastify) => {
    fastify.register(multipart, {
        attachFieldsToBody: 'keyValues', limits: {
            fieldNameSize: 100,
            fieldSize: 100,
            fields: 10,
            fileSize: config.UPLOAD_SIZE_LIMIT,
            files: 5,
            headerPairs: 2000,
        }, onFile: async (part) => {
            // Log file upload attempts
            fastify.log.info(`File upload: ${part.filename} (${part.mimetype})`);
        },
    });
});
