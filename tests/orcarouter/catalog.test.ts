/**
 * Model-catalog tests: discovery bounds, capability filtering, multimodal
 * fail-closed behaviour, and the fallback contract.
 *
 * Fixtures cover the five shapes the requirement calls out: text-only,
 * image-input chat, embedding, image generation, video, and rerank.
 */

import '../setup';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ORCA_CATALOG_MAX_BYTES,
    ORCA_CATALOG_MAX_ITEMS,
    filterModelsForCapability,
    getFallbackCatalog,
    isChatCapable,
    isModelStillCompatible,
    isModalityCapable,
    parseCatalogRecord,
    toStoreModel,
    type OrcaModel,
} from '../../src/orcarouter/catalog';

/** A representative catalog covering every capability shape. */
const CATALOG_FIXTURE = [
    {
        id: 'openai/gpt-5.5',
        name: 'GPT-5.5',
        supported_endpoint_types: ['openai', 'openai-response'],
        architecture: { input_modalities: ['text', 'image'] },
        context_length: 400_000,
        supported_parameters: ['low', 'medium', 'high', 'xhigh'],
    },
    {
        id: 'deepseek/deepseek-v4-pro',
        name: 'DeepSeek V4 Pro',
        supported_endpoint_types: ['openai'],
        architecture: { input_modalities: ['text'] },
        context_length: 128_000,
        supported_parameters: ['low', 'medium', 'high'],
    },
    {
        // Text-only chat with NO declared modality: must fail closed.
        id: 'vendor/undeclared-chat',
        name: 'Undeclared Chat',
        supported_endpoint_types: ['openai'],
        architecture: {},
        context_length: 32_000,
    },
    {
        id: 'google/gemini-3.5-flash',
        name: 'Gemini 3.5 Flash',
        supported_endpoint_types: ['gemini', 'openai'],
        architecture: { input_modalities: ['text', 'image', 'audio', 'video'] },
        context_length: 1_000_000,
    },
    {
        id: 'vendor/text-embedding-3',
        name: 'Embedding 3',
        supported_endpoint_types: ['embeddings'],
        architecture: { input_modalities: ['text'] },
    },
    {
        id: 'vendor/image-gen-xl',
        name: 'Image Gen XL',
        supported_endpoint_types: ['image-generation'],
        architecture: { input_modalities: ['text'] },
    },
    {
        id: 'vendor/video-gen-1',
        name: 'Video Gen 1',
        supported_endpoint_types: ['openai-video'],
        architecture: { input_modalities: ['text', 'image'] },
    },
    {
        id: 'vendor/rerank-v2',
        name: 'Rerank v2',
        supported_endpoint_types: ['jina-rerank'],
        architecture: { input_modalities: ['text'] },
    },
    {
        // Advertises an endpoint type this client cannot speak at all.
        id: 'vendor/exotic-route',
        name: 'Exotic',
        supported_endpoint_types: ['some-future-route'],
        architecture: { input_modalities: ['text'] },
    },
];

function parseAll(): OrcaModel[] {
    return CATALOG_FIXTURE.map((record) => parseCatalogRecord(record)).filter(
        (model): model is OrcaModel => model !== null,
    );
}

/* ------------------------------------------------------------------ *
 * Record parsing
 * ------------------------------------------------------------------ */

test('the vendor/model namespace is preserved verbatim', () => {
    const models = parseAll();
    assert.ok(models.some((model) => model.id === 'openai/gpt-5.5'));
    assert.ok(models.some((model) => model.id === 'deepseek/deepseek-v4-pro'));
    // No id may be rewritten, lowercased, or stripped of its namespace.
    for (const model of models) {
        assert.ok(!model.id.includes(' '));
    }
});

test('an unsupported endpoint type is dropped, not advertised', () => {
    const parsed = parseCatalogRecord(CATALOG_FIXTURE[8]);
    assert.ok(parsed);
    assert.deepEqual(parsed!.supportedEndpointTypes, []);
    // With no speakable route it must not be offered anywhere.
    assert.equal(isChatCapable(parsed!), false);
});

test('malformed records are rejected rather than guessed at', () => {
    assert.equal(parseCatalogRecord(null), null);
    assert.equal(parseCatalogRecord('a string'), null);
    assert.equal(parseCatalogRecord({}), null);
    assert.equal(parseCatalogRecord({ id: '   ' }), null);
    assert.equal(parseCatalogRecord({ name: 'no id' }), null);
});

test('reasoning effort metadata survives parsing, including xhigh', () => {
    const gpt = parseCatalogRecord(CATALOG_FIXTURE[0]);
    assert.deepEqual(gpt?.reasoningEfforts, ['low', 'medium', 'high', 'xhigh']);
    assert.equal(gpt?.reasoning, true);
    assert.equal(gpt?.contextLength, 400_000);

    const deepseek = parseCatalogRecord(CATALOG_FIXTURE[1]);
    assert.deepEqual(deepseek?.reasoningEfforts, ['low', 'medium', 'high']);
});

/* ------------------------------------------------------------------ *
 * Capability filters
 * ------------------------------------------------------------------ */

test('the chat filter keeps text routes and excludes non-text-only routes', () => {
    const chat = filterModelsForCapability(parseAll(), 'chat');
    const ids = new Set(chat.map((model) => model.id));

    assert.ok(ids.has('openai/gpt-5.5'));
    assert.ok(ids.has('deepseek/deepseek-v4-pro'));
    assert.ok(ids.has('google/gemini-3.5-flash'));
    // Non-text-only routes must never leak into the text picker.
    assert.ok(!ids.has('vendor/image-gen-xl'));
    assert.ok(!ids.has('vendor/video-gen-1'));
    assert.ok(!ids.has('vendor/rerank-v2'));
    assert.ok(!ids.has('vendor/text-embedding-3'));
    assert.ok(!ids.has('vendor/exotic-route'));
});

test('multimodal selection requires an explicit modality declaration', () => {
    const all = parseAll();

    const image = new Set(filterModelsForCapability(all, 'vision', 'image').map((m) => m.id));
    assert.ok(image.has('openai/gpt-5.5'));
    assert.ok(image.has('google/gemini-3.5-flash'));
    // Declares only text — must not appear for an image upload.
    assert.ok(!image.has('deepseek/deepseek-v4-pro'));
    // Declares nothing at all — fails closed rather than being inferred.
    assert.ok(!image.has('vendor/undeclared-chat'));

    const audio = filterModelsForCapability(all, 'vision', 'audio').map((m) => m.id);
    assert.deepEqual(audio, ['google/gemini-3.5-flash']);

    const video = filterModelsForCapability(all, 'vision', 'video').map((m) => m.id);
    assert.deepEqual(video, ['google/gemini-3.5-flash']);
});

test('a model name alone never implies a capability', () => {
    const misleading: OrcaModel = {
        id: 'vendor/vision-pro-max',
        name: 'Vision Pro Max Ultra',
        provider: 'orcarouter',
        group: 'Vision',
        supportedEndpointTypes: ['openai'],
        // No declared modalities despite the name.
        inputModalities: [],
        contextLength: null,
        reasoning: false,
        reasoningEfforts: [],
        fromFallback: false,
    };
    assert.equal(isChatCapable(misleading), true);
    assert.equal(isModalityCapable(misleading, 'image'), false);
    assert.ok(
        !filterModelsForCapability([misleading], 'vision', 'image').some(
            (model) => model.id === misleading.id,
        ),
    );
});

test('embedding, image, video, and rerank use strict endpoint matching', () => {
    const all = parseAll();
    assert.deepEqual(
        filterModelsForCapability(all, 'embedding').map((m) => m.id),
        ['vendor/text-embedding-3'],
    );
    assert.deepEqual(
        filterModelsForCapability(all, 'image').map((m) => m.id),
        ['vendor/image-gen-xl'],
    );
    assert.deepEqual(
        filterModelsForCapability(all, 'video').map((m) => m.id),
        ['vendor/video-gen-1'],
    );
    assert.deepEqual(
        filterModelsForCapability(all, 'rerank').map((m) => m.id),
        ['vendor/rerank-v2'],
    );
    // A chat model is never offered as an embedding or image model.
    assert.ok(!filterModelsForCapability(all, 'image').some((m) => m.id === 'openai/gpt-5.5'));
});

/* ------------------------------------------------------------------ *
 * Selection invalidation
 * ------------------------------------------------------------------ */

test('a selection that is no longer compatible is reported as invalid', () => {
    const all = parseAll();
    // Valid while the input is text-only…
    assert.equal(isModelStillCompatible(all, 'deepseek/deepseek-v4-pro', 'chat'), true);
    assert.equal(isModelStillCompatible(all, 'deepseek/deepseek-v4-pro', 'vision', 'text'), true);
    // …and invalid once an image is attached.
    assert.equal(isModelStillCompatible(all, 'deepseek/deepseek-v4-pro', 'vision', 'image'), false);
    // A model that vanished from the catalog is invalid too.
    assert.equal(isModelStillCompatible(all, 'vendor/removed-model', 'chat'), false);
    assert.equal(isModelStillCompatible(all, null, 'chat'), false);
    assert.equal(isModelStillCompatible(all, '', 'chat'), false);
});

/* ------------------------------------------------------------------ *
 * Verified fallback
 * ------------------------------------------------------------------ */

test('the fallback catalog keeps every verified id and its reasoning ladder', () => {
    const fallback = getFallbackCatalog();
    const ids = new Set(fallback.map((model) => model.id));
    for (const expected of [
        'openai/gpt-5.5',
        'anthropic/claude-opus-4.8',
        'google/gemini-3.5-flash',
        'deepseek/deepseek-v4-pro',
        'orcarouter/auto',
    ]) {
        assert.ok(ids.has(expected), `missing ${expected}`);
    }

    const gpt = fallback.find((model) => model.id === 'openai/gpt-5.5')!;
    // Restoring ids without their metadata is a silent capability regression.
    assert.deepEqual(gpt.reasoningEfforts, ['low', 'medium', 'high', 'xhigh']);
    assert.deepEqual(gpt.inputModalities, ['text', 'image']);
    assert.equal(gpt.contextLength, 400_000);
    assert.equal(gpt.reasoning, true);
    assert.equal(gpt.fromFallback, true);

    // The text-only fallback model must not claim image input.
    const deepseek = fallback.find((model) => model.id === 'deepseek/deepseek-v4-pro')!;
    assert.deepEqual(deepseek.inputModalities, ['text']);
});

test('the fallback is not shared mutable state', () => {
    const first = getFallbackCatalog();
    first[0].reasoningEfforts.push('mutated');
    first[0].supportedEndpointTypes.push('mutated');
    const second = getFallbackCatalog();
    assert.ok(!second[0].reasoningEfforts.includes('mutated'));
    assert.ok(!second[0].supportedEndpointTypes.includes('mutated'));
});

test('the store projection keeps capability metadata the UI needs', () => {
    const gpt = getFallbackCatalog().find((model) => model.id === 'openai/gpt-5.5')!;
    const projected = toStoreModel(gpt);
    assert.equal(projected.id, 'openai/gpt-5.5');
    assert.equal(projected.name, 'GPT-5.5');
    assert.ok(projected.type?.includes('reasoning'));
    assert.ok(projected.type?.includes('vision'));
    assert.ok(projected.description?.includes('xhigh'));
    assert.ok(projected.description?.includes('400,000'));

    const deepseek = getFallbackCatalog().find((model) => model.id === 'deepseek/deepseek-v4-pro')!;
    assert.ok(!toStoreModel(deepseek).type?.includes('vision'));
});

/* ------------------------------------------------------------------ *
 * Bounds
 * ------------------------------------------------------------------ */

test('catalog bounds are small enough to be safe and large enough to be useful', () => {
    assert.ok(ORCA_CATALOG_MAX_ITEMS > 0 && ORCA_CATALOG_MAX_ITEMS <= 2000);
    assert.ok(ORCA_CATALOG_MAX_BYTES > 0 && ORCA_CATALOG_MAX_BYTES <= 4 * 1024 * 1024);
});
