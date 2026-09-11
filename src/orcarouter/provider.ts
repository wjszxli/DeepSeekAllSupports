/**
 * OrcaRouter provider orchestration.
 *
 * Everything that is specific to *being* the OrcaRouter provider lives here so
 * the registry, the GUI, and the request path each stay thin:
 *
 *  - which provider ids are OrcaRouter (the two auth entries)
 *  - how a model catalog is discovered and filtered for an entry point
 *  - how a discovered catalog is projected onto the shared `Model` shape
 *
 * The credential seam itself is in `credentials.ts`; the interactive login is
 * in `loginSession.ts`. Nothing here inspects which adapter produced a key.
 */

import type { Model, Provider } from '@/types';
import {
    ORCA_OAUTH_PROVIDER_ID,
    ORCA_PROVIDER_ID,
    
    type OrcaOriginOverrides,
} from './constants';
import {
    discoverOrcaCatalog,
    filterModelsForCapability,
    getFallbackCatalog,
    isModelStillCompatible,
    toStoreModel,
    type OrcaCapability,
    type OrcaCatalogResult,
    type OrcaInputModality,
    type OrcaModel,
} from './catalog';
import { sanitizeErrorText, type OrcaCredential } from './credentials';
import llmStore from '@/store/llm';
import orcaRouterStore from './store';

export const ORCA_PROVIDER_IDS = [ORCA_PROVIDER_ID, ORCA_OAUTH_PROVIDER_ID] as const;

/** True for either OrcaRouter entry. Both share one inference adapter. */
export function isOrcaRouterProvider(provider: Provider | null | undefined): boolean {
    if (!provider) return false;
    return (ORCA_PROVIDER_IDS as readonly string[]).includes(provider.id);
}

/**
 * The provider that actually holds the shared OrcaRouter credential.
 *
 * The two entries are two auth choices for one gateway, and a user has one
 * OrcaRouter account — so the credential is stored once. Whichever entry the
 * user configured owns it; the other falls back to it. This is what lets a key
 * pasted under "OrcaRouter - API" be reused by "OrcaRouter - Auth" without a
 * second login.
 */
export function resolveCredentialProviderId(provider: Provider): string {
    if (provider.apiKey?.trim()) return provider.id;
    const other = ORCA_PROVIDER_IDS.find((id) => id !== provider.id);
    const otherProvider = other ? llmStore.providers.find((item) => item.id === other) : null;
    if (otherProvider?.apiKey?.trim()) return otherProvider.id;
    return provider.id;
}

/** Origins for a provider, honouring a per-install override in the provider config. */
export function originsForProvider(provider: Provider): OrcaOriginOverrides {
    const extras = provider as Provider & { authBaseUrl?: string };
    return {
        authBaseUrl: extras.authBaseUrl ?? null,
        apiBaseUrl: provider.apiHost ?? null,
    };
}

/**
 * Resolve the catalog for a provider.
 *
 * Live discovery is authoritative when it succeeds. On failure the result is a
 * verified fallback carrying a degraded reason, which the UI must surface —
 * never silently presented as the full catalog, and never replaced by a free
 * text field.
 */
export async function discoverModelsForProvider(
    provider: Provider,
    capability: OrcaCapability = 'chat',
    options: { signal?: AbortSignal; apiKey?: string | null } = {},
): Promise<{ models: Model[]; result: OrcaCatalogResult }> {
    const credentialProviderId = resolveCredentialProviderId(provider);
    const credential = orcaRouterStore.read(credentialProviderId);

    const result = await discoverOrcaCatalog({
        origins: originsForProvider(provider),
        apiBaseUrl: provider.apiHost,
        // Prefer the user's own key so the list reflects what their workspace
        // can actually call. It stays inside the discovery call.
        apiKey: options.apiKey ?? credential?.apiKey ?? null,
        signal: options.signal,
        capability,
        maxItems: undefined,
    });

    const models = result.models.map((model) => ({
        ...toStoreModel(model),
        // Keep the entry's own id so the existing `provider#modelId` selection
        // scheme keeps working for both auth choices.
        provider: provider.id,
    }));

    orcaRouterStore.saveCatalog(provider.id, { ...result, models: result.models });
    return { models, result };
}

/**
 * Re-filter an already-discovered catalog without another network call.
 *
 * Used when the entry point changes — attaching an image, switching task type,
 * or switching provider — so the options handed to the model selector are
 * always the ones valid for the current request.
 */
export function refilterModels(
    provider: Provider,
    capability: OrcaCapability,
    modality: OrcaInputModality = 'text',
): { models: Model[]; source: 'live' | 'fallback'; degradedReason: string | null } {
    const cached = orcaRouterStore.getCatalog(provider.id);

    if (!cached) {
        const seeded = filterModelsForCapability(getFallbackCatalog(), capability, modality);
        return {
            models: seeded.map((model) => ({ ...toStoreModel(model), provider: provider.id })),
            source: 'fallback',
            degradedReason: 'No OrcaRouter catalog has been loaded yet.',
        };
    }

    const filtered = filterModelsForCapability(cached.models, capability, modality);
    return {
        models: filtered.map((model) => ({ ...toStoreModel(model), provider: provider.id })),
        source: cached.source,
        degradedReason: cached.degradedReason,
    };
}

/**
 * Whether a stored selection is still offered for the current entry point.
 * When it is not, the caller must clear it and ask the user to pick again rather
 * than silently keep a value the request cannot use.
 */
export function isSelectionStillValid(
    provider: Provider,
    modelId: string | null | undefined,
    capability: OrcaCapability,
    modality: OrcaInputModality = 'text',
): boolean {
    const cached = orcaRouterStore.getCatalog(provider.id);
    const catalog = cached ? cached.models : getFallbackCatalog();
    return isModelStillCompatible(catalog, modelId, capability, modality);
}

/**
 * A short, sanitized status line for the provider card. Never contains a key.
 */
export function describeCredential(credential: OrcaCredential | null): string {
    if (!credential?.apiKey) return 'Not connected';
    if (credential.status === 'needsReauth') return 'Reconnect required';
    const tail = credential.apiKey.slice(-4);
    return credential.source === 'pkce'
        ? `Connected with OrcaRouter account (…${tail})`
        : `Using pasted API key (…${tail})`;
}

export function describeCatalogState(
    result: Pick<OrcaCatalogResult, 'source' | 'degradedReason' | 'models'> | null,
): string {
    if (!result) return 'Model catalog not loaded';
    if (result.source === 'live') return `${result.models.length} models from OrcaRouter`;
    return `Offline: using ${result.models.length} verified fallback models${
        result.degradedReason ? ` (${sanitizeErrorText(result.degradedReason, 80)})` : ''
    }`;
}



export {resolveOrcaOrigins} from './constants';
/* ------------------------------------------------------------------ *
 * GUI catalog requests
 * ------------------------------------------------------------------ */

/**
 * Ask the extension's service worker for the model catalog.
 *
 * The options page never issues the authenticated catalog request itself: it
 * asks the background context, which holds the credential and returns only
 * model metadata. This reuses the project's existing message-passing boundary
 * (`chrome.runtime.sendMessage`) rather than inventing a second one.
 *
 * Falls back to in-page discovery when no background context is available
 * (the content-script paths, and the test harness), so the picker is never left
 * empty merely because a message channel is missing.
 */
export async function requestModelsForProvider(
    provider: Provider,
    capability: OrcaCapability = 'all',
): Promise<{ models: OrcaModel[]; source: 'live' | 'fallback'; degradedReason: string | null }> {
    const runtime = (globalThis as { chrome?: typeof chrome }).chrome?.runtime;
    const canMessage = Boolean(runtime?.sendMessage) && typeof runtime?.id === 'string';

    if (canMessage) {
        try {
            const response = await runtime!.sendMessage({
                action: 'orcaListModels',
                providerId: provider.id,
                capability,
            });
            if (response?.success && Array.isArray(response.models)) {
                return {
                    models: response.models as OrcaModel[],
                    source: response.source === 'live' ? 'live' : 'fallback',
                    degradedReason: response.degradedReason ?? null,
                };
            }
        } catch {
            // Fall through: a missing service worker must not blank the picker.
        }
    }

    const { result } = await discoverModelsForProvider(provider, capability);
    return {
        models: result.models,
        source: result.source,
        degradedReason: result.degradedReason,
    };
}

/**
 * Derive the model-selector options for one input type.
 *
 * This is the single place the GUI turns a catalog into selector `options`, so
 * every consumer — the provider panel, the modal's default-model field, and the
 * global model settings — filters identically and the incompatible-value rule
 * is applied once.
 */
export function buildModelOptions(
    catalog: OrcaModel[],
    capability: OrcaCapability,
    modality: OrcaInputModality = 'text',
    providerId = ORCA_PROVIDER_ID,
): Model[] {
    return filterModelsForCapability(catalog, capability, modality).map((model) => ({
        ...toStoreModel(model),
        provider: providerId,
    }));
}

/**
 * The model id a selection must fall back to, or `null` when the current
 * selection is still valid. Clearing is mandatory: a value the request cannot
 * use must never survive silently.
 */
export function reconcileSelection(
    catalog: OrcaModel[],
    selectedModelId: string | null | undefined,
    capability: OrcaCapability,
    modality: OrcaInputModality = 'text',
): { valid: boolean; replacementId: string | null } {
    const options = buildModelOptions(catalog, capability, modality);
    const valid = options.some((model) => model.id === selectedModelId);
    return { valid, replacementId: valid ? (selectedModelId ?? null) : (options[0]?.id ?? null) };
}

/**
 * Compose the catalog status line from the parts the GUI actually receives.
 * Kept here so the wording is consistent between the provider panel and the
 * modal footer, and so the degraded notice can never be dropped silently.
 */
export function resolveCatalogState(
    source: 'live' | 'fallback',
    modelCount: number,
    degradedReason: string | null,
): string {
    if (source === 'live') {
        return `${modelCount} models from OrcaRouter`;
    }
    const reason = degradedReason ? ` (${sanitizeErrorText(degradedReason, 80)})` : '';
    return `Offline: using ${modelCount} verified fallback models${reason}`;
}
