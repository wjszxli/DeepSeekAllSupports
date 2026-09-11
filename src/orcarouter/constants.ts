/**
 * OrcaRouter provider constants.
 *
 * Authentication and inference live on *different* public origins. Never derive
 * one from the other by swapping a hostname or blindly appending `/v1`:
 *   - authorize + code exchange:  https://www.orcarouter.ai
 *   - inference + model catalog:  https://api.orcarouter.ai/v1
 * The single most common integration mistake is posting to
 * `https://api.orcarouter.ai/v1/auth/keys`, which is a 404. The exchange path
 * is fixed at `/api/v1/auth/keys` under the *auth* origin.
 */

/** Public authentication origin (consent screen + code exchange). */
export const ORCA_DEFAULT_AUTH_BASE_URL = 'https://www.orcarouter.ai';

/** Public inference / model-catalog origin, already including the `/v1` prefix. */
export const ORCA_DEFAULT_API_BASE_URL = 'https://api.orcarouter.ai/v1';

/** Consent screen. Opened in a browser tab; not an API. */
export const ORCA_AUTHORIZE_PATH = '/auth';

/** Code exchange endpoint, relative to the *auth* origin. */
export const ORCA_EXCHANGE_PATH = '/api/v1/auth/keys';

/** Device-grant endpoints (Flow C), relative to the *auth* origin. */
export const ORCA_DEVICE_CODE_PATH = '/api/v1/auth/device/code';
export const ORCA_DEVICE_TOKEN_PATH = '/api/v1/auth/device/token';

/** OIDC discovery document, relative to the *auth* origin. */
export const ORCA_DISCOVERY_PATH = '/.well-known/openid-configuration';

/** Requested scope. Anything other than `api` / `connector` is refused upstream. */
export const ORCA_DEFAULT_SCOPE = 'api';

/** Scope that must actually be granted for this provider to be usable. */
export const ORCA_REQUIRED_SCOPE = 'api';

/** `callback_url` sentinel that selects Flow B (out-of-band code). */
export const ORCA_OOB_CALLBACK = 'oob';

/** Label shown on the consent screen. It is a claim, so keep it plain. */
export const ORCA_APP_NAME = 'AiAllSupport';

export const ORCA_PROVIDER_ID = 'orcarouter';
export const ORCA_OAUTH_PROVIDER_ID = 'orcarouter-oauth';

/** Where the user manages and revokes keys issued to this app. */
export const ORCA_KEY_DASHBOARD_URL = 'https://www.orcarouter.ai/console/authorized-apps';
export const ORCA_CONSOLE_URL = 'https://www.orcarouter.ai/';

/**
 * Environment overrides for self-hosted deployments.
 *
 * `ORCA_BASE_URL` is a shared fallback used for both origins; the explicit
 * `ORCA_AUTH_BASE_URL` / `ORCA_API_BASE_URL` win over it. A value supplied in
 * the provider config UI wins over both, so a self-hosted install does not need
 * a rebuilt bundle.
 */
export const ORCA_ENV_KEYS = {
    shared: 'ORCA_BASE_URL',
    auth: 'ORCA_AUTH_BASE_URL',
    api: 'ORCA_API_BASE_URL',
} as const;

/**
 * Read an environment variable without assuming a Node runtime. The options UI
 * and content scripts run in a browser, where `process` may be undefined.
 */
export function readEnv(key: string): string | undefined {
    try {
        const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
            .process?.env;
        const value = env?.[key];
        return typeof value === 'string' && value.trim() ? value.trim() : undefined;
    } catch {
        return undefined;
    }
}

export interface OrcaOriginOverrides {
    /** Explicit auth origin from the provider config; highest precedence. */
    authBaseUrl?: string | null;
    /** Explicit inference origin from the provider config; highest precedence. */
    apiBaseUrl?: string | null;
}

/** Loopback hosts allowed to use plain `http://` for a callback or a self-hosted base. */
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function isLoopbackHostname(hostname: string): boolean {
    return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase());
}

/**
 * Normalize a user/system supplied origin and enforce the transport policy:
 * remote origins must be HTTPS, plain HTTP is only allowed on loopback.
 *
 * Returns `undefined` for anything that cannot be used, so a bad override falls
 * back to the public default instead of silently pointing credentials at a
 * plaintext host.
 */
export function normalizeOrcaOrigin(
    value: string | null | undefined,
    options: { allowHttpLoopback?: boolean } = {},
): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        return undefined;
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    if (url.username || url.password) return undefined;
    if (url.search || url.hash) return undefined;

    if (url.protocol === 'http:') {
        // Loopback is the only plaintext exception, matching the callback policy.
        if (options.allowHttpLoopback === false) return undefined;
        if (!isLoopbackHostname(url.hostname)) return undefined;
    }

    // Strip a trailing slash so callers can concatenate fixed paths safely.
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.host}${path}`;
}

/**
 * Resolve the two OrcaRouter origins with the documented precedence:
 * provider config → explicit env override → shared env fallback → public default.
 * The auth and API origins are resolved independently and are never derived
 * from one another.
 */
export function resolveOrcaOrigins(overrides: OrcaOriginOverrides = {}): {
    authBaseUrl: string;
    apiBaseUrl: string;
    authSource: 'config' | 'env-auth' | 'env-shared' | 'default';
    apiSource: 'config' | 'env-api' | 'env-shared' | 'default';
} {
    const shared = normalizeOrcaOrigin(readEnv(ORCA_ENV_KEYS.shared));

    const authFromConfig = normalizeOrcaOrigin(overrides.authBaseUrl);
    const authFromEnv = normalizeOrcaOrigin(readEnv(ORCA_ENV_KEYS.auth));
    const authBaseUrl =
        authFromConfig ??
        authFromEnv ??
        shared ??
        ORCA_DEFAULT_AUTH_BASE_URL;

    const apiFromConfig = normalizeOrcaOrigin(overrides.apiBaseUrl, { allowHttpLoopback: true });
    const apiFromEnv = normalizeOrcaOrigin(readEnv(ORCA_ENV_KEYS.api), { allowHttpLoopback: true });
    const apiBaseUrl = apiFromConfig ?? apiFromEnv ?? shared ?? ORCA_DEFAULT_API_BASE_URL;

    return {
        authBaseUrl,
        apiBaseUrl,
        authSource: authFromConfig
            ? 'config'
            : authFromEnv
              ? 'env-auth'
              : shared
                ? 'env-shared'
                : 'default',
        apiSource: apiFromConfig
            ? 'config'
            : apiFromEnv
              ? 'env-api'
              : shared
                ? 'env-shared'
                : 'default',
    };
}

/** Build the fixed authorize URL. The path is never configurable and never `/v1`. */
export function buildAuthorizeUrl(authBaseUrl: string): string {
    return `${authBaseUrl.replace(/\/+$/, '')}${ORCA_AUTHORIZE_PATH}`;
}

/**
 * Build the fixed code-exchange URL. Deliberately hardcoded to
 * `/api/v1/auth/keys` under the auth origin — not `/v1/auth/keys`.
 */
export function buildExchangeUrl(authBaseUrl: string): string {
    return `${authBaseUrl.replace(/\/+$/, '')}${ORCA_EXCHANGE_PATH}`;
}

export function buildDeviceCodeUrl(authBaseUrl: string): string {
    return `${authBaseUrl.replace(/\/+$/, '')}${ORCA_DEVICE_CODE_PATH}`;
}

export function buildDeviceTokenUrl(authBaseUrl: string): string {
    return `${authBaseUrl.replace(/\/+$/, '')}${ORCA_DEVICE_TOKEN_PATH}`;
}

/** Build an inference URL under the API origin, tolerating a trailing slash. */
export function buildApiUrl(apiBaseUrl: string, path: string): string {
    const base = apiBaseUrl.replace(/\/+$/, '');
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${base}${suffix}`;
}
