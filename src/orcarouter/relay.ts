/**
 * The OrcaRouter inference relay.
 *
 * One place that knows how to turn "a credential for provider X" into an
 * authenticated request against `https://api.orcarouter.ai/v1`. Every AI entry
 * point goes through the LangChain adapter, which reads `provider.apiKey`; this
 * module exists for the paths that talk to the relay directly (model discovery,
 * validation, and the reauth transition) so the Bearer-header and 401 policy
 * are not re-implemented per call site.
 */

import {
    ORCA_DEFAULT_API_BASE_URL,
    buildApiUrl,
    normalizeOrcaOrigin,
    type OrcaOriginOverrides,
    resolveOrcaOrigins,
} from './constants';
import {
    classifyRelayResponse,
    type OrcaCredential,
    type OrcaCredentialStore,
} from './credentials';

export interface OrcaRelayOptions {
    providerId: string;
    origins?: OrcaOriginOverrides;
    apiBaseUrl?: string | null;
    store: OrcaCredentialStore;
    /** Called when a 401 marks the exact rejected generation as needing reauth. */
    onNeedsReauth?: (providerId: string, generation: number) => void;
    fetchImpl?: typeof fetch;
}

export interface OrcaRelayRequest {
    path: string;
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    /** Credential snapshot that is making this request; defaults to the stored one. */
    credential?: OrcaCredential;
}

export type OrcaRelayOutcome =
    | { ok: true; response: Response }
    | { ok: false; kind: 'no_credential' | 'needs_reauth' | 'http_error' | 'network'; status: number | null; message: string };

/**
 * A credential is only usable while it is `active`. A `needsReauth` credential
 * is left in place (so the user does not lose the account) but nothing is sent
 * with it until a new login succeeds.
 */
export function isCredentialUsable(credential: OrcaCredential | null): credential is OrcaCredential {
    return Boolean(credential && credential.status === 'active' && credential.apiKey);
}

export interface OrcaInferenceSpec {
    path: string;
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
}

/**
 * Send one inference request through the shared OrcaRouter relay.
 *
 * This is the single place that decides where an OrcaRouter request goes and
 * how it is authenticated. It is deliberately provider-id agnostic: the two
 * auth entries differ only in how their key was obtained, so both reach the same
 * inference origin (`https://api.orcarouter.ai/v1`) with the same Bearer header.
 *
 * A plaintext remote base URL is refused outright rather than used, so a
 * misconfigured override cannot leak a credential.
 */
export async function emitInferenceRequest(
    provider: { id: string; apiKey?: string | null; apiHost?: string | null },
    spec: OrcaInferenceSpec,
    fetchImpl: typeof fetch = fetch,
): Promise<OrcaRelayOutcome> {
    const apiKey = provider.apiKey?.trim();
    if (!apiKey) {
        return {
            ok: false,
            kind: 'no_credential',
            status: null,
            message: 'No OrcaRouter credential is configured for this entry.',
        };
    }

    const explicit = normalizeOrcaOrigin(provider.apiHost, { allowHttpLoopback: true });
    if (provider.apiHost?.trim() && !explicit) {
        return {
            ok: false,
            kind: 'network',
            status: null,
            message: 'The configured OrcaRouter API base URL is not a usable HTTPS origin.',
        };
    }
    const apiBaseUrl = explicit ?? ORCA_DEFAULT_API_BASE_URL;
    const url = buildApiUrl(apiBaseUrl, spec.path);

    let response: Response;
    try {
        response = await fetchImpl(url, {
            method: spec.method ?? 'POST',
            headers: {
                ...(spec.body === undefined ? {} : { 'Content-Type': 'application/json' }),
                Authorization: `Bearer ${apiKey}`,
                ...spec.headers,
            },
            body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
            signal: spec.signal,
        });
    } catch (error) {
        return {
            ok: false,
            kind: 'network',
            status: null,
            message:
                (error as Error)?.name === 'AbortError'
                    ? 'Request cancelled.'
                    : 'Could not reach OrcaRouter.',
        };
    }

    const classification = classifyRelayResponse(response.status);
    if (classification.kind === 'ok') return { ok: true, response };
    return {
        ok: false,
        kind: classification.kind === 'needs_reauth' ? 'needs_reauth' : 'http_error',
        status: response.status,
        message: classification.message ?? `OrcaRouter returned HTTP ${response.status}.`,
    };
}

export class OrcaRelay {
    constructor(private readonly options: OrcaRelayOptions) {}

    private resolveApiBase(): string {
        if (this.options.apiBaseUrl?.trim()) return this.options.apiBaseUrl.trim();
        return resolveOrcaOrigins(this.options.origins).apiBaseUrl;
    }

    /** Current credential, or `null` when nothing usable is stored. */
    getCredential(): OrcaCredential | null {
        return this.options.store.read(this.options.providerId);
    }

    /**
     * Send an authenticated request. On a `401`/`403` the relay marks the exact
     * credential generation that made the call as `needsReauth`. It never
     * retries, never refreshes, and never deletes the stored secret — a revoked
     * durable key needs a new login, and deleting it before that would turn a
     * transient failure into irreversible loss.
     */
    async request(request: OrcaRelayRequest): Promise<OrcaRelayOutcome> {
        const credential = request.credential ?? this.getCredential();
        if (!credential?.apiKey) {
            return {
                ok: false,
                kind: 'no_credential',
                status: null,
                message: 'No OrcaRouter credential is configured for this entry.',
            };
        }
        if (credential.status === 'needsReauth') {
            return {
                ok: false,
                kind: 'needs_reauth',
                status: null,
                message: 'This OrcaRouter account needs to be reconnected before it can be used.',
            };
        }

        const fetchImpl = this.options.fetchImpl ?? fetch;
        const url = buildApiUrl(this.resolveApiBase(), request.path);

        let response: Response;
        try {
            response = await fetchImpl(url, {
                method: request.method ?? 'GET',
                headers: {
                    ...(request.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                    Authorization: `Bearer ${credential.apiKey}`,
                    ...request.headers,
                },
                body: request.body === undefined ? undefined : JSON.stringify(request.body),
                signal: request.signal,
            });
        } catch (error) {
            return {
                ok: false,
                kind: 'network',
                status: null,
                message: (error as Error)?.name === 'AbortError' ? 'Request cancelled.' : 'Could not reach OrcaRouter.',
            };
        }

        const classification = classifyRelayResponse(response.status);
        if (classification.kind === 'needs_reauth') {
            // Generation-safe: only the exact credential that made this request
            // is marked. A late 401 from a since-replaced credential is dropped.
            const changed = this.markRejected(credential);
            return {
                ok: false,
                kind: 'needs_reauth',
                status: response.status,
                message: changed
                    ? 'OrcaRouter rejected this key. Reconnect the account to continue.'
                    : 'A superseded OrcaRouter credential was rejected; the current one is unaffected.',
            };
        }
        if (classification.kind !== 'ok') {
            return {
                ok: false,
                kind: 'http_error',
                status: response.status,
                message: classification.message ?? `OrcaRouter returned HTTP ${response.status}.`,
            };
        }

        return { ok: true, response };
    }

    private markRejected(credential: OrcaCredential): boolean {
        const current = this.options.store.read(this.options.providerId);
        if (current?.generation !== credential.generation) return false;
        if (current.accountId && credential.accountId && current.accountId !== credential.accountId) {
            return false;
        }
        // Delegate the write so a store that tracks reauth state centrally stays
        // the single owner of it.
        const store = this.options.store as OrcaCredentialStore & {
            markNeedsReauth?: (providerId: string, generation: number) => boolean;
        };
        if (typeof store.markNeedsReauth === 'function') {
            const changed = store.markNeedsReauth(this.options.providerId, credential.generation);
            if (changed) this.options.onNeedsReauth?.(this.options.providerId, credential.generation);
            return changed;
        }
        this.options.store.write({ ...credential, status: 'needsReauth' });
        this.options.onNeedsReauth?.(this.options.providerId, credential.generation);
        return true;
    }
}
