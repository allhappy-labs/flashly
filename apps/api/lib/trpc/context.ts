import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type AuthSessionUser = {
  id?: string | null;
  [key: string]: unknown;
} | null | undefined;

type AuthSession = {
  user?: AuthSessionUser;
  [key: string]: unknown;
} | null;

type FastifyWithAuthSession = FastifyInstance & {
  getAuthSession(request: FastifyRequest): Promise<AuthSession>;
};

export interface TrpcContext {
  fastify: FastifyWithAuthSession;
  logger: FastifyBaseLogger;
  req: FastifyRequest;
  res: FastifyReply;
  session: AuthSession;
}

export async function createTrpcContext(options: {
  fastify: FastifyWithAuthSession;
  req: FastifyRequest;
  res: FastifyReply;
}): Promise<TrpcContext> {
  const session = await options.fastify.getAuthSession(options.req);

  return {
    fastify: options.fastify,
    logger: options.fastify.log,
    req: options.req,
    res: options.res,
    session,
  };
}
