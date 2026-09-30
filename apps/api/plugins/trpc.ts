import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from '../lib/trpc/router.ts';
import { createTrpcContext } from '../lib/trpc/context.ts';

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      createContext: ({ req, res }: { req: FastifyRequest; res: FastifyReply }) => createTrpcContext({
        fastify,
        req,
        res,
      }),
      router: appRouter,
    },
  });
});
