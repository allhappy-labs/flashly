import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

const root: FastifyPluginAsyncZod = async (fastify, _opts): Promise<void> => {
    fastify.get(
        '/',
        {
            schema: {
                response: {
                    200: z.object({
                        message: z.string(), timestamp: z.string(), version: z.string(),
                    }),
                },
            },
        },
        async function (_request, _reply) {
            return {
                message: 'Flashly API is running', timestamp: new Date().toISOString(), version: '1.0.0',
            };
        },
    );
};

export default root;
