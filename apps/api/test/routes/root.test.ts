import { test } from 'node:test';
import * as assert from 'node:assert';
import { build } from '../helper.ts';

test('default root route', async (t) => {
    const app = await build(t);

    const res = await app.inject({
        url: '/',
    });
    assert.equal(res.statusCode, 200);

    const payload = JSON.parse(res.payload);

    assert.equal(typeof payload, 'object');
    assert.notEqual(payload, null);
    if (!payload || typeof payload !== 'object') {
        assert.fail('Expected root payload to be an object');
    }

    assert.equal(Reflect.get(payload, 'message'), 'Flashly API is running');
    assert.equal(Reflect.get(payload, 'version'), '1.0.0');
    assert.ok(Number.isFinite(Date.parse(String(Reflect.get(payload, 'timestamp')))));
});
