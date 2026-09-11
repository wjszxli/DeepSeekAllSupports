/**
 * OrcaRouter model catalog: live discovery, capability filtering, and a
 * bounded, verified cold-start fallback.
 *
 * The single source of truth for the model list is `GET /v1/models` on the
 * configured **inference** origin (`https://api.orcarouter.ai/v1`). Live
 * discovery is authoritative when it succeeds; the seed below is only a
 * degraded-mode fallback so a fresh install is not left with an empty picker
 * during an outage.
 *
 * Model ids are preserved verbatim, including the `vendor/model` namespace.
 */

import type { ModelType } from '@/types';
import {
    buildApiUrl,
    normalizeOrcaOrigin,
    type OrcaOriginOverrides,
    resolveOrcaOrigins,
} from './constants';

/** Capability of the entry point asking for models. */
export type OrcaCapability =
    | 'all'
    | 'chat'
    | 'vision'
    | 'embedding'
    | 'image'
    | 'video'
    | 'rerank';

/** Endpoint types this client can actually speak. Anything else is not advertised. */
const SUPPORTED_ENDPOINT_TYPES = new Set([
    'openai',
    'anthropic',
    'gemini',
    'openai-response',
    'embeddings',
    'image-generation',
    'openai-video',
    'jina-rerank',
]);

/** Text-chat routes: at least one of these must be present on a chat model. */
const CHAT_ENDPOINT_TYPES = ['openai', 'anthropic', 'gemini', 'openai-response'];

/** Non-text-only route types that must never leak into the text chat picker. */
const NON_CHAT_ENDPOINT_TYPES = new Set([
    'image-generation',
    'openai-video',
    'jina-rerank',
    'embeddings',
]);

export type OrcaInputModality = 'text' | 'image' | 'audio' | 'video' | 'file';

export interface OrcaModel {
    /** Verbatim id from the catalog, e.g. `openai/gpt-5.5`. */
    id: string;
    name: string;
    provider: 'orcarouter';
    group: string;
    /** Endpoint types the catalog advertises for this model. */
    supportedEndpointTypes: string[];
    /** Input modalities the catalog explicitly declares. Absence means unknown → fail closed. */
    inputModalities: OrcaInputModality[];
    contextLength: number | null;
    reasoning: boolean;
    reasoningEfforts: string[];
    /** True when this record came from the verified seed rather than live discovery. */
    fromFallback: boolean;
}

export interface OrcaCatalogResult {
    models: OrcaModel[];
    /** `live` when the catalog endpoint answered; `fallback` on a verified seed. */
    source: 'live' | 'fallback';
    /** Populated when discovery failed, for a degraded-state notice. */
    degradedReason: string | null;
    fetchedAt: number;
    truncated: boolean;
}

/* ------------------------------------------------------------------ *
 * Bounds — a catalog response must not be able to exhaust memory
 * ------------------------------------------------------------------ */

export const ORCA_CATALOG_TIMEOUT_MS = 8_000;
export const ORCA_CATALOG_MAX_BYTES = 512 * 1024;
export const ORCA_CATALOG_MAX_ITEMS = 500;

/* ------------------------------------------------------------------ *
 * Verified cold-start seed
 * ------------------------------------------------------------------ */

/**
 * Verified fallback catalog. Every entry keeps its verified metadata —
 * context window, declared input modalities, and the reasoning-effort ladder.
 * Keeping the ladder matters: a fallback that restores ids but drops
 * `low/medium/high/xhigh` is a silent capability regression.
 */
export const ORCA_FALLBACK_MODELS: OrcaModel[] = [
    {
        id: 'openai/gpt-5.5',
        name: 'GPT-5.5',
        provider: 'orcarouter',
        group: 'GPT-5.5',
        supportedEndpointTypes: ['openai', 'openai-response'],
        inputModalities: ['text', 'image'],
        contextLength: 400_000,
        reasoning: true,
        reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
        fromFallback: true,
    },
    {
        id: 'anthropic/claude-opus-4.8',
        name: 'Claude Opus 4.8',
        provider: 'orcarouter',
        group: 'Claude 4.8',
        supportedEndpointTypes: ['anthropic', 'openai'],
        inputModalities: ['text', 'image'],
        contextLength: 200_000,
        reasoning: true,
        reasoningEfforts: ['low', 'medium', 'high'],
        fromFallback: true,
    },
    {
        id: 'google/gemini-3.5-flash',
        name: 'Gemini 3.5 Flash',
        provider: 'orcarouter',
        group: 'Gemini 3.5',
        supportedEndpointTypes: ['gemini', 'openai'],
        inputModalities: ['text', 'image', 'audio', 'video'],
        contextLength: 1_000_000,
        reasoning: true,
        reasoningEfforts: ['low', 'medium', 'high'],
        fromFallback: true,
    },
    {
        id: 'deepseek/deepseek-v4-pro',
        name: 'DeepSeek V4 Pro',
        provider: 'orcarouter',
        group: 'DeepSeek V4',
        supportedEndpointTypes: ['openai'],
        inputModalities: ['text'],
        contextLength: 128_000,
        reasoning: true,
        reasoningEfforts: ['low', 'medium', 'high'],
        fromFallback: true,
    },
    {
        id: 'orcarouter/auto',
        name: 'OrcaRouter Auto',
        provider: 'orcarouter',
        group: 'OrcaRouter',
        supportedEndpointTypes: ['openai', 'anthropic', 'gemini', 'openai-response'],
        inputModalities: ['text', 'image'],
        contextLength: null,
        reasoning: true,
        reasoningEfforts: ['low', 'medium', 'high'],
        fromFallback: true,
    },
];

/** Copy of the seed with `fromFallback` set, so callers cannot mutate the constant. */
export function getFallbackCatalog(): OrcaModel[] {
    return ORCA_FALLBACK_MODELS.map((model) => ({
        ...model,
        supportedEndpointTypes: [...model.supportedEndpointTypes],
        inputModalities: [...model.inputModalities],
        reasoningEfforts: [...model.reasoningEfforts],
    }));
}

/* ------------------------------------------------------------------ *
 * Record validation
 * ------------------------------------------------------------------ */

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function asPositiveInt(value: unknown): number | null {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

/**
 * Convert one raw catalog record into an `OrcaModel`, or `null` when the record
 * cannot be trusted. Unknown endpoint types are dropped rather than assumed:
 * advertising a route this client cannot speak is worse than omitting it.
 */
export function parseCatalogRecord(raw: unknown): OrcaModel | null {
    if (!raw || typeof raw !== 'object') return null;
    const record = raw as Record<string, any>;

    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (!id) return null;

    const endpointTypes = asStringArray(record.supported_endpoint_types).filter((type) =>
        SUPPORTED_ENDPOINT_TYPES.has(type),
    );

    const architecture = record.architecture ?? {};
    const inputModalities = asStringArray(architecture.input_modalities).filter(
        (modality): modality is OrcaInputModality =>
            modality === 'text' ||
            modality === 'image' ||
            modality === 'audio' ||
            modality === 'video' ||
            modality === 'file',
    );

    const supportedParameters = asStringArray(record.supported_parameters);
    const reasoningEfforts = supportedParameters.filter((parameter) =>
        ['low', 'medium', 'high', 'xhigh'].includes(parameter),
    );

    return {
        id,
        name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : id,
        provider: 'orcarouter',
        group: typeof record.group === 'string' && record.group.trim() ? record.group.trim() : 'OrcaRouter',
        supportedEndpointTypes: endpointTypes,
        inputModalities,
        contextLength: asPositiveInt(record.context_length),
        reasoning: reasoningEfforts.length > 0 || Boolean(record.reasoning),
        reasoningEfforts,
        fromFallback: false,
    };
}

/* ------------------------------------------------------------------ *
 * Capability filtering
 * ------------------------------------------------------------------ */

/**
 * Whether a model is usable for a chat-shaped entry point.
 *
 * Requires `supported_endpoint_types` to intersect the text-chat routes and
 * explicitly excludes the non-text-only routes, so an image-generation or
 * rerank model can never appear in the text picker even if it also lists
 * `openai`.
 */
export function isChatCapable(model: OrcaModel): boolean {
    const routes = model.supportedEndpointTypes;
    if (routes.length === 0) return false;
    const hasChatRoute = CHAT_ENDPOINT_TYPES.some((route) => routes.includes(route));
    if (!hasChatRoute) return false;
    if (NON_CHAT_ENDPOINT_TYPES.has(routes[0]) && !hasChatRoute) return false;
    return true;
}

/**
 * Multimodal understanding: must be chat-capable first, then explicitly declare
 * the modality the entry point actually uploads. A model that does not declare
 * the modality fails closed — it is never inferred from the model name.
 */
export function isModalityCapable(model: OrcaModel, modality: OrcaInputModality): boolean {
    if (modality === 'text') return isChatCapable(model);
    if (!isChatCapable(model)) return false;
    return model.inputModalities.includes(modality);
}

function matchesStrictRoute(model: OrcaModel, route: string): boolean {
    return model.supportedEndpointTypes.includes(route);
}

/** Filter a catalog down to the models a given entry point may offer. */
export function filterModelsForCapability(
    models: OrcaModel[],
    capability: OrcaCapability,
    modality: OrcaInputModality = 'text',
): OrcaModel[] {
    switch (capability) {
        // Unfiltered: used by the background catalog service so the page can
        // re-filter by input type without a second round-trip.
        case 'all':
            return models;
        case 'chat':
            return models.filter((model) => isChatCapable(model));
        case 'vision':
            return models.filter((model) => isModalityCapable(model, modality));
        case 'embedding':
            return models.filter((model) => matchesStrictRoute(model, 'embeddings'));
        case 'image':
            return models.filter((model) => matchesStrictRoute(model, 'image-generation'));
        case 'video':
            return models.filter((model) => matchesStrictRoute(model, 'openai-video'));
        case 'rerank':
            return models.filter((model) => matchesStrictRoute(model, 'jina-rerank'));
        default:
            return [];
    }
}

/**
 * True when a previously selected model is still offered for the current
 * capability. Used to clear an incompatible selection instead of silently
 * keeping a value the user can no longer send to.
 */
export function isModelStillCompatible(
    models: OrcaModel[],
    modelId: string | null | undefined,
    capability: OrcaCapability,
    modality: OrcaInputModality = 'text',
): boolean {
    if (!modelId) return false;
    return filterModelsForCapability(models, capability, modality).some(
        (model) => model.id === modelId,
    );
}

/* ------------------------------------------------------------------ *
 * Discovery
 * ------------------------------------------------------------------ */

export interface DiscoverCatalogOptions {
    apiBaseUrl?: string;
    apiKey?: string | null;
    origins?: OrcaOriginOverrides;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    timeoutMs?: number;
    maxItems?: number;
    now?: () => number;
    /** Capability used only to decide whether the result is usable at all. */
    capability?: OrcaCapability;
}

export interface OrcaCatalogDiscoveryResult extends OrcaCatalogResult {
    /** HTTP status when the endpoint answered with a failure. */
    status: number | null;
}

/**
 * Fetch the live catalog. Falls back to the verified seed on any failure —
 * timeout, network error, non-2xx, malformed body, or an empty usable list.
 * The seed is never mixed into a successful live result.
 */
export async function discoverOrcaCatalog(
    options: DiscoverCatalogOptions = {},
): Promise<OrcaCatalogDiscoveryResult> {
    const now = options.now ?? Date.now;
    const fetchImpl = options.fetchImpl ?? fetch;
    const resolved = resolveOrcaOrigins(options.origins);
    // An explicit base URL is normalized through the same policy as the
    // environment overrides: HTTPS required off loopback. A credential must
    // never be sent to a plaintext remote host just because a caller passed a
    // raw string, so an unusable override is refused rather than used.
    const explicit = normalizeOrcaOrigin(options.apiBaseUrl, { allowHttpLoopback: true });
    const apiBaseUrl =
        options.apiBaseUrl?.trim() && !explicit ? null : (explicit ?? resolved.apiBaseUrl);
    const capability = options.capability ?? 'chat';
    const maxItems = options.maxItems ?? ORCA_CATALOG_MAX_ITEMS;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? ORCA_CATALOG_TIMEOUT_MS);
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onExternalAbort, { once: true });

    const fallback = (reason: string, status: number | null = null): OrcaCatalogDiscoveryResult => ({
        models: filterModelsForCapability(getFallbackCatalog(), capability),
        source: 'fallback',
        degradedReason: reason,
        fetchedAt: now(),
        truncated: false,
        status,
    });

    if (!apiBaseUrl) {
        return fallback('The configured OrcaRouter API base URL is not a usable HTTPS origin.');
    }

    try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        // Prefer the user's key so the catalog reflects what *their* workspace
        // can actually call. The key stays inside this function/process.
        if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;

        const response = await fetchImpl(buildApiUrl(apiBaseUrl, '/models'), {
            method: 'GET',
            headers,
            signal: controller.signal,
        });

        if (!response.ok) {
            return fallback(`OrcaRouter model catalog returned HTTP ${response.status}.`, response.status);
        }

        const raw = await readBoundedBody(response, ORCA_CATALOG_MAX_BYTES);
        let payload: any;
        try {
            payload = JSON.parse(raw.text);
        } catch {
            return fallback('OrcaRouter model catalog was not valid JSON.');
        }

        const items: unknown[] = Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload)
              ? payload
              : [];

        if (items.length === 0) {
            return fallback('OrcaRouter model catalog was empty.');
        }

        const truncated = items.length > maxItems || raw.truncated;
        const parsed = items
            .slice(0, maxItems)
            .map((item) => parseCatalogRecord(item))
            .filter((model): model is OrcaModel => model !== null);

        if (parsed.length === 0) {
            return fallback('OrcaRouter model catalog contained no usable records.');
        }

        // Deduplicate on id, keeping the first occurrence.
        const seen = new Set<string>();
        const deduped = parsed.filter((model) => {
            if (seen.has(model.id)) return false;
            seen.add(model.id);
            return true;
        });

        const usable = filterModelsForCapability(deduped, capability);
        if (usable.length === 0) {
            return fallback(
                `OrcaRouter model catalog advertised no ${capability}-capable models for this client.`,
            );
        }

        return {
            models: usable,
            source: 'live',
            degradedReason: null,
            fetchedAt: now(),
            truncated,
            status: response.status,
        };
    } catch (error) {
        if ((error as Error)?.name === 'AbortError' && options.signal?.aborted) {
            return fallback('OrcaRouter model discovery was cancelled.');
        }
        if ((error as Error)?.name === 'AbortError') {
            return fallback('OrcaRouter model catalog timed out.');
        }
        return fallback('Could not reach the OrcaRouter model catalog.');
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onExternalAbort);
    }
}

/**
 * Read a response body with a hard byte cap, so a hostile or broken catalog
 * cannot consume unbounded memory.
 */
async function readBoundedBody(
    response: Response,
    maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
    const declared = Number(response.headers?.get?.('content-length') ?? '');
    if (Number.isFinite(declared) && declared > maxBytes) {
        return { text: '', truncated: true };
    }
    const text = await response.text();
    if (text.length > maxBytes) {
        return { text: '', truncated: true };
    }
    return { text, truncated: false };
}

/**
 * Convert a catalog entry into the `Model` shape the rest of the extension
 * consumes, preserving capability metadata the UI relies on.
 */
export function toStoreModel(model: OrcaModel): {
    id: string;
    provider: string;
    name: string;
    group: string;
    description?: string;
    type?: ModelType[];
} {
    const types: ModelType[] = ['text'];
    if (model.inputModalities.includes('image')) types.push('vision');
    if (model.reasoning) types.push('reasoning');
    const capabilityNote = [
        model.contextLength ? `context ${model.contextLength.toLocaleString()}` : null,
        model.inputModalities.length > 0 ? `input ${model.inputModalities.join('/')}` : null,
        model.reasoningEfforts.length > 0 ? `effort ${model.reasoningEfforts.join('/')}` : null,
    ]
        .filter(Boolean)
        .join(' · ');

    return {
        id: model.id,
        provider: 'orcarouter',
        name: model.name,
        group: model.group,
        description: capabilityNote || undefined,
        type: types,
    };
}
