import { timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { fromNodeHeaders } from 'better-auth/node';
import { eq } from 'drizzle-orm';
import { type FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { config } from '../config/app.ts';
import { db } from '../db/db.ts';
import { createAuth } from '../lib/auth/auth.ts';
import { user as authUser } from '../lib/auth/auth-schema.ts';

const TEST_AUTH_SECRET_HEADER = 'x-e2e-auth-secret';

const testAuthRoute: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
    const auth = createAuth(fastify.log);

    fastify.post(
        '/api/test-auth/one-time-token',
        {
            config: {
                rateLimit: {
                    max: 5,
                    timeWindow: 60 * 1000,
                },
            },
            schema: {
                response: {
                    200: z.object({
                        mobileDeepLink: z.string(),
                        testUserEmail: z.email(),
                        token: z.string(),
                        webVerifyEndpoint: z.string(),
                    }),
                    401: z.object({
                        error: z.literal('UNAUTHORIZED'),
                        message: z.string(),
                    }),
                    404: z.object({
                        error: z.literal('NOT_FOUND'),
                        message: z.string(),
                    }),
                    429: z.object({
                        error: z.string(),
                        message: z.string(),
                    }),
                    500: z.object({
                        error: z.literal('TEST_AUTH_NOT_CONFIGURED').or(z.literal('TEST_AUTH_FAILED')),
                        message: z.string(),
                    }),
                },
            },
        },
        async (request, reply) => {
            if (config.NODE_ENV !== 'test') {
                return reply.code(404).send({
                    error: 'NOT_FOUND',
                    message: 'Not found.',
                });
            }

            if (!config.E2E_AUTH_SECRET) {
                return reply.code(500).send({
                    error: 'TEST_AUTH_NOT_CONFIGURED',
                    message: 'E2E auth secret is not configured.',
                });
            }

            const providedSecret = getHeaderValue(request.headers, TEST_AUTH_SECRET_HEADER);
            if (!isSecretValid(providedSecret, config.E2E_AUTH_SECRET)) {
                return reply.code(401).send({
                    error: 'UNAUTHORIZED',
                    message: 'Unauthorized.',
                });
            }

            try {
                const sessionToken = await ensureSessionToken(auth, request.headers);
                const oneTimeTokenResult = await auth.api.generateOneTimeToken({
                    headers: new Headers({
                        authorization: `Bearer ${sessionToken}`,
                    }),
                });

                const token = oneTimeTokenResult?.token;
                if (!token) {
                    throw new Error('Failed to generate one-time token');
                }

                return reply.code(200).send({
                    mobileDeepLink: `flashly://auth?ott=${encodeURIComponent(token)}`,
                    testUserEmail: config.E2E_TEST_USER_EMAIL,
                    token,
                    webVerifyEndpoint: `${config.AUTH_URL.replace(/\/$/, '')}/api/auth/one-time-token/verify`,
                });
            } catch (error) {
                fastify.log.error({ err: error }, 'Failed to mint one-time token for test auth');
                return reply.code(500).send({
                    error: 'TEST_AUTH_FAILED',
                    message: 'Failed to create test auth token.',
                });
            }
        },
    );
};

async function ensureSessionToken(
    auth: ReturnType<typeof createAuth>,
    requestHeaders: IncomingHttpHeaders,
) {
    const signInBody = {
        email: config.E2E_TEST_USER_EMAIL,
        password: config.E2E_TEST_USER_PASSWORD,
        rememberMe: true,
    };

    try {
        const signInResult = await auth.api.signInEmail({
            body: signInBody,
            headers: fromNodeHeaders(requestHeaders),
        });

        if (signInResult?.token) {
            return signInResult.token;
        }
    } catch {
        try {
            await auth.api.signUpEmail({
                body: {
                    email: config.E2E_TEST_USER_EMAIL,
                    name: config.E2E_TEST_USER_NAME,
                    password: config.E2E_TEST_USER_PASSWORD,
                },
                headers: fromNodeHeaders(requestHeaders),
            });
        } catch {
            // If sign-up fails because the user already exists (or due a race),
            // we'll retry sign-in right after this block.
        }
    }

    try {
        const signInResult = await auth.api.signInEmail({
            body: signInBody,
            headers: fromNodeHeaders(requestHeaders),
        });

        if (signInResult?.token) {
            return signInResult.token;
        }
    } catch {
        // Continue with test-user recreation fallback below.
    }

    await recreateFixedTestUser(auth, requestHeaders);

    const refreshedSignInResult = await auth.api.signInEmail({
        body: signInBody,
        headers: fromNodeHeaders(requestHeaders),
    });

    if (!refreshedSignInResult?.token) {
        throw new Error('Failed to create session token for test user');
    }

    return refreshedSignInResult.token;
}

async function recreateFixedTestUser(
    auth: ReturnType<typeof createAuth>,
    requestHeaders: IncomingHttpHeaders,
) {
    const existingUsers = await db
        .select({
            id: authUser.id,
        })
        .from(authUser)
        .where(eq(authUser.email, config.E2E_TEST_USER_EMAIL))
        .limit(1);

    if (existingUsers.length > 0) {
        await db.delete(authUser).where(eq(authUser.id, existingUsers[0].id));
    }

    await auth.api.signUpEmail({
        body: {
            email: config.E2E_TEST_USER_EMAIL,
            name: config.E2E_TEST_USER_NAME,
            password: config.E2E_TEST_USER_PASSWORD,
        },
        headers: fromNodeHeaders(requestHeaders),
    });
}

function getHeaderValue(headers: IncomingHttpHeaders, key: string): string | null {
    const value = headers[key];
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && value.length > 0) {
        return value[0];
    }
    return null;
}

function isSecretValid(providedSecret: string | null, expectedSecret: string): boolean {
    if (!providedSecret) {
        return false;
    }

    const providedBuffer = Buffer.from(providedSecret, 'utf8');
    const expectedBuffer = Buffer.from(expectedSecret, 'utf8');

    if (providedBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return timingSafeEqual(providedBuffer, expectedBuffer);
}

export default testAuthRoute;
