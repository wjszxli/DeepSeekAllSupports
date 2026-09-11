/**
 * The OrcaRouter credential seam.
 *
 * Both user-facing ways of getting an OrcaRouter credential — pasting an
 * `sk-orca-…` key, or authorizing through OAuth 2.0 + PKCE — are adapters on
 * this one interface. Everything downstream (the LangChain adapter, the model
 * catalog, every AI entry point) consumes an `OrcaCredential` and does not know
 * or care which adapter produced it.
 *
 * A PKCE-issued key is a **durable API key**, not an access token: there is no
 * refresh grant, so this module never refreshes and never fabricates one.
 */

import {
    ORCA_DEFAULT_SCOPE,
    ORCA_REQUIRED_SCOPE,
    buildExchangeUrl,
    type OrcaOriginOverrides,
    resolveOrcaOrigins,
} from './constants';

export type OrcaCredentialSource = 'api-key' | 'pkce';

export interface OrcaCredential {
    /** Provider id this credential belongs to (`orcarouter` or `orcarouter-oauth`). */
    providerId: string;
    source: OrcaCredentialSource;
    /** The bearer token. Identical shape (`sk-orca-…`) whichever adapter produced it. */
    apiKey: string;
    /** Scope actually granted. `null` until an exchange or a request has reported one. */
    scope: string | null;
    /** Owning account, when the exchange reported one. Used for exact-account reauth. */
    accountId: string | null;
    /**
     * Monotonic per-write counter. A `401` marks only the exact
     * `{providerId, generation}` that issued the rejected request; a late
     * failure from an older generation can never poison a newer credential.
     */
    generation: number;
    createdAt: number;
    status: 'active' | 'needsReauth';
}

export type OrcaAuthErrorCode =
    | 'denied'
    | 'state_mismatch'
    | 'timeout'
    | 'cancelled'
    | 'code_expired_or_used'
    | 'challenge_method_rejected'
    | 'verifier_mismatch'
    | 'scope_downgrade'
    | 'rate_limited'
    | 'network'
    | 'invalid_response'
    | 'invalid_key_format'
    | 'needs_reauth';

export interface OrcaAuthError {
    code: OrcaAuthErrorCode;
    /** User-facing, already sanitized. Never contains a key, code, or verifier. */
    message: string;
    /** Whether the user should be offered the connect flow again. */
    reauthRequired: boolean;
}

export type OrcaCredentialResult =
    | { ok: true; credential: OrcaCredential }
    | { ok: false; error: OrcaAuthError };

/** Anything that can hold a credential. Implemented by the provider store. */
export interface OrcaCredentialStore {
    read(providerId: string): OrcaCredential | null;
    write(credential: OrcaCredential): void;
    clear(providerId: string): void;
}

/** The seam. Two adapters implement it; consumers depend only on this. */
export interface OrcaCredentialAdapter {
    readonly source: OrcaCredentialSource;
    /** Acquire a credential. May be interactive. */
    acquire(): Promise<OrcaCredentialResult>;
}

/* ------------------------------------------------------------------ *
 * Redaction
 * ------------------------------------------------------------------ */

const KEY_PATTERN = /sk-orca-[\w-]{4,}/g;
const LONG_TOKEN_PATTERN = /[\w-]{40,}/g;

/**
 * Strip anything that looks like a credential out of arbitrary text before it
 * reaches a log, an error message, or telemetry. Response bodies are untrusted
 * for this purpose — an upstream error must never be able to echo a key back
 * into our UI.
 */
export function sanitizeErrorText(input: unknown, maxLength = 200): string {
    const text = typeof input === 'string' ? input : String(input ?? '');
    const cleaned = text
        .replace(KEY_PATTERN, '[redacted-key]')
        .replace(LONG_TOKEN_PATTERN, '[redacted]')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}

/**
 * Masked representation for display only. Shows enough of the prefix to let a
 * user recognize which key is configured, and never enough to use it.
 */
export function maskApiKey(apiKey: string | null | undefined): string {
    if (!apiKey) return '';
    const trimmed = apiKey.trim();
    if (trimmed.length <= 12) return '••••••••';
    return `${trimmed.slice(0, 8)}${'•'.repeat(8)}${trimmed.slice(-4)}`;
}

/**
 * Lightweight format check only. An `sk-orca-…` prefix is **not** proof of
 * validity; the first real request establishes that. Returns an error message
 * (already sanitized) or `null` when the shape looks acceptable.
 */
export function checkApiKeyFormat(apiKey: string): string | null {
    const trimmed = (apiKey || '').trim();
    if (!trimmed) return 'Enter an OrcaRouter API key.';
    if (!trimmed.startsWith('sk-orca-')) {
        return 'OrcaRouter API keys start with "sk-orca-".';
    }
    if (trimmed.length < 16) return 'That OrcaRouter API key looks too short.';
    if (/\s/.test(trimmed)) return 'An OrcaRouter API key does not contain spaces.';
    return null;
}

/* ------------------------------------------------------------------ *
 * Error construction
 * ------------------------------------------------------------------ */

function authError(
    code: OrcaAuthErrorCode,
    message: string,
    reauthRequired = true,
): OrcaCredentialResult {
    return { ok: false, error: { code, message, reauthRequired } };
}

/* ------------------------------------------------------------------ *
 * Code exchange
 * ------------------------------------------------------------------ */

export interface ExchangeRequest {
    authBaseUrl: string;
    code: string;
    codeVerifier: string;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    timeoutMs?: number;
}

const DEFAULT_EXCHANGE_TIMEOUT_MS = 30_000;

/**
 * Exchange an auth code for a durable OrcaRouter API key.
 *
 * Posts JSON to the **auth** origin's `/api/v1/auth/keys` — never
 * `/v1/auth/keys` on the inference origin, which 404s. The verifier is sent in
 * the body only; it is never placed in a URL.
 */
export async function exchangeAuthCode(request: ExchangeRequest): Promise<OrcaCredentialResult> {
    const doFetch = request.fetchImpl ?? fetch;
    const url = buildExchangeUrl(request.authBaseUrl);

    const controller = new AbortController();
    const timeoutMs = request.timeoutMs ?? DEFAULT_EXCHANGE_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    request.signal?.addEventListener('abort', onExternalAbort, { once: true });

    try {
        const response = await doFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: request.code,
                code_verifier: request.codeVerifier,
                code_challenge_method: 'S256',
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            return authError(...mapExchangeFailure(response.status));
        }

        let payload: { key?: unknown; user_id?: unknown; scope?: unknown };
        try {
            payload = await response.json();
        } catch {
            return authError(
                'invalid_response',
                'OrcaRouter returned a response this client could not read.',
            );
        }

        const key = typeof payload.key === 'string' ? payload.key : '';
        if (!key.startsWith('sk-orca-')) {
            // Never echo the payload: it may itself contain a credential.
            return authError(
                'invalid_response',
                'OrcaRouter did not return a usable key. Try connecting again.',
            );
        }

        const grantedScope = typeof payload.scope === 'string' ? payload.scope : null;
        // Read the *granted* scope back rather than assuming the requested one.
        if (grantedScope !== ORCA_REQUIRED_SCOPE) {
            return authError(
                'scope_downgrade',
                `OrcaRouter granted the "${sanitizeErrorText(grantedScope ?? 'unknown')}" scope, ` +
                    `which is not enough for inference (needs "${ORCA_REQUIRED_SCOPE}"). ` +
                    'Ask a workspace admin to allow the api scope, or paste an API key instead.',
            );
        }

        const accountId =
            typeof payload.user_id === 'string' || typeof payload.user_id === 'number'
                ? String(payload.user_id)
                : null;

        return {
            ok: true,
            credential: {
                providerId: '',
                source: 'pkce',
                apiKey: key,
                scope: grantedScope,
                accountId,
                generation: 1,
                createdAt: Date.now(),
                status: 'active',
            },
        };
    } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
            if (request.signal?.aborted) return authError('cancelled', 'Authorization cancelled.', false);
            return authError('timeout', 'OrcaRouter authorization timed out. Try again.');
        }
        return authError('network', 'Could not reach OrcaRouter. Check your connection and retry.');
    } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener('abort', onExternalAbort);
    }
}

/** Map an HTTP failure from the exchange endpoint onto actionable guidance. */
function mapExchangeFailure(status: number): [OrcaAuthErrorCode, string] {
    switch (status) {
        case 400:
            return [
                'challenge_method_rejected',
                'OrcaRouter rejected the PKCE challenge. Start the connection again.',
            ];
        case 403:
            return [
                'code_expired_or_used',
                'That authorization code is expired, already used, or does not match this ' +
                    'attempt. Start the connection again.',
            ];
        case 429:
            return [
                'rate_limited',
                'OrcaRouter is rate-limiting new authorizations (10 per account per day). ' +
                    'The existing connection is reused automatically — try again later.',
            ];
        default:
            return ['network', `OrcaRouter could not complete the exchange (HTTP ${status}).`];
    }
}

/* ------------------------------------------------------------------ *
 * Adapter 1 — pasted API key
 * ------------------------------------------------------------------ */

export interface ApiKeyAdapterOptions {
    providerId: string;
    apiKey: string;
    store?: OrcaCredentialStore;
    now?: () => number;
}

/**
 * The non-interactive adapter: the user pastes a key they already have, using
 * the project's normal provider-secret mechanism. No browser, no PKCE.
 */
export function createApiKeyAdapter(options: ApiKeyAdapterOptions): OrcaCredentialAdapter {
    return {
        source: 'api-key',
        async acquire(): Promise<OrcaCredentialResult> {
            const formatError = checkApiKeyFormat(options.apiKey);
            if (formatError) return authError('invalid_key_format', formatError, false);

            const existing = options.store?.read(options.providerId) ?? null;
            const credential: OrcaCredential = {
                providerId: options.providerId,
                source: 'api-key',
                apiKey: options.apiKey.trim(),
                scope: ORCA_DEFAULT_SCOPE,
                accountId: existing?.accountId ?? null,
                // A pasted key replaces the previous credential: bump the
                // generation so in-flight 401 handling from the old key is dropped.
                generation: (existing?.generation ?? 0) + 1,
                createdAt: (options.now ?? Date.now)(),
                status: 'active',
            };
            options.store?.write(credential);
            return { ok: true, credential };
        },
    };
}

/* ------------------------------------------------------------------ *
 * Adapter 2 — OAuth 2.0 + PKCE
 * ------------------------------------------------------------------ */

/**
 * Interactive part of the PKCE flow, injected so the adapter stays testable.
 *
 * The verifier is handed back alongside the code rather than stashed in a
 * module-level variable: it must not outlive the attempt, and it must never be
 * written to storage, a URL, or a log.
 */
export interface PkceAuthorizer {
    authorize(): Promise<
        { ok: true; code: string; verifier: string } | { ok: false; error: OrcaAuthError }
    >;
}

export interface PkceAdapterOptions {
    providerId: string;
    authorizer: PkceAuthorizer;
    origins?: OrcaOriginOverrides;
    store?: OrcaCredentialStore;
    fetchImpl?: typeof fetch;
    now?: () => number;
    signal?: AbortSignal;
}

/**
 * The interactive adapter. It reuses a still-valid stored key instead of
 * minting a new one on every launch — OrcaRouter caps PKCE-issued keys at 10
 * per user per 24 hours, so re-authorizing on each start would lock the user
 * out. `force` is only used after a terminal `401`.
 */
export function createPkceAdapter(options: PkceAdapterOptions): OrcaCredentialAdapter & {
    acquire(opts?: { force?: boolean }): Promise<OrcaCredentialResult>;
} {
    return {
        source: 'pkce',
        async acquire(acquireOptions: { force?: boolean } = {}): Promise<OrcaCredentialResult> {
            const existing = options.store?.read(options.providerId) ?? null;
            if (!acquireOptions.force && existing?.status === 'active' && existing.apiKey) {
                // Reuse the durable key. No refresh grant exists to call.
                return { ok: true, credential: existing };
            }

            const authorized = await options.authorizer.authorize();
            if (!authorized.ok) return { ok: false, error: authorized.error };

            const { authBaseUrl } = resolveOrcaOrigins(options.origins);
            const exchanged = await exchangeAuthCode({
                authBaseUrl,
                code: authorized.code,
                codeVerifier: authorized.verifier,
                fetchImpl: options.fetchImpl,
                signal: options.signal,
            });

            if (!exchanged.ok) return exchanged;

            const credential: OrcaCredential = {
                ...exchanged.credential,
                providerId: options.providerId,
                source: 'pkce',
                generation: (existing?.generation ?? 0) + 1,
                createdAt: (options.now ?? Date.now)(),
            };
            // Persist only after a successful exchange; the old secret stays
            // until then so a transient failure cannot lose the account.
            options.store?.write(credential);
            return { ok: true, credential };
        },
    };
}

/* ------------------------------------------------------------------ *
 * Terminal 401 handling
 * ------------------------------------------------------------------ */

/**
 * Mark the *exact* account and credential generation that made a rejected
 * request as `needsReauth`.
 *
 * A late async failure from a request issued under an older generation must not
 * mark a credential the user has since replaced — that would break a freshly
 * reauthorized account. Returns the updated credential, or `null` when the
 * rejection is stale and should be ignored.
 */
export function markRejectedGeneration(
    current: OrcaCredential | null,
    rejected: { providerId: string; generation: number; accountId?: string | null },
): OrcaCredential | null {
    if (!current) return null;
    if (current.providerId !== rejected.providerId) return null;
    if (current.generation !== rejected.generation) return null;
    if (
        rejected.accountId != null &&
        current.accountId != null &&
        current.accountId !== rejected.accountId
    ) {
        return null;
    }
    return { ...current, status: 'needsReauth' };
}

export interface RelayResponseClassification {
    kind: 'ok' | 'needs_reauth' | 'rate_limited' | 'server_error' | 'client_error';
    /** True when the caller must re-run the connect flow rather than retry. */
    terminal: boolean;
    message?: string;
}

/**
 * Classify a relay (inference) response.
 *
 * A `401` means the durable key was revoked or rotated: that is a terminal
 * reauthentication requirement, not a retry loop and not a refresh. There is no
 * refresh endpoint to call.
 */
export function classifyRelayResponse(status: number): RelayResponseClassification {
    if (status >= 200 && status < 300) return { kind: 'ok', terminal: false };
    if (status === 401 || status === 403) {
        return {
            kind: 'needs_reauth',
            terminal: true,
            message:
                'OrcaRouter rejected this key. It was revoked or replaced — reconnect the account.',
        };
    }
    if (status === 429) {
        return { kind: 'rate_limited', terminal: false, message: 'OrcaRouter rate limit reached.' };
    }
    if (status >= 500) return { kind: 'server_error', terminal: false };
    return { kind: 'client_error', terminal: false };
}
