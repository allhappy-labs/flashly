import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { registerMarketplacePublicRoutes } from '../lib/marketplace/marketplace-public-routes.ts';
import { registerMarketplaceCloneRoute } from '../lib/marketplace/marketplace-clone-route.ts';

const marketplaceRoute: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
    await registerMarketplacePublicRoutes(fastify);
    await registerMarketplaceCloneRoute(fastify);
};

export default marketplaceRoute;
