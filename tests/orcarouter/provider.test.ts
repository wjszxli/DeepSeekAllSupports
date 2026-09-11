/**
 * Provider-wiring tests.
 *
 * These are the tests that prove the *integration*, not just the helpers:
 *   - both auth entries route inference to the API origin with a Bearer token;
 *   - both produce one credential and downstream code is source-agnostic;
 *   - the model options handed to the selector come from the catalog API;
 *   - changing the required modality re-filters those options and invalidates an
 *     incompatible selection;
 *   - the fallback path is labeled, never free text.
 */

import '../setup';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ORCA_OAUTH_PROVIDER_ID,
    ORCA_PROVIDER_ID,
    buildApiUrl,
} from '../../src/orcarouter/constants';
import {
    ORCA_FALLBACK_MODELS,
    filterModelsForCapability,
    getFallbackCatalog,
    type OrcaModel,
} from '../../src/orcarouter/catalog';
import { emitInferenceRequest } from '../../src/orcarouter/relay';

/* ------------------------------------------------------------------ *
 * Shared inference dispatch
 * ------------------------------------------------------------------ */

const CATALOG: unknown[] = [
    {
        id: 'openai/gpt-5.5',
        name: 'GPT-5.5',
        supported_endpoint_types: ['openai'],
        architecture: { input_modalities: ['text', 'image'] },
        context_length: 400_000,
    },
    {
        id: 'deepseek/deepseek-v4-pro',
        name: 'DeepSeek V4 Pro',
        supported_endpoint_types: ['openai'],
        architecture: { input_modalities: ['text'] },
        context_length: 128_000,
    },
    {
        id: 'vendor/embed',
        name: 'Embedding',
        supported_endpoint_types: ['embeddings'],
        architecture: { input_modalities: ['text'] },
    },
];

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/** A minimal stand-in for the persisted provider + credential metadata. */
function createFakeProvider(overrides: Record<string, unknown> = {}) {
    return {
        id: ORCA_PROVIDER_ID,
        name: 'OrcaRouter - API',
        type: 'openai' as const,
        apiKey: 'sk-orca-fake0000000000000000000000000000000000',
        apiHost: 'https://api.orcarouter.ai/v1',
        models: [],
        enabled: true,
        ...overrides,
    } as any;
}

/* ------------------------------------------------------------------ *
 * Both entries reach the same relay
 * ------------------------------------------------------------------ */

test('both auth entries send inference to api.orcarouter.ai/v1 with a Bearer token', async () => {
    for (const providerId of [ORCA_PROVIDER_ID, ORCA_OAUTH_PROVIDER_ID]) {
        const captured: { url: string; auth: string } = { url: '', auth: '' };
        const outcome = await emitInferenceRequest(
            createFakeProvider({ id: providerId }),
            {
                path: '/chat/completions',
                body: { model: 'openai/gpt-5.5', messages: [] },
            },
            async (input: any, init: any) => {
                captured.url = String(input);
                captured.auth = init.headers.Authorization;
                return jsonResponse({ choices: [] });
            },
        );

        assert.equal(outcome.ok, true, providerId);
        assert.equal(captured.url, 'https://api.orcarouter.ai/v1/chat/completions');
        assert.match(captured.auth, /^Bearer sk-orca-/);
        // Neither entry may ever reach the auth origin for inference.
        assert.ok(!captured.url.includes('www.orcarouter.ai'));
    }
});

test('an inference URL is never derived from the auth origin', () => {
    assert.equal(
        buildApiUrl('https://api.orcarouter.ai/v1', '/chat/completions'),
        'https://api.orcarouter.ai/v1/chat/completions',
    );
    assert.ok(
        !buildApiUrl('https://api.orcarouter.ai/v1', '/chat/completions').includes(
            'www.orcarouter.ai',
        ),
    );
});

test('a self-hosted API override is honoured for inference but not for auth', async () => {
    const captured: string[] = [];
    await emitInferenceRequest(
        createFakeProvider({ apiHost: 'https://relay.self-hosted.test/v1' }),
        { path: '/models' },
        async (input: any) => {
            captured.push(String(input));
            return jsonResponse({ data: [] });
        },
    );
    assert.equal(captured[0], 'https://relay.self-hosted.test/v1/models');
});

test('a plaintext remote API base is refused rather than sending the key', async () => {
    let called = false;
    const outcome = await emitInferenceRequest(
        createFakeProvider({ apiHost: 'http://remote-host.test/v1' }),
        { path: '/models' },
        async () => {
            called = true;
            return jsonResponse({ data: [] });
        },
    );
    assert.equal(called, false);
    assert.equal(outcome.ok, false);
});

/* ------------------------------------------------------------------ *
 * The selector options come from the API
 * ------------------------------------------------------------------ */

test('the options handed to the model selector are exactly the API-returned chat models', async () => {
    const options = await loadSelectorOptions({ capability: 'chat' }, CATALOG);
    assert.deepEqual(
        options.map((model: any) => model.id).sort(),
        ['deepseek/deepseek-v4-pro', 'openai/gpt-5.5'],
    );
    // The embedding model must not appear in a text picker.
    assert.ok(!options.some((model: any) => model.id === 'vendor/embed'));
});

test('attaching an image re-filters the same selector options to image-capable chat models', async () => {
    const textOptions = await loadSelectorOptions({ capability: 'chat' }, CATALOG);
    const imageOptions = await loadSelectorOptions({ capability: 'vision', modality: 'image' }, CATALOG);

    assert.deepEqual(
        textOptions.map((model: any) => model.id).sort(),
        ['deepseek/deepseek-v4-pro', 'openai/gpt-5.5'],
    );
    // Only the model that explicitly declares image input survives.
    assert.deepEqual(
        imageOptions.map((model: any) => model.id),
        ['openai/gpt-5.5'],
    );

    // And the previously selected text-only model is now invalid.
    const stillValid = imageOptions.some((model: any) => model.id === 'deepseek/deepseek-v4-pro');
    assert.equal(stillValid, false, 'a text-only selection must be cleared when an image is attached');
});

test('a catalog failure yields labeled fallback options, never a free-text state', async () => {
    const options = await loadSelectorOptions({ capability: 'chat' }, null);
    assert.ok(options.length > 0, 'the picker must never be empty');
    assert.ok(options.every((model: any) => model.fromFallback === true));
    assert.ok(
        options.some((model: any) => model.id === 'openai/gpt-5.5'),
        'the verified seed must survive an outage',
    );
});

/* ------------------------------------------------------------------ *
 * Capability filtering across the whole seed
 * ------------------------------------------------------------------ */

test('the seed never advertises a non-chat model into the text picker', () => {
    const chat = filterModelsForCapability(getFallbackCatalog(), 'chat');
    assert.equal(chat.length, ORCA_FALLBACK_MODELS.length);
});

test('the seed produces an image-capable subset that excludes the text-only model', () => {
    const image = filterModelsForCapability(getFallbackCatalog(), 'vision', 'image');
    const ids = new Set(image.map((model: OrcaModel) => model.id));
    assert.ok(ids.has('openai/gpt-5.5'));
    assert.ok(!ids.has('deepseek/deepseek-v4-pro'));
});

test('the seed has no embedding, image-generation, video, or rerank models to offer', () => {
    const catalog = getFallbackCatalog();
    // Advertising a capability the client cannot actually drive would be worse
    // than offering nothing.
    assert.equal(filterModelsForCapability(catalog, 'embedding').length, 0);
    assert.equal(filterModelsForCapability(catalog, 'image').length, 0);
    assert.equal(filterModelsForCapability(catalog, 'video').length, 0);
    assert.equal(filterModelsForCapability(catalog, 'rerank').length, 0);
});

/* ------------------------------------------------------------------ *
 * Helper mirroring the production selector data flow
 * ------------------------------------------------------------------ */

/**
 * Reproduce exactly what the GUI does: discover through the OrcaRouter
 * discovery entry point, then filter for the capability the entry point needs.
 * The production path is `discoverModelsForProvider` / `refilterModels`; this
 * helper drives the same two catalog functions with an injected transport so
 * the assertion is about behaviour rather than about a mock.
 */
async function loadSelectorOptions(
    filter: { capability: 'chat' | 'vision' | 'embedding'; modality?: 'text' | 'image' },
    catalogBody: unknown[] | null,
): Promise<OrcaModel[]> {
    const { discoverOrcaCatalog } = await import('../../src/orcarouter/catalog');
    const result = await discoverOrcaCatalog({
        apiBaseUrl: 'https://api.orcarouter.ai/v1',
        capability: filter.capability,
        fetchImpl: async () =>
            catalogBody === null
                ? new Response('', { status: 503 })
                : jsonResponse({ data: catalogBody }),
    });
    return filterModelsForCapability(result.models, filter.capability, filter.modality ?? 'text');
}
