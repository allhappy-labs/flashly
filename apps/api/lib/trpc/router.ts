import { TRPCError, initTRPC } from '@trpc/server';
import { z } from 'zod';
import {
    TransportRequestSchema,
    buildPathWithQuery,
    canonicalizeApiPath,
    isUnsafeApiPath,
    normalizeApiPath,
    shouldBypassTrpc,
} from '@flashly/api-contracts';
import type { TrpcContext } from './context.ts';
import { createStatusError, toTrpcError } from './errors.ts';

const t = initTRPC.context<TrpcContext>().create({
    errorFormatter({ shape, error }) {
        const cause = error.cause as { statusCode?: number } | undefined;
        const httpStatus = typeof cause?.statusCode === 'number' ? cause.statusCode : shape.data.httpStatus;
        const isInternalError =
            error.code === 'INTERNAL_SERVER_ERROR' || (typeof httpStatus === 'number' && httpStatus >= 500);
        const { stack: _stack, ...safeData } = shape.data;

        if (isInternalError) {
            return {
                ...shape,
                message: 'Internal server error',
                data: {
                    code: 'INTERNAL_SERVER_ERROR',
                    httpStatus: httpStatus ?? 500,
                },
            };
        }

        return {
            ...shape,
            data: {
                ...safeData,
                httpStatus,
            },
        };
    },
});

const publicProcedure = t.procedure;
const FORWARDED_HEADER_ALLOWLIST = new Set(['accept-language', 'x-session-id']);

const TransportQueryInputSchema = z.object({
    headers: z.record(z.string(), z.string()).optional(),
    path: z.string().min(1),
    query: z
        .record(
            z.string(),
            z.union([
                z.string(),
                z.number(),
                z.boolean(),
                z.array(z.string()),
                z.array(z.number()),
                z.array(z.boolean()),
            ]),
        )
        .optional(),
});

const TransportMutationInputSchema = TransportRequestSchema.refine((value) => value.method !== 'GET', {
    message: 'Mutations must use POST, PUT, PATCH, or DELETE.',
});

function parseInjectedBody(injected: { body: string; headers: Record<string, unknown> }) {
    const contentType = String(injected.headers['content-type'] ?? '').toLowerCase();

    if (!injected.body) {
        return null;
    }

    if (contentType.includes('application/json')) {
        try {
            return JSON.parse(injected.body);
        } catch {
            return injected.body;
        }
    }

    return injected.body;
}

function ensureTransportPath(path: string): string {
    const normalized = normalizeApiPath(path);
    if (isUnsafeApiPath(normalized)) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid transport path.',
        });
    }

    const canonicalPath = canonicalizeApiPath(normalized);

    if (!canonicalPath.startsWith('/api/')) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Transport path must target /api/* endpoints.',
        });
    }

    if (shouldBypassTrpc(canonicalPath)) {
        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This endpoint must be called directly via REST.',
        });
    }

    return canonicalPath;
}

function sanitizeForwardHeaders(headers?: Record<string, string>): Record<string, string> {
    const sanitizedHeaders: Record<string, string> = {};

    if (!headers) {
        return sanitizedHeaders;
    }

    for (const [headerName, headerValue] of Object.entries(headers)) {
        const normalizedHeaderName = headerName.toLowerCase();

        if (!FORWARDED_HEADER_ALLOWLIST.has(normalizedHeaderName)) {
            continue;
        }

        if (!headerValue) {
            continue;
        }

        sanitizedHeaders[normalizedHeaderName] = headerValue;
    }

    return sanitizedHeaders;
}

async function executeTransportRequest(
    ctx: TrpcContext,
    input: {
        body?: unknown;
        headers?: Record<string, string>;
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        path: string;
        query?: Record<string, string | number | boolean | null | Array<string | number | boolean | null>>;
    },
): Promise<unknown> {
    const normalizedPath = ensureTransportPath(input.path);
    const targetPath = buildPathWithQuery(normalizedPath, input.query);
    const headers = sanitizeForwardHeaders(input.headers);

    if (ctx.req.headers.authorization) {
        headers.authorization = String(ctx.req.headers.authorization);
    }

    if (ctx.req.headers.cookie) {
        headers.cookie = String(ctx.req.headers.cookie);
    }

    if (input.body !== undefined) {
        headers['content-type'] = 'application/json';
    }

    const injected = await ctx.fastify.inject({
        headers,
        method: input.method,
        payload: input.body !== undefined ? JSON.stringify(input.body) : undefined,
        url: targetPath,
    });

    const payload = parseInjectedBody({
        body: injected.body,
        headers: injected.headers,
    });

    if (injected.statusCode >= 400) {
        if (injected.statusCode >= 500) {
            ctx.fastify.log.error(
                {
                    method: input.method,
                    path: targetPath,
                    statusCode: injected.statusCode,
                },
                'Transport request failed with server error',
            );
        }

        const message =
            injected.statusCode >= 500
                ? 'Internal server error'
                : typeof payload === 'object' && payload !== null && 'message' in payload
                  ? String((payload as { message?: unknown }).message)
                  : `Request failed (${injected.statusCode})`;

        const causePayload = injected.statusCode >= 500 ? undefined : payload;
        throw createStatusError(injected.statusCode, message, causePayload);
    }

    return payload;
}

export const appRouter = t.router({
    transport: t.router({
        mutate: publicProcedure
            .input(TransportMutationInputSchema)
            .output(z.unknown())
            .mutation(async ({ ctx, input }) => {
                try {
                    return await executeTransportRequest(ctx, {
                        body: input.body,
                        headers: input.headers,
                        method: input.method,
                        path: input.path,
                        query: input.query,
                    });
                } catch (error) {
                    throw toTrpcError(error);
                }
            }),

        query: publicProcedure
            .input(TransportQueryInputSchema)
            .output(z.unknown())
            .query(async ({ ctx, input }) => {
                try {
                    return await executeTransportRequest(ctx, {
                        headers: input.headers,
                        method: 'GET',
                        path: input.path,
                        query: input.query,
                    });
                } catch (error) {
                    throw toTrpcError(error);
                }
            }),
    }),
});

export type AppRouter = typeof appRouter;
