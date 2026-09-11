/**
 * PKCE primitives (RFC 7636) for the OrcaRouter connect flow.
 *
 * The verifier never leaves this process until the code exchange, and it is
 * never logged, printed, put in a URL, or included in an error message. Only
 * the S256 challenge travels on the authorize URL.
 */

/** RFC 7636 §4.1 allows 43..128 characters; 32 random bytes → 43 base64url chars. */
const VERIFIER_BYTES = 32;
/** 16 random bytes → 22 base64url chars. Opaque, and long enough to be unguessable. */
const STATE_BYTES = 16;

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * base64url without padding, per RFC 7636 §A.
 *
 * Implemented inline rather than via `btoa`/`Buffer`: the extension bundle runs
 * in a browser, where `Buffer` does not exist, and webpack cannot resolve a
 * `node:` import. SHA-256 and base64url both come from the standard library, so
 * no dependency is added.
 */
export function base64UrlEncode(bytes: Uint8Array): string {
    let out = '';
    for (let index = 0; index < bytes.length; index += 3) {
        const byte1 = bytes[index];
        const byte2 = bytes[index + 1];
        const byte3 = bytes[index + 2];
        const hasByte2 = index + 1 < bytes.length;
        const hasByte3 = index + 2 < bytes.length;

        out += BASE64URL_ALPHABET[byte1 >> 2];
        out += BASE64URL_ALPHABET[((byte1 & 0x03) << 4) | (hasByte2 ? byte2 >> 4 : 0)];
        if (hasByte2) {
            out += BASE64URL_ALPHABET[((byte2 & 0x0f) << 2) | (hasByte3 ? byte3 >> 6 : 0)];
        }
        if (hasByte3) {
            out += BASE64URL_ALPHABET[byte3 & 0x3f];
        }
    }
    return out;
}

/** Cryptographically secure random bytes. Throws rather than degrading to Math.random. */
export function randomBytes(length: number): Uint8Array {
    const globalCrypto = (globalThis as { crypto?: Crypto }).crypto;
    if (!globalCrypto?.getRandomValues) {
        throw new Error('OrcaRouter: no cryptographic RNG available');
    }
    const bytes = new Uint8Array(length);
    globalCrypto.getRandomValues(bytes);
    return bytes;
}

/** A fresh verifier. Every authorization attempt must call this again. */
export function createCodeVerifier(): string {
    return base64UrlEncode(randomBytes(VERIFIER_BYTES));
}

/** A fresh CSRF state token. */
export function createState(): string {
    return base64UrlEncode(randomBytes(STATE_BYTES));
}

/**
 * `base64url(sha256(ascii(verifier)))` with no padding — the only challenge
 * method this integration sends. `plain` is never used, including on Flow A,
 * because the user can choose "Show me a code" on the consent screen.
 */
export async function createCodeChallenge(verifier: string): Promise<string> {
    const globalCrypto = (globalThis as { crypto?: Crypto }).crypto;
    if (!globalCrypto?.subtle) {
        // WebCrypto is available in every target runtime (MV3 extension pages,
        // service worker, and Node 18+). Refuse rather than emit a weaker
        // challenge — a `plain` challenge is explicitly not acceptable here.
        throw new Error('OrcaRouter: WebCrypto SHA-256 is unavailable');
    }
    const digest = await globalCrypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Constant-time string comparison for the `state` echo.
 *
 * A short-circuiting `===` leaks how many leading characters matched, which is
 * exactly the signal a page trying to drop its own code on our loopback
 * listener would need.
 */
export function timingSafeEqualString(a: string | null | undefined, b: string | null | undefined): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;

    let mismatch = 0;
    for (let index = 0; index < a.length; index += 1) {
        mismatch |= (a.codePointAt(index) ?? 0) ^ (b.codePointAt(index) ?? 0);
    }
    return mismatch === 0;
}

export interface PkcePair {
    verifier: string;
    challenge: string;
    state: string;
}

/** Create one attempt's worth of PKCE material. Fresh randomness every call. */
export async function createPkcePair(): Promise<PkcePair> {
    const verifier = createCodeVerifier();
    const challenge = await createCodeChallenge(verifier);
    const state = createState();
    return { verifier, challenge, state };
}

/**
 * Validate a `callback_url` against the documented rules before we hand it to
 * the browser: https on any host/port, or http only on loopback; no userinfo,
 * no fragment.
 */
export function isValidCallbackUrl(rawUrl: string): boolean {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return false;
    }
    if (url.username || url.password) return false;
    if (url.hash) return false;
    if (url.protocol === 'https:') return true;
    if (url.protocol === 'http:') {
        const host = url.hostname.toLowerCase();
        return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
    }
    return false;
}

export interface AuthorizeUrlParams {
    authBaseUrl: string;
    authorizePath: string;
    callbackUrl: string;
    codeChallenge: string;
    state: string;
    appName: string;
    scope?: string;
    prompt?: string;
    loginHint?: string;
    workspaceHint?: string;
}

/**
 * Build the consent URL. Only `code_challenge_method=S256` is ever emitted, and
 * the verifier is deliberately not a parameter here — it must stay in-process.
 */
export function buildAuthorizeUrlWithPkce(params: AuthorizeUrlParams): string {
    const url = new URL(
        `${params.authBaseUrl.replace(/\/+$/, '')}${params.authorizePath}`,
    );
    url.searchParams.set('callback_url', params.callbackUrl);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', params.state);
    url.searchParams.set('app_name', params.appName);
    if (params.scope) url.searchParams.set('scope', params.scope);
    if (params.prompt) url.searchParams.set('prompt', params.prompt);
    if (params.loginHint) url.searchParams.set('login_hint', params.loginHint);
    if (params.workspaceHint) url.searchParams.set('workspace_hint', params.workspaceHint);
    return url.toString();
}
