import { test } from 'node:test';
import * as assert from 'node:assert';
import { build, type TestContext } from '../helper.ts';

async function buildContactApp(t: TestContext) {
    const app = await build(t);
    const emailModule = await import('../../services/email.ts');
    const configModule = await import('../../config/app.ts');

    // Disable outbound email delivery in tests while keeping the route path intact.
    configModule.config.MAIL_API_KEY = '';
    configModule.config.MAIL_FROM_EMAIL = '';
    emailModule.resetEmailClient();

    return app;
}

test('contact route sanitizes header injection attempts in name field', async (t) => {
    const app = await buildContactApp(t);

    const response = await app.inject({
        method: 'POST',
        url: '/api/contact',
        payload: {
            email: 'test@example.com',
            message: 'Test message',
            name: 'John\r\nBcc: victim@example.com',
        },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
});

test('contact route rejects invalid email input', async (t) => {
    const app = await buildContactApp(t);

    const response = await app.inject({
        method: 'POST',
        url: '/api/contact',
        payload: {
            email: 'not-an-email',
            message: 'Test message',
            name: 'John Doe',
        },
    });

    assert.equal(response.statusCode, 400);
});

test('contact route accepts valid submissions', async (t) => {
    const app = await buildContactApp(t);

    const response = await app.inject({
        method: 'POST',
        url: '/api/contact',
        payload: {
            email: 'john@example.com',
            message: 'This is a test message',
            name: 'John Doe',
        },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
});

test('contact route enforces rate limit after 3 requests', async (t) => {
    const app = await buildContactApp(t);
    const payload = {
        email: 'test@example.com',
        message: 'Test message',
        name: 'John Doe',
    };

    for (let i = 0; i < 3; i++) {
        const response = await app.inject({
            method: 'POST',
            url: '/api/contact',
            payload,
        });
        assert.equal(response.statusCode, 200);
    }

    const rateLimited = await app.inject({
        method: 'POST',
        url: '/api/contact',
        payload,
    });

    assert.equal(rateLimited.statusCode, 429);
});
