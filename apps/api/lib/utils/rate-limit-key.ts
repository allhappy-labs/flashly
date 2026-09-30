import { createHash } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

function hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

export function buildRateLimitKey(request: FastifyRequest, scope: string): string {
    const authorization = request.headers.authorization;
    if (typeof authorization === 'string' && authorization.length > 0) {
        return `${scope}:auth:${hashValue(authorization)}`;
    }

    const cookie = request.headers.cookie;
    if (typeof cookie === 'string' && cookie.length > 0) {
        return `${scope}:cookie:${hashValue(cookie)}`;
    }

    return `${scope}:ip:${request.ip}`;
}
