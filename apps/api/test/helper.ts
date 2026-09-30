import type * as test from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import type appPlugin from '../app.ts';

export type TestContext = {
    after: typeof test.after;
};

let appPluginPromise: Promise<typeof appPlugin> | null = null;

function ensureTestEnvDefaults() {
    delete process.env.REDIS_URL;
    delete process.env.SENTRY_DSN;
    process.env.NODE_ENV = 'test';

    const defaults: Record<string, string> = {
        AUTH_SECRET: 'FlashlyTestAuthSecret2026X9Secure0000',
        AUTH_URL: 'http://localhost:3001',
        AUTUMN_SECRET_KEY: 'autumn_test_key',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/flashly_db',
        E2E_AUTH_SECRET: 'FlashlyTestAuthSecret2026X9Secure',
        E2E_TEST_USER_PASSWORD: 'FlashlyTestPass!2026',
        MAIL_API_KEY: 'test-mail-key',
        MAIL_FROM_EMAIL: 'test@example.com',
        MAIL_FROM_NAME: 'Flashly Test',
        NODE_ENV: 'test',
        S3_ACCESS_KEY_ID: 'test-access-key',
        S3_PRIVATE_BUCKET_NAME: 'flashly-private-test',
        S3_PUBLIC_BUCKET_NAME: 'flashly-public-test',
        S3_PUBLIC_URL: 'https://example.com/public',
        S3_SECRET_ACCESS_KEY: 'test-secret-key',
    };

    for (const [key, value] of Object.entries(defaults)) {
        if (key !== 'NODE_ENV' && !process.env[key]) {
            process.env[key] = value;
        }
    }
}

async function loadAppPlugin() {
    ensureTestEnvDefaults();
    if (!appPluginPromise) {
        appPluginPromise = import('../app.ts').then((module) => module.default);
    }
    return appPluginPromise;
}

async function build(t: TestContext): Promise<FastifyInstance> {
    const appPlugin = await loadAppPlugin();
    const fastify = Fastify({ logger: false });
    await fastify.register(appPlugin);
    await fastify.ready();

    t.after(async () => {
        await fastify.close();
    });

    return fastify;
}

export { build, ensureTestEnvDefaults };
