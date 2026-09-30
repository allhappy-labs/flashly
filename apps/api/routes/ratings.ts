import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { registerRatingEndpoints } from './ratings.rating-endpoints.ts';
import { registerReviewEndpoints } from './ratings.review-endpoints.ts';

const ratingsRoute: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
    await registerRatingEndpoints(fastify);
    await registerReviewEndpoints(fastify);
};

export default ratingsRoute;
