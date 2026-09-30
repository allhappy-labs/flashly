import { type FastifyPluginAsyncZod, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { exportService } from '../lib/export/export-service.ts';
import { routeErrorSchema, sendRouteError } from './route-error.ts';

const exportRoute: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
  // =========================================================================
  // EXPORT ENDPOINTS (Auth Required)
  // =========================================================================

  // Export deck as external Anki CSV
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/api/decks/:id/export/anki-csv',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.string(),
          401: routeErrorSchema,
          403: routeErrorSchema,
          404: routeErrorSchema,
          500: routeErrorSchema,
        },
      },
    },
    async function (request, reply) {
      const session = await fastify.requireAuthSession(request, reply);
      if (!session?.user?.id) {
        return;
      }

      const { id: deckId } = request.params;
      const result = await exportService.exportAsAnkiCsv(session.user.id, deckId);

      return result.match(
        (csv) => {
          reply.type('text/csv; charset=utf-8');
          reply.header('Content-Disposition', `attachment; filename="deck-${deckId}.anki.csv"`);
          return reply.code(200).send(csv);
        },
        (error) => {
          return sendRouteError(reply, error, { allowedStatuses: [403, 404, 500] });
        }
      );
    }
  );

  // Export deck as external Quizlet text
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/api/decks/:id/export/quizlet',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.string(),
          401: routeErrorSchema,
          403: routeErrorSchema,
          404: routeErrorSchema,
          500: routeErrorSchema,
        },
      },
    },
    async function (request, reply) {
      const session = await fastify.requireAuthSession(request, reply);
      if (!session?.user?.id) {
        return;
      }

      const { id: deckId } = request.params;
      const result = await exportService.exportAsQuizlet(session.user.id, deckId);

      return result.match(
        (content) => {
          reply.type('text/plain; charset=utf-8');
          reply.header('Content-Disposition', `attachment; filename="deck-${deckId}.quizlet.txt"`);
          return reply.code(200).send(content);
        },
        (error) => {
          return sendRouteError(reply, error, { allowedStatuses: [403, 404, 500] });
        }
      );
    }
  );
};

export default exportRoute;
