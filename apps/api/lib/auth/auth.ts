import { betterAuth } from 'better-auth';
import type { FastifyBaseLogger } from 'fastify';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, magicLink, oneTimeToken } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import { autumn } from 'autumn-js/better-auth';
import { db } from '../../db/db.ts';
import { config } from '../../config/app.ts';
import { sendMagicLinkEmail } from '../../services/email.ts';
import * as authSchema from './auth-schema.ts';

export function createAuth(logger: FastifyBaseLogger) {
    const isTestEnv = config.NODE_ENV === 'test';
    const trustedOrigins = [
        ...config.CLIENT_ORIGIN,
        'flashly://',
        'flashly://auth',
    ];

    return betterAuth({
        baseURL: config.AUTH_URL,
        database: drizzleAdapter(db, {
            provider: 'pg',
            schema: {
                ...authSchema,
            },
        }),
        plugins: [
            expo(),
            bearer(),
            magicLink({
                sendMagicLink: async ({ email, url, token }) => {
                    const callbackMagicLink = buildMagicLinkForCallback(url, token);
                    const result = await sendMagicLinkEmail(email, callbackMagicLink, logger);

                    if (result.isErr()) {
                        logger.error(
                            { err: result.error, email },
                            'Magic link email delivery failed',
                        );
                        // Don't throw - better-auth handles failure gracefully
                    }
                },
            }),
            ...(isTestEnv ? [oneTimeToken()] : []),
            autumn(),
        ],
        emailAndPassword: isTestEnv
            ? {
                enabled: true,
                requireEmailVerification: false,
            }
            : undefined,
        secret: config.AUTH_SECRET,
        session: {
            expiresIn: 60 * 60 * 24 * 7, // 7 days
            updateAge: 60 * 60 * 24, // 1 day
        },
        trustedOrigins,
        user: {
            additionalFields: {
                username: {
                    defaultValue: '',
                    required: false,
                    type: 'string',
                },
            },
        },
    });
}

function buildMagicLinkForCallback(url: string, token?: string) {
    if (!token) {
        return url;
    }

    try {
        const parsed = new URL(url);
        const callbackURL = parsed.searchParams.get('callbackURL');
        if (!callbackURL) {
            return url;
        }

        const callback = new URL(callbackURL);
        if (callback.protocol !== 'flashly:') {
            return url;
        }

        callback.searchParams.set('token', token);
        return callback.toString();
    } catch  {
        return url;
    }
}
