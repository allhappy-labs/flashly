import { type FastifyPluginAsyncZod, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { studyEventService } from '../lib/study/study-event-service.ts';
import { routeErrorSchema, sendRouteError } from './route-error.ts';

const studyEventsRoute: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
    fastify.withTypeProvider<ZodTypeProvider>().post(
        '/api/study/events/batch',
        {
            schema: {
                body: z.object({
                    reviewEvents: z.array(z.object({
                        id: z.string(),
                        deckId: z.string(),
                        cardId: z.string(),
                        rating: z.coerce.number(),
                        reviewedAt: z.coerce.date(),
                        responseMs: z.coerce.number().optional().nullable(),
                        deviceId: z.string().optional().nullable(),
                        clientUpdatedAt: z.coerce.date().optional().nullable(),
                    })).optional().default([]),
                    sessionEvents: z.array(z.object({
                        id: z.string(),
                        deckId: z.string(),
                        sessionId: z.string(),
                        startedAt: z.coerce.date(),
                        endedAt: z.coerce.date().optional().nullable(),
                        durationMs: z.coerce.number().optional().nullable(),
                        deviceId: z.string().optional().nullable(),
                        clientUpdatedAt: z.coerce.date().optional().nullable(),
                    })).optional().default([]),
                }),
                response: {
                    200: z.object({
                        acceptedIds: z.array(z.string()),
                    }),
                    401: routeErrorSchema,
                    500: routeErrorSchema,
                },
            },
        },
        async function (request, reply) {
            const session = await fastify.requireAuthSession(request, reply);
            if (!session?.user?.id) {
                return;
            }

            const body: {
                reviewEvents?: Parameters<typeof studyEventService.recordEvents>[0]['reviewEvents'];
                sessionEvents?: Parameters<typeof studyEventService.recordEvents>[0]['sessionEvents'];
            } = request.body;

            const result = await studyEventService.recordEvents({
                userId: session.user.id,
                reviewEvents: body.reviewEvents,
                sessionEvents: body.sessionEvents,
            });

            return result.match(
                (data) => reply.code(200).send(data),
                (error) => sendRouteError(reply, error)
            );
        }
    );
};

export default studyEventsRoute;
