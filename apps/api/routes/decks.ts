import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { registerDeckCardRoutes } from '../lib/decks/deck-card-routes.ts';
import { registerDeckManagementRoutes } from '../lib/decks/deck-management-routes.ts';

const decksRoute: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
    await registerDeckManagementRoutes(fastify);
    await registerDeckCardRoutes(fastify);
};

export default decksRoute;
