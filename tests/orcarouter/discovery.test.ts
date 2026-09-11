/**
 * Discovery tests: the live endpoint is authoritative, failures fall back to a
 * *labeled* verified seed, and a seed is never mixed into a live result.
 */

import '../setup';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ORCA_CATALOG_MAX_ITEMS,
    discoverOrcaCatalog,
} from '../../src/orcarouter/catalog';

const LIVE_BODY = {
    data: [
        {
            id: 'openai/gpt-5.5',
            name: 'GPT-5.5',
            supported_endpoint_types: ['openai'],
            architecture: { input_modalities: ['text', 'image'] },
            context_length: 400_000,
        },
        {
            id: 'vendor/live-only-model',
            name: 'Live Only',
            supported_endpoint_types: ['openai'],
            architecture: { input_modalities: ['text'] },
        },
    ],
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

test('a successful discovery returns live models from the API origin', async () => {
    let requestedUrl = '';
    const result = await discoverOrcaCatalog({
        apiBaseUrl: 'https://api.orcarouter.ai/v1',
        fetchImpl: async (input: any) => {
            requestedUrl = String(input);
            return jsonResponse(LIVE_BODY);
        },
    });

    assert.equal(requestedUrl, 'https://api.orcarouter.ai/v1/models');
    assert.equal(result.source, 'live');
    assert.equal(result.degradedReason, null);
    assert.deepEqual(
        result.models.map((model) => model.id).sort(),
        ['openai/gpt-5.5', 'vendor/live-only-model'],
    );
    // The seed must not be merged into an authoritative live result.
    assert.ok(!result.models.some((model) => model.id === 'orcarouter/auto'));
    assert.ok(result.models.every((model) => model.fromFallback === false));
});

test('the user key is sent as a Bearer token and never appears in the URL', async () => {
    const FAKE_KEY = 'sk-orca-fake0000000000000000000000000000000000';
    let capturedUrl = '';
    let capturedAuth = '';
    await discoverOrcaCatalog({
        apiBaseUrl: 'https://api.orcarouter.ai/v1',
        apiKey: FAKE_KEY,
        fetchImpl: async (input: any, init: any) => {
            capturedUrl = String(input);
            capturedAuth = init.headers.Authorization;
            return jsonResponse(LIVE_BODY);
        },
    });
    assert.equal(capturedAuth, `Bearer ${FAKE_KEY}`);
    assert.ok(!capturedUrl.includes(FAKE_KEY));
});

test('discovery without a key does not send an Authorization header', async () => {
    let sawAuth = false;
    await discoverOrcaCatalog({
        apiBaseUrl: 'https://api.orcarouter.ai/v1',
        apiKey: null,
        fetchImpl: async (_input: any, init: any) => {
            sawAuth = 'Authorization' in init.headers;
            return jsonResponse(LIVE_BODY);
        },
    });
    assert.equal(sawAuth, false);
});

test('an HTTP failure falls back to the labeled verified seed', async () => {
    for (const status of [401, 403, 429, 500, 503]) {
        const result = await discoverOrcaCatalog({
            apiBaseUrl: 'https://api.orcarouter.ai/v1',
            fetchImpl: async () => new Response('', { status }),
        });
        assert.equal(result.source, 'fallback', `status ${status}`);
        assert.ok(result.degradedReason, `status ${status} must explain the degraded state`);
        assert.equal(result.status, status);
        assert.ok(result.models.length > 0);
        assert.ok(result.models.every((model) => model.fromFallback === true));
    }
});

test('a network failure and a timeout both fall back with a reason', async () => {
    const offline = await discoverOrcaCatalog({
        apiBaseUrl: 'https://api.orcarouter.ai/v1',
        fetchImpl: async () => {
            throw new TypeError('offline');
        },
    });
    assert.equal(offline.source, 'fallback');
    assert.match(offline.degradedReason!, /could not reach/i);

    const timedOut = await discoverOrcaCatalog({
        apiBaseUrl: 'https://api.orcarouter.ai/v1',
        timeoutMs: 5,
        fetchImpl: (_input: any, init: any) =>
            new Promise((_resolve, reject) => {
                init.signal.addEventListener('abort', () => {
                    const error = new Error('aborted');
                    error.name = 'AbortError';
                    reject(error);
                });
            }),
    });
    assert.equal(timedOut.source, 'fallback');
    assert.match(timedOut.degradedReason!, /timed out/i);
});

test('malformed and empty payloads fall back rather than producing a free-text state', async () => {
    for (const body of ['not json', { data: [] }, { data: 'wrong shape' }, {}]) {
        const result = await discoverOrcaCatalog({
            apiBaseUrl: 'https://api.orcarouter.ai/v1',
            fetchImpl: async () =>
                typeof body === 'string'
                    ? new Response(body, { status: 200 })
                    : jsonResponse(body),
        });
        assert.equal(result.source, 'fallback');
        assert.ok(result.models.length > 0, 'the picker must never be empty');
    }
});

test('a payload with only unusable records falls back', async () => {
    const result = await discoverOrcaCatalog({
        apiBaseUrl: 'https://api.orcarouter.ai/v1',
        fetchImpl: async () =>
            jsonResponse({ data: [{ no_id: true }, { id: '' }, { id: 'vendor/exotic', supported_endpoint_types: ['unknown-route'] }] }),
    });
    assert.equal(result.source, 'fallback');
    assert.ok(result.models.every((model) => model.fromFallback));
});

test('a payload with no chat-capable models at all falls back', async () => {
    const result = await discoverOrcaCatalog({
        apiBaseUrl: 'https://api.orcarouter.ai/v1',
        capability: 'chat',
        fetchImpl: async () =>
            jsonResponse({
                data: [
                    {
                        id: 'vendor/embed',
                        supported_endpoint_types: ['embeddings'],
                        architecture: { input_modalities: ['text'] },
                    },
                ],
            }),
    });
    assert.equal(result.source, 'fallback');
});

test('the item count is capped', async () => {
    const many = Array.from({ length: ORCA_CATALOG_MAX_ITEMS + 50 }, (_, index) => ({
        id: `vendor/model-${index}`,
        supported_endpoint_types: ['openai'],
        architecture: { input_modalities: ['text'] },
    }));
    const result = await discoverOrcaCatalog({
        apiBaseUrl: 'https://api.orcarouter.ai/v1',
        fetchImpl: async () => jsonResponse({ data: many }),
    });
    assert.equal(result.source, 'live');
    assert.equal(result.models.length, ORCA_CATALOG_MAX_ITEMS);
    // Truncation must be reported, never silent.
    assert.equal(result.truncated, true);
});

test('a declared oversized body is refused before it is read', async () => {
    const result = await discoverOrcaCatalog({
        apiBaseUrl: 'https://api.orcarouter.ai/v1',
        fetchImpl: async () =>
            new Response('{}', {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Content-Length': String(64 * 1024 * 1024) },
            }),
    });
    assert.equal(result.source, 'fallback');
    assert.ok(result.degradedReason);
});

test('duplicate ids are de-duplicated', async () => {
    const result = await discoverOrcaCatalog({
        apiBaseUrl: 'https://api.orcarouter.ai/v1',
        fetchImpl: async () =>
            jsonResponse({
                data: [
                    { id: 'vendor/dup', supported_endpoint_types: ['openai'] },
                    { id: 'vendor/dup', supported_endpoint_types: ['openai'] },
                ],
            }),
    });
    assert.equal(result.models.length, 1);
});

test('the capability filter is applied at discovery time', async () => {
    const result = await discoverOrcaCatalog({
        apiBaseUrl: 'https://api.orcarouter.ai/v1',
        capability: 'embedding',
        fetchImpl: async () =>
            jsonResponse({
                data: [
                    { id: 'vendor/chat', supported_endpoint_types: ['openai'] },
                    { id: 'vendor/embed', supported_endpoint_types: ['embeddings'] },
                ],
            }),
    });
    assert.equal(result.source, 'live');
    assert.deepEqual(result.models.map((model) => model.id), ['vendor/embed']);
});

test('an external abort is reported as cancelled', async () => {
    const controller = new AbortController();
    const pending = discoverOrcaCatalog({
        apiBaseUrl: 'https://api.orcarouter.ai/v1',
        signal: controller.signal,
        fetchImpl: (_input: any, init: any) =>
            new Promise((_resolve, reject) => {
                init.signal.addEventListener('abort', () => {
                    const error = new Error('aborted');
                    error.name = 'AbortError';
                    reject(error);
                });
            }),
    });
    controller.abort();
    const result = await pending;
    assert.equal(result.source, 'fallback');
    assert.match(result.degradedReason!, /cancelled/i);
});

test('discovery rejects an origin that would send the key in plaintext', async () => {
    let called = false;
    const result = await discoverOrcaCatalog({
        apiBaseUrl: 'http://remote-host.test/v1',
        apiKey: 'sk-orca-fake0000000000000000000000000000000000',
        fetchImpl: async () => {
            called = true;
            return jsonResponse(LIVE_BODY);
        },
    });
    // The unsafe override is refused outright — no request is issued with a
    // credential bound for a plaintext remote host.
    assert.equal(called, false);
    assert.equal(result.source, 'fallback');
});
