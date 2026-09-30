import fp from 'fastify-plugin';
import { type FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';

export interface ZodValidationPluginOptions {}

const zodValidationPlugin: FastifyPluginAsync<ZodValidationPluginOptions> = async (fastify) => {
    fastify.setErrorHandler((error, request, reply) => {
        if (error instanceof ZodError) {
            return reply.status(400).send({
                details: error.issues.map((issue) => ({
                    code: issue.code, field: issue.path.join('.'), message: issue.message,
                })), error: 'Validation Error', message: 'Invalid request data',
            });
        }

        // Forward to default error handler for other errors
        reply.send(error);
    });
};

export default fp(zodValidationPlugin, {
    name: 'zod-validation',
});
