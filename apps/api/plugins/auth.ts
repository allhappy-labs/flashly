import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { createAuth } from '../lib/auth/auth.ts';

type AuthInstance = ReturnType<typeof createAuth>;
type AuthSession = Awaited<ReturnType<AuthInstance['api']['getSession']>> | null;

async function resolveSession(auth: AuthInstance, request: FastifyRequest): Promise<AuthSession> {
    try {
        return await auth.api.getSession({
            headers: fromNodeHeaders(request.headers),
        });
    } catch {
        return null;
    }
}

export default fp(async (fastify: FastifyInstance) => {
    const auth = createAuth(fastify.log);

    fastify.decorate('auth', auth);
    fastify.decorate('getAuthSession', async function (request: FastifyRequest) {
        return resolveSession(auth, request);
    });
    fastify.decorate('requireAuthSession', async function (request: FastifyRequest, reply: FastifyReply) {
        const session = await resolveSession(auth, request);
        if (session?.user?.id) {
            return session;
        }

        reply.code(401).send({
            error: 'AUTH_REQUIRED',
            message: 'Authentication required.',
        });
        return null;
    });
});

declare module 'fastify' {
    interface FastifyInstance {
        auth: AuthInstance;
        getAuthSession(request: FastifyRequest): Promise<AuthSession>;
        requireAuthSession(request: FastifyRequest, reply: FastifyReply): Promise<AuthSession>;
    }
}
