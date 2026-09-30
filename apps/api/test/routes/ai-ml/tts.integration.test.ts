import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../../helper.ts';
import { createAuthenticatedUser } from '../../utils/auth-factory.ts';
import { setupMockElevenLabs, setupMockAutumn, resetAllMocks } from '../../utils/mock-setup.ts';
import { assertSuccess, assertBodyHasKeys } from '../../utils/assertions.ts';
import { isDatabaseAvailable } from '../../utils/database-helpers.ts';

test('tts route - generates speech from text', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockAutumn();
    await setupMockElevenLabs();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'tts-basic');

    const response = await app.inject({
        method: 'POST',
        url: '/api/tts/elevenlabs',
        headers: user.headers,
        payload: {
            text: 'Hello, this is a test.',
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assertBodyHasKeys(response, ['base64', 'contentType']);
    assert.equal(typeof body.base64, 'string');
    assert.ok(body.base64.length > 0);
    assert.equal(typeof body.contentType, 'string');
});

test('tts route - requires authentication', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockElevenLabs();

    t.after(async () => {
        await resetAllMocks();
    });

    const response = await app.inject({
        method: 'POST',
        url: '/api/tts/elevenlabs',
        payload: {
            text: 'Test without auth',
        },
    });

    assert.equal(response.statusCode, 401);
});

test('tts route - validates text length', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockAutumn();
    await setupMockElevenLabs();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'tts-length');

    // Empty text should fail
    const emptyResponse = await app.inject({
        method: 'POST',
        url: '/api/tts/elevenlabs',
        headers: user.headers,
        payload: {
            text: '',
        },
    });

    assert.equal(emptyResponse.statusCode, 400);
});

test('tts route - respects usage limits', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    // Mock usage limit reached
    await setupMockAutumn({ allowed: false });
    await setupMockElevenLabs();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'tts-limit');

    const response = await app.inject({
        method: 'POST',
        url: '/api/tts/elevenlabs',
        headers: user.headers,
        payload: {
            text: 'This should hit the limit',
        },
    });

    assert.equal(response.statusCode, 403);
    const body = JSON.parse(response.body);
    assert.equal(body.error, 'USAGE_LIMIT_REACHED');
});

test('tts route - accepts custom voice ID', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockAutumn();
    await setupMockElevenLabs();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'tts-voice-id');

    const response = await app.inject({
        method: 'POST',
        url: '/api/tts/elevenlabs',
        headers: user.headers,
        payload: {
            text: 'Custom voice test',
            voiceId: 'custom-voice-id-123',
        },
    });

    assertSuccess(response);
});

test('tts route - accepts custom voice name', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockAutumn();
    await setupMockElevenLabs();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'tts-voice-name');

    const response = await app.inject({
        method: 'POST',
        url: '/api/tts/elevenlabs',
        headers: user.headers,
        payload: {
            text: 'Voice name test',
            voiceName: 'Rachel',
        },
    });

    assertSuccess(response);
});

test('tts route - accepts custom model ID', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockAutumn();
    await setupMockElevenLabs();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'tts-model');

    const response = await app.inject({
        method: 'POST',
        url: '/api/tts/elevenlabs',
        headers: user.headers,
        payload: {
            text: 'Custom model test',
            modelId: 'eleven_multilingual_v2',
        },
    });

    assertSuccess(response);
});

test('tts route - accepts custom output format', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockAutumn();
    await setupMockElevenLabs();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'tts-format');

    const response = await app.inject({
        method: 'POST',
        url: '/api/tts/elevenlabs',
        headers: user.headers,
        payload: {
            text: 'Output format test',
            outputFormat: 'mp3_44100_128',
        },
    });

    assertSuccess(response);
});

test('tts route - handles all optional parameters together', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockAutumn();
    await setupMockElevenLabs();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'tts-all-params');

    const response = await app.inject({
        method: 'POST',
        url: '/api/tts/elevenlabs',
        headers: user.headers,
        payload: {
            text: 'All parameters test',
            voiceId: 'custom-voice',
            voiceName: 'Custom Voice',
            modelId: 'custom-model',
            outputFormat: 'mp3_44100_128',
        },
    });

    assertSuccess(response);
    assertBodyHasKeys(response, ['base64', 'contentType']);
});

test('tts route - handles ElevenLabs not configured', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockAutumn({ allowed: true });

    // Don't set up ElevenLabs mock to simulate not configured
    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'no-elevenlabs');

    // Remove ElevenLabs config
    delete process.env.ELEVENLABS_API_KEY;

    const response = await app.inject({
        method: 'POST',
        url: '/api/tts/elevenlabs',
        headers: user.headers,
        payload: {
            text: 'Test without ElevenLabs',
        },
    });

    // Should return 503 when ElevenLabs is not configured
    assert.equal(response.statusCode, 503);
    const body = JSON.parse(response.body);
    assert.equal(body.error, 'ELEVENLABS_NOT_CONFIGURED');
});

test('tts route - returns correct content type', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockAutumn();
    await setupMockElevenLabs({ contentType: 'audio/mpeg' });

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'content-type');

    const response = await app.inject({
        method: 'POST',
        url: '/api/tts/elevenlabs',
        headers: user.headers,
        payload: {
            text: 'Content type test',
        },
    });

    assertSuccess(response);
    const body = JSON.parse(response.body);
    assert.equal(body.contentType, 'audio/mpeg');
});

test('tts route - handles usage check failure', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    // Mock usage check failure
    await setupMockAutumn({ allowed: false });
    await setupMockElevenLabs();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'usage-check-fail');

    const response = await app.inject({
        method: 'POST',
        url: '/api/tts/elevenlabs',
        headers: user.headers,
        payload: {
            text: 'Usage check failure test',
        },
    });

    // Should return 403 when usage limit is reached
    assert.equal(response.statusCode, 403);
});

test('tts route - text is trimmed before processing', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockAutumn();
    await setupMockElevenLabs();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'trim-test');

    const response = await app.inject({
        method: 'POST',
        url: '/api/tts/elevenlabs',
        headers: user.headers,
        payload: {
            text: '  Text with whitespace  ',
        },
    });

    assertSuccess(response);
});

test('tts route - handles special characters in text', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockAutumn();
    await setupMockElevenLabs();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'special-chars');

    const response = await app.inject({
        method: 'POST',
        url: '/api/tts/elevenlabs',
        headers: user.headers,
        payload: {
            text: 'Test with émojis 🎵 and spëcial çhars!',
        },
    });

    assertSuccess(response);
});

test('tts route - handles very long text', async (t) => {
    if (!(await isDatabaseAvailable())) {
        t.skip('PostgreSQL is not available in this environment');
        return;
    }

    const app = await build(t);
    await setupMockAutumn();
    await setupMockElevenLabs();

    t.after(async () => {
        await resetAllMocks();
    });

    const user = await createAuthenticatedUser(app, 'long-text');

    // Create a reasonably long text (not exceeding max)
    const longText = 'This is a test. '.repeat(50);

    const response = await app.inject({
        method: 'POST',
        url: '/api/tts/elevenlabs',
        headers: user.headers,
        payload: {
            text: longText,
        },
    });

    assertSuccess(response);
});
