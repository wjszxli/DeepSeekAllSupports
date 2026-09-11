/**
 * OrcaRouter interactive login session (OAuth 2.0 + PKCE).
 *
 * ## Flow choice: B — out-of-band code
 *
 * The spec's decision rule is "where does your client run?". AiAllSupport is an
 * MV3 browser extension, so it has a browser but **cannot bind a loopback TCP
 * port** — `127.0.0.1:<port>` is unreachable from an extension page, which rules
 * out Flow A. Flow C (device grant) targets clients with no browser at all.
 * Flow B is the flow designed for exactly this case, and it needs no
 * pre-registered redirect URI.
 *
 * `callback_url=oob` is the literal three letters, and
 * `code_challenge_method=S256` is mandatory on this flow. We send S256 on every
 * flow regardless: the user can always choose "Show me a code" on the consent
 * screen, and a displayed code must be redeemable only by the process holding
 * the verifier.
 *
 * ## Cancellation
 *
 * Every terminal path releases both the server-side work and the UI state —
 * success, denial, exchange error, timeout, explicit cancel, switching auth
 * method, modal close, unmount, and `pagehide`. A monotonically increasing
 * `attemptId` guards every async completion so a late response from an
 * abandoned attempt can never overwrite a newer login.
 *
 * `pagehide` is special: browsers may put the page into the back-forward cache,
 * so the guarded `finally` blocks of in-flight work will (correctly) refuse to
 * mutate state and the restored page would stay permanently busy. The handler
 * therefore clears busy/hint **synchronously, in the handler itself**, and only
 * then invalidates the attempt.
 */

import {
    ORCA_APP_NAME,
    ORCA_DEFAULT_SCOPE,
    ORCA_OOB_CALLBACK,
    buildAuthorizeUrl,
    buildDeviceCodeUrl,
    buildDeviceTokenUrl,
    type OrcaOriginOverrides,
    resolveOrcaOrigins,
} from './constants';
import {
    buildAuthorizeUrlWithPkce,
    createPkcePair,
    isValidCallbackUrl,
    timingSafeEqualString,
} from './pkce';
import {
    exchangeAuthCode,
    sanitizeErrorText,
    type OrcaAuthError,
    type OrcaCredential,
    type OrcaCredentialResult,
    type OrcaCredentialSource,
} from './credentials';

export type OrcaLoginFlow = 'oob' | 'loopback';

export type OrcaLoginStatus =
    | 'idle'
    | 'awaiting-authorization'
    | 'exchanging'
    | 'succeeded'
    | 'failed'
    | 'cancelled';

export interface OrcaLoginError {
    code: OrcaAuthError['code'];
    message: string;
}

export interface OrcaLoginState {
    status: OrcaLoginStatus;
    /** Attempt id of the currently displayed state. */
    attemptId: number;
    flow: OrcaLoginFlow;
    /** URL to open in a browser. Contains the challenge and state, never the verifier. */
    authorizeUrl: string | null;
    /** Short user-facing instruction, e.g. where to paste the code. */
    hint: string | null;
    error: OrcaLoginError | null;
}

/* ------------------------------------------------------------------ *
 * Callback parsing (Flow A)
 * ------------------------------------------------------------------ */

export type CallbackParseResult =
    | { ok: true; code: string }
    | { ok: false; error: OrcaLoginError };

/**
 * Parse a Flow A loopback callback and compare `state` before touching the code.
 *
 * The comparison is constant-time: a short-circuiting `===` would leak how many
 * leading characters matched, which is precisely the signal a page trying to
 * drop its own authorization code on the listener needs.
 */
export function parseAuthorizeCallback(
    callbackUrl: string,
    expectedState: string | null | undefined,
): CallbackParseResult {
    let url: URL;
    try {
        url = new URL(callbackUrl);
    } catch {
        return {
            ok: false,
            error: {
                code: 'invalid_response',
                message: 'Malformed callback URL.',
            },
        };
    }

    if (!timingSafeEqualString(url.searchParams.get('state'), expectedState)) {
        return {
            ok: false,
            error: {
                code: 'state_mismatch',
                message:
                    'The authorization response did not match this sign-in attempt and was ' +
                    'ignored. Start the connection again.',
            },
        };
    }

    const denied = url.searchParams.get('error');
    if (denied) {
        return {
            ok: false,
            error: {
                code: denied === 'access_denied' ? 'denied' : 'invalid_response',
                message:
                    denied === 'access_denied'
                        ? 'Authorization was declined in the browser.'
                        : 'OrcaRouter rejected the authorization request.',
            },
        };
    }

    const code = url.searchParams.get('code');
    if (!code) {
        return {
            ok: false,
            error: { code: 'invalid_response', message: 'No authorization code.' },
        };
    }
    return { ok: true, code };
}

/* ------------------------------------------------------------------ *
 * Device grant (Flow C) — extra capability, never a substitute for PKCE
 * ------------------------------------------------------------------ */

export interface OrcaDeviceStart {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete: string | null;
    expiresIn: number;
    interval: number;
}

/** Start a device authorization. `device_code` is a secret; `user_code` is not. */
export async function startDeviceGrant(
    authBaseUrl: string,
    fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; start: OrcaDeviceStart } | { ok: false; error: OrcaLoginError }> {
    try {
        const response = await fetchImpl(buildDeviceCodeUrl(authBaseUrl), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_name: ORCA_APP_NAME, scope: ORCA_DEFAULT_SCOPE }),
        });
        if (!response.ok) {
            return {
                ok: false,
                error: { code: 'network', message: `OrcaRouter device start failed (${response.status}).` },
            };
        }
        const data = await response.json();
        if (typeof data?.device_code !== 'string' || typeof data?.user_code !== 'string') {
            return {
                ok: false,
                error: { code: 'invalid_response', message: 'OrcaRouter returned no device code.' },
            };
        }
        return {
            ok: true,
            start: {
                deviceCode: data.device_code,
                userCode: data.user_code,
                verificationUri: String(data.verification_uri ?? ''),
                // Never rebuild this URI ourselves; print what we were handed.
                verificationUriComplete:
                    typeof data.verification_uri_complete === 'string'
                        ? data.verification_uri_complete
                        : null,
                expiresIn: Number(data.expires_in) > 0 ? Number(data.expires_in) : 600,
                interval: Number(data.interval) > 0 ? Number(data.interval) : 5,
            },
        };
    } catch {
        return {
            ok: false,
            error: { code: 'network', message: 'Could not reach OrcaRouter to start the device grant.' },
        };
    }
}

/**
 * Poll the device token endpoint. Branch on the `error` field and nothing else:
 * `authorization_pending` and `slow_down` mean keep going, everything else
 * means stop. A transport failure gives up rather than hot-looping.
 */
export async function pollDeviceGrant(
    authBaseUrl: string,
    start: OrcaDeviceStart,
    options: { fetchImpl?: typeof fetch; signal?: AbortSignal; onInterval?: (s: number) => void } = {},
): Promise<OrcaCredentialResult> {
    const fetchImpl = options.fetchImpl ?? fetch;
    let interval = start.interval;
    const deadline = Date.now() + start.expiresIn * 1000;

    while (Date.now() < deadline) {
        if (options.signal?.aborted) {
            return { ok: false, error: { code: 'cancelled', message: 'Cancelled.', reauthRequired: false } };
        }
        await new Promise((resolve) => setTimeout(resolve, interval * 1000));
        if (options.signal?.aborted) {
            return { ok: false, error: { code: 'cancelled', message: 'Cancelled.', reauthRequired: false } };
        }

        let payload: any;
        try {
            const response = await fetchImpl(buildDeviceTokenUrl(authBaseUrl), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device_code: start.deviceCode,
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                }),
            });
            payload = await response.json();
        } catch {
            return {
                ok: false,
                error: { code: 'network', message: 'Lost contact with OrcaRouter while polling.', reauthRequired: false },
            };
        }

        const deviceError = typeof payload?.error === 'string' ? payload.error : '';
        if (!deviceError) {
            const key = typeof payload?.key === 'string' ? payload.key : '';
            if (!key.startsWith('sk-orca-')) {
                return {
                    ok: false,
                    error: {
                        code: 'invalid_response',
                        message: 'OrcaRouter returned no usable key.',
                        reauthRequired: false,
                    },
                };
            }
            return {
                ok: true,
                credential: {
                    providerId: '',
                    source: 'pkce',
                    apiKey: key,
                    scope: typeof payload.scope === 'string' ? payload.scope : null,
                    accountId: payload.user_id != null ? String(payload.user_id) : null,
                    generation: 1,
                    createdAt: Date.now(),
                    status: 'active',
                },
            };
        }

        switch (deviceError) {
            case 'authorization_pending':
                break;
            case 'slow_down':
                interval += 5;
                options.onInterval?.(interval);
                break;
            case 'access_denied':
                return { ok: false, error: { code: 'denied', message: 'Authorization was declined.', reauthRequired: false } };
            case 'expired_token':
                return {
                    ok: false,
                    error: {
                        code: 'timeout',
                        message: 'The code expired; start again.',
                        reauthRequired: true,
                    },
                };
            default:
                return {
                    ok: false,
                    error: {
                        code: 'invalid_response',
                        message: sanitizeErrorText(payload?.error_description ?? deviceError),
                        reauthRequired: true,
                    },
                };
        }
    }

    return {
        ok: false,
        error: { code: 'timeout', message: 'The authorization window closed.', reauthRequired: true },
    };
}

/* ------------------------------------------------------------------ *
 * The login controller
 * ------------------------------------------------------------------ */

export interface OrcaLoginCallbacks {
    /** Called with the fresh credential on success. Persist it here. */
    onCredential: (credential: OrcaCredential, attemptId: number) => void;
    onStateChange?: (state: OrcaLoginState) => void;
}

const AUTHORIZATION_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Schedule a timer that does not hold the process open.
 *
 * In a browser `setTimeout` returns a number and there is nothing to unref; in
 * Node (the test runner, and any headless use) an outstanding 10-minute
 * authorization timer would otherwise keep the event loop alive after a test
 * finished.
 */
function scheduleTimer(callback: () => void, ms: number): ReturnType<typeof setTimeout> {
    const handle = setTimeout(callback, ms);
    const unrefable = handle as unknown as { unref?: () => void };
    unrefable.unref?.();
    return handle;
}

export class OrcaLoginController {
    private attemptId = 0;
    private abortController: AbortController | null = null;
    private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    private currentVerifier: string | null = null;
    private state: OrcaLoginState = {
        status: 'idle',
        attemptId: 0,
        flow: 'oob',
        authorizeUrl: null,
        hint: null,
        error: null,
    };

    constructor(
        private readonly options: {
            providerId: string;
            origins?: OrcaOriginOverrides;
            source: OrcaCredentialSource;
            callbacks: OrcaLoginCallbacks;
            fetchImpl?: typeof fetch;
            now?: () => number;
        },
    ) {}

    getState(): OrcaLoginState {
        return this.state;
    }

    /** True while a login may still complete. Used by the UI's busy state. */
    isBusy(): boolean {
        return this.state.status === 'awaiting-authorization' || this.state.status === 'exchanging';
    }

    private setState(patch: Partial<OrcaLoginState>, attemptId = this.attemptId): void {
        // Guard: only the current attempt may mutate UI state.
        if (attemptId !== this.attemptId) return;
        this.state = { ...this.state, ...patch, attemptId: this.attemptId };
        this.options.callbacks.onStateChange?.(this.state);
    }

    /**
     * Start a new attempt. Always generates a fresh verifier and state from the
     * cryptographic RNG, and supersedes any attempt already in flight.
     */
    async begin(flow: OrcaLoginFlow = 'oob'): Promise<OrcaLoginState> {
        this.releaseAttempt({ cancelServerWork: true });
        this.attemptId += 1;
        const attemptId = this.attemptId;
        this.abortController = new AbortController();

        const { authBaseUrl } = resolveOrcaOrigins(this.options.origins);
        const pkce = await createPkcePair();
        if (attemptId !== this.attemptId) {
            // A newer attempt started while we were generating material.
            return this.state;
        }
        this.currentVerifier = pkce.verifier;

        const authorizeUrl =
            flow === 'loopback'
                ? this.buildLoopbackUrl(authBaseUrl, pkce.challenge, pkce.state)
                : buildAuthorizeUrlWithPkce({
                      authBaseUrl,
                      // Fixed path; `/auth` is not an API and never gains a `/v1`.
                      authorizePath: new URL(buildAuthorizeUrl(authBaseUrl)).pathname,
                      callbackUrl: ORCA_OOB_CALLBACK,
                      codeChallenge: pkce.challenge,
                      state: pkce.state,
                      appName: ORCA_APP_NAME,
                      scope: ORCA_DEFAULT_SCOPE,
                  });

        this.timeoutHandle = scheduleTimer(() => {
            if (attemptId !== this.attemptId) return;
            this.fail({
                code: 'timeout',
                message: 'The authorization window closed. Try again.',
                reauthRequired: true,
            });
        }, AUTHORIZATION_TIMEOUT_MS);

        this.setState(
            {
                status: 'awaiting-authorization',
                flow,
                authorizeUrl,
                hint:
                    flow === 'oob'
                        ? 'Approve in the tab that just opened, then paste the code OrcaRouter shows you.'
                        : 'Approve in the tab that just opened; this window will finish on its own.',
                error: null,
            },
            attemptId,
        );
        return this.state;
    }

    private buildLoopbackUrl(authBaseUrl: string, challenge: string, state: string): string {
        // Flow A is unsupported from an extension page (no loopback socket); the
        // validator still guards the callback URL shape for the paths that can
        // listen, so a bad value fails before a browser opens.
        const callbackUrl = `http://127.0.0.1:0/cb`;
        if (!isValidCallbackUrl(callbackUrl)) {
            throw new Error('Invalid OrcaRouter loopback callback URL');
        }
        return buildAuthorizeUrlWithPkce({
            authBaseUrl,
            authorizePath: new URL(buildAuthorizeUrl(authBaseUrl)).pathname,
            callbackUrl,
            codeChallenge: challenge,
            state,
            appName: ORCA_APP_NAME,
            scope: ORCA_DEFAULT_SCOPE,
        });
    }

    /** Submit the code the consent screen displayed (Flow B). */
    async submitCode(code: string): Promise<OrcaCredentialResult> {
        const attemptId = this.attemptId;
        const verifier = this.currentVerifier;
        if (!verifier || !this.isBusy()) {
            return {
                ok: false,
                error: {
                    code: 'invalid_response',
                    message: 'There is no sign-in attempt in progress.',
                    reauthRequired: false,
                },
            };
        }

        const trimmed = (code || '').trim();
        if (!trimmed) {
            const error = { code: 'invalid_response' as const, message: 'Paste the code OrcaRouter showed you.' };
            this.setState({ error: { code: error.code, message: error.message } }, attemptId);
            return { ok: false, error: { ...error, reauthRequired: false } };
        }

        this.setState({ status: 'exchanging', hint: null, error: null }, attemptId);

        const { authBaseUrl } = resolveOrcaOrigins(this.options.origins);
        const result = await exchangeAuthCode({
            authBaseUrl,
            code: trimmed,
            codeVerifier: verifier,
            fetchImpl: this.options.fetchImpl,
            signal: this.abortController?.signal,
        });

        if (attemptId !== this.attemptId) {
            // A newer attempt owns the UI now. The result is dropped entirely so
            // an old success cannot overwrite the new login — and it is reported
            // as superseded rather than as a success, so a stale caller cannot
            // act on a credential this session no longer owns.
            return {
                ok: false,
                error: {
                    code: 'cancelled',
                    message: 'This sign-in attempt was superseded by a newer one.',
                    reauthRequired: false,
                },
            };
        }

        if (!result.ok) {
            // The verifier is single-use; a failed exchange invalidates it.
            this.currentVerifier = null;
            this.fail(result.error);
            return result;
        }

        const credential: OrcaCredential = {
            ...result.credential,
            providerId: this.options.providerId,
            source: this.options.source,
            generation: 1,
            createdAt: (this.options.now ?? Date.now)(),
        };
        this.currentVerifier = null;
        this.clearTimers();
        this.setState({ status: 'succeeded', hint: null, error: null, authorizeUrl: null }, attemptId);
        this.options.callbacks.onCredential(credential, attemptId);
        return { ok: true, credential };
    }

    /** Explicit user cancel. Reusable: the next `begin()` starts cleanly. */
    cancel(): void {
        this.attemptId += 1;
        this.releaseAttempt({ cancelServerWork: true });
        this.state = {
            status: 'cancelled',
            attemptId: this.attemptId,
            flow: this.state.flow,
            authorizeUrl: null,
            hint: null,
            error: null,
        };
        this.options.callbacks.onStateChange?.(this.state);
    }

    /**
     * BFCache-safe teardown.
     *
     * Clears busy/hint **synchronously here** rather than relying on the
     * invalidated request's guarded `finally`, which would correctly refuse to
     * touch state and leave a restored page stuck busy forever. Returns the
     * cancel promise so a caller can attach `keepalive` where the transport
     * supports it.
     */
    handlePageHide(): void {
        this.attemptId += 1;
        // Synchronous UI release first — this is the part the guarded finally cannot do.
        this.state = {
            status: 'idle',
            attemptId: this.attemptId,
            flow: this.state.flow,
            authorizeUrl: null,
            hint: null,
            error: null,
        };
        this.options.callbacks.onStateChange?.(this.state);
        this.releaseAttempt({ cancelServerWork: true });
    }

    /** Component unmount: drop server work without writing UI state. */
    dispose(): void {
        this.attemptId += 1;
        this.currentVerifier = null;
        this.clearTimers();
        this.abortController?.abort();
        this.abortController = null;
    }

    private fail(error: OrcaAuthError): void {
        this.clearTimers();
        this.setState({
            status: 'failed',
            hint: null,
            authorizeUrl: null,
            error: { code: error.code, message: sanitizeErrorText(error.message, 240) },
        });
    }

    private clearTimers(): void {
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = null;
        }
    }

    /**
     * Abort in-flight work and drop the attempt's secret material.
     *
     * OrcaRouter documents no server-side cancel endpoint, so cancellation is
     * local: abort the exchange request and bump the generation so any response
     * that still lands is ignored. The device-grant poll loop stops on the same
     * signal. Nothing is retried and nothing is refreshed.
     */
    private releaseAttempt({ cancelServerWork }: { cancelServerWork: boolean }): void {
        this.clearTimers();
        this.currentVerifier = null;
        if (cancelServerWork) {
            this.abortController?.abort();
        }
        this.abortController = null;
    }
}
