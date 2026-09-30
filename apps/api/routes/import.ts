import { type FastifyPluginAsyncZod, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { importService } from '../lib/import/import-service.ts';
import { routeErrorSchema, sendRouteError } from './route-error.ts';

const importRoute: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
  // =========================================================================
  // IMPORT ENDPOINTS (Auth Required)
  // =========================================================================

  // Import deck from Flashly .flashly bundle payload
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/api/decks/import/flashly',
    {
      schema: {
        body: z.object({
          deck: z.object({
            name: z.string().min(1, 'Deck name is required'),
            description: z.string().optional(),
            materialType: z.string().optional(),
            deckType: z.string().optional(),
            locale: z.string().optional(),
            accentKey: z.string().optional(),
          }),
          cards: z.array(
            z.object({
              front: z.string().min(1, 'Card front is required'),
              back: z.string().min(1, 'Card back is required'),
              imageUrl: z.string().optional(),
              audioUrl: z.string().optional(),
              category: z.string().optional(),
              pos: z.string().optional(),
              gender: z.string().optional(),
              example: z.string().optional(),
              tags: z.string().optional(),
            })
          ).min(1, 'At least one card is required'),
        }),
        response: {
          200: z.object({
            deckId: z.string(),
            name: z.string(),
            cardCount: z.number(),
          }),
          400: routeErrorSchema,
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

      const body = request.body;
      const result = await importService.importFromFlashly(session.user.id, {
        ...body.deck,
        cards: body.cards,
      });

      return result.match(
        (data) => reply.code(200).send(data),
        (error) => {
          return sendRouteError(reply, error, { allowedStatuses: [400, 500] });
        }
      );
    }
  );

  // Import deck from external Anki CSV
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/api/decks/import/anki-csv',
    {
      schema: {
        body: z.object({
          csv: z.string().min(1, 'CSV content is required'),
          deckName: z.string().optional(),
        }),
        response: {
          200: z.object({
            deckId: z.string(),
            name: z.string(),
            cardCount: z.number(),
          }),
          400: routeErrorSchema,
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

      const body = request.body;
      const result = await importService.importFromAnkiCsv(session.user.id, body.csv, body.deckName);

      return result.match(
        (data) => reply.code(200).send(data),
        (error) => {
          return sendRouteError(reply, error, { allowedStatuses: [400, 500] });
        }
      );
    }
  );

  // Import deck from external Quizlet text
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/api/decks/import/quizlet',
    {
      schema: {
        body: z.object({
          content: z.string().min(1, 'Quizlet content is required'),
          deckName: z.string().optional(),
        }),
        response: {
          200: z.object({
            deckId: z.string(),
            name: z.string(),
            cardCount: z.number(),
          }),
          400: routeErrorSchema,
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

      const body = request.body;
      const result = await importService.importFromQuizlet(
        session.user.id,
        body.content,
        body.deckName
      );

      return result.match(
        (data) => reply.code(200).send(data),
        (error) => {
          return sendRouteError(reply, error, { allowedStatuses: [400, 500] });
        }
      );
    }
  );
};

export default importRoute;
