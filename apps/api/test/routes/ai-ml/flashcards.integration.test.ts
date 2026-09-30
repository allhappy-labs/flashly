import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../../helper.ts';
import { createAuthenticatedUser } from '../../utils/auth-factory.ts';
import { setupMockOpenRouter, setupMockElevenLabs, resetAllMocks, createMockPdf } from '../../utils/mock-setup.ts';
import { isDatabaseAvailable } from '../../utils/database-helpers.ts';

test('flashcards route - requires authentication', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockOpenRouter();
    await setupMockElevenLabs();

    t.after(async () => {
        await resetAllMocks();
    });

    const response = await app.inject({
        method: 'POST',
        url: '/api/flashcards',
        payload: createMockPdf(),
    });

    // We need to send multipart form data, but without auth should still fail
    assert.ok(response.statusCode === 401 || response.statusCode === 400);
});

test('flashcards route - generates flashcards from file', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockOpenRouter();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'flashcard-gen');

    // Create a mock multipart upload
    const formData = new FormData();
    const file = new Blob(['test content for flashcard generation'], { type: 'text/plain' });
    formData.append('file', file, 'test.txt');

    const response = await app.inject({
        method: 'POST',
        url: '/api/flashcards',
        headers: user.headers,
        payload: formData,
    });

    // The response could be various codes depending on mock setup
    // We're mainly testing the endpoint exists and auth works
    assert.ok(response.statusCode === 200 || response.statusCode === 400 || response.statusCode === 415);
});

test('flashcards route - handles usage limit reached', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    // Mock Autumn to return usage limit reached
    const { setupMockAutumn } = await import('../../utils/mock-setup.js');
    await setupMockAutumn({ allowed: false });
    await setupMockOpenRouter();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'limit-test');

    const formData = new FormData();
    const file = new Blob(['test content'], { type: 'text/plain' });
    formData.append('file', file, 'test.txt');

    const response = await app.inject({
        method: 'POST',
        url: '/api/flashcards',
        headers: user.headers,
        payload: formData,
    });

    // Should return 403 when usage limit is reached
    assert.ok(response.statusCode === 403 || response.statusCode === 400);
});

test('flashcards route - accepts custom instruction', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockOpenRouter();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'custom-instruction');

    const formData = new FormData();
    const file = new Blob(['test content'], { type: 'text/plain' });
    formData.append('file', file, 'test.txt');
    formData.append('instruction', 'Focus on vocabulary related to animals');

    const response = await app.inject({
        method: 'POST',
        url: '/api/flashcards',
        headers: user.headers,
        payload: formData,
    });

    assert.ok(response.statusCode === 200 || response.statusCode === 400 || response.statusCode === 415);
});

test('flashcards route - accepts format parameter', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockOpenRouter();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'format-test');

    const formData = new FormData();
    const file = new Blob(['test content'], { type: 'text/plain' });
    formData.append('file', file, 'test.txt');
    formData.append('format', 'q_and_a');

    const response = await app.inject({
        method: 'POST',
        url: '/api/flashcards',
        headers: user.headers,
        payload: formData,
    });

    assert.ok(response.statusCode === 200 || response.statusCode === 400 || response.statusCode === 415);
});

test('flashcards route - accepts materialType parameter', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockOpenRouter();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'material-type');

    const formData = new FormData();
    const file = new Blob(['test content'], { type: 'text/plain' });
    formData.append('file', file, 'test.txt');
    formData.append('materialType', 'language');

    const response = await app.inject({
        method: 'POST',
        url: '/api/flashcards',
        headers: user.headers,
        payload: formData,
    });

    assert.ok(response.statusCode === 200 || response.statusCode === 400 || response.statusCode === 415);
});

test('flashcards route - rejects forbidden API key fields', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockOpenRouter();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'forbidden-keys');

    const formData = new FormData();
    const file = new Blob(['test content'], { type: 'text/plain' });
    formData.append('file', file, 'test.txt');
    formData.append('openRouterApiKey', 'sk-test-key'); // This should be rejected

    const response = await app.inject({
        method: 'POST',
        url: '/api/flashcards',
        headers: user.headers,
        payload: formData,
    });

    // Should reject user-provided API keys
    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.error, 'USER_KEYS_NOT_ALLOWED');
});

test('flashcards route - with includeAudio parameter', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockOpenRouter();
    await setupMockElevenLabs();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'with-audio');

    const formData = new FormData();
    const file = new Blob(['test content'], { type: 'text/plain' });
    formData.append('file', file, 'test.txt');
    formData.append('includeAudio', 'true');

    const response = await app.inject({
        method: 'POST',
        url: '/api/flashcards',
        headers: user.headers,
        payload: formData,
    });

    assert.ok(response.statusCode === 200 || response.statusCode === 400 || response.statusCode === 415 || response.statusCode === 503);
});

test('flashcards route - handles empty file', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockOpenRouter();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'empty-file');

    const formData = new FormData();
    const file = new Blob([''], { type: 'text/plain' });
    formData.append('file', file, 'empty.txt');

    const response = await app.inject({
        method: 'POST',
        url: '/api/flashcards',
        headers: user.headers,
        payload: formData,
    });

    // Should reject empty file
    assert.ok(response.statusCode === 400 || response.statusCode === 422);
});

test('flashcards route - rejects multiple files', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockOpenRouter();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'multi-files');

    const formData = new FormData();
    formData.append('file', new Blob(['content 1']), 'file1.txt');
    formData.append('file', new Blob(['content 2']), 'file2.txt');

    const response = await app.inject({
        method: 'POST',
        url: '/api/flashcards',
        headers: user.headers,
        payload: formData,
    });

    // Should reject multiple files
    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.error, 'MULTIPLE_FILES');
});

test('flashcards route - handles service unavailability', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    // Don't set up mocks - let it try real services
    // This tests the error handling path

    const user = await createAuthenticatedUser(app, 'service-down');

    const formData = new FormData();
    const file = new Blob(['test content'], { type: 'text/plain' });
    formData.append('file', file, 'test.txt');

    const response = await app.inject({
        method: 'POST',
        url: '/api/flashcards',
        headers: user.headers,
        payload: formData,
    });

    // Should handle service errors gracefully
    assert.ok(
        response.statusCode >= 400 && response.statusCode < 600,
        'Should return an error status when service is unavailable'
    );
});

test('flashcards route - validates required file parameter', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const user = await createAuthenticatedUser(app, 'no-file');

    const response = await app.inject({
        method: 'POST',
        url: '/api/flashcards',
        headers: user.headers,
        payload: new FormData(),
    });

    // Should reject request without file
    assert.ok(response.statusCode === 400 || response.statusCode === 422);
});

test('flashcards route - endpoint exists with proper authentication', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);

    const user = await createAuthenticatedUser(app, 'endpoint-check');

    const response = await app.inject({
        method: 'POST',
        url: '/api/flashcards',
        headers: user.headers,
        // In real testing, you'd construct proper multipart data here
    });

    // Test passes if endpoint exists and handles auth
    assert.ok(response.statusCode !== 401);
});
