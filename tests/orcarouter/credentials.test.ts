/**
 * Credential-adapter tests.
 *
 * Both adapters must produce the same `OrcaCredential` shape, and no test may
 * use a real key, code, or verifier. Every value below is fabricated.
 */

import '../setup';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    checkApiKeyFormat,
    classifyRelayResponse,
    createApiKeyAdapter,
    createPkceAdapter,
    exchangeAuthCode,
    markRejectedGeneration,
    maskApiKey,
    sanitizeErrorText,
    type OrcaCredential,
    type OrcaCredentialStore,
} from '../../src/orcarouter/credentials';

const FAKE_KEY = 'sk-orca-fake0000000000000000000000000000000000';
const FAKE_KEY_2 = 'sk-orca-fake1111111111111111111111111111111111';
const FAKE_CODE = 'fake-auth-code-not-real';
const FAKE_VERIFIER = 'fake-verifier-not-real';

/** In-memory store. Mirrors the generation-bumping behaviour of the real one. */
function createTestStore(): OrcaCredentialStore & { current: OrcaCredential | null } {
    const store = {
        current: null as OrcaCredential | null,
        read: () => store.current,
        write: (credential: OrcaCredential) => {
            store.current = credential;
        },
        clear: () => {
            store.current = null;
        },
    };
    return store;
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/* ------------------------------------------------------------------ *
 * Redaction
 * ------------------------------------------------------------------ */

test('sanitizeErrorText redacts key-shaped and long token-shaped strings', () => {
    const sanitized = sanitizeErrorText(
        `upstream said: key ${FAKE_KEY} rejected, token ${'a'.repeat(64)} expired`,
    );
    assert.ok(!sanitized.includes(FAKE_KEY));
    assert.ok(!sanitized.includes('a'.repeat(64)));
    assert.ok(sanitized.includes('[redacted-key]'));
});

test('sanitizeErrorText truncates unbounded upstream bodies', () => {
    const sanitized = sanitizeErrorText('x'.repeat(5000), 100);
    assert.ok(sanitized.length <= 101);
});

test('maskApiKey reveals at most a recognisable prefix and suffix', () => {
    const masked = maskApiKey(FAKE_KEY);
    assert.ok(!masked.includes(FAKE_KEY));
    assert.ok(masked.startsWith('sk-orca-'));
    assert.ok(masked.includes('•'));
    assert.equal(maskApiKey(null), '');
    assert.equal(maskApiKey('short'), '••••••••');
});

test('the API key format check rejects the obviously wrong and accepts a plausible shape', () => {
    assert.ok(checkApiKeyFormat('') !== null);
    assert.ok(checkApiKeyFormat('not-a-key-at-all') !== null);
    assert.ok(checkApiKeyFormat('sk-orca-abc') !== null);
    assert.ok(checkApiKeyFormat('sk-orca-has a space in it') !== null);
    assert.equal(checkApiKeyFormat(FAKE_KEY), null);
});

/* ------------------------------------------------------------------ *
 * Adapter parity — the core requirement
 * ------------------------------------------------------------------ */

test('both adapters produce the same credential shape for the same downstream use', async () => {
    const apiStore = createTestStore();
    const pkceStore = createTestStore();

    const apiAdapter = createApiKeyAdapter({
        providerId: 'orcarouter',
        apiKey: FAKE_KEY,
        store: apiStore,
    });
    const apiResult = await apiAdapter.acquire();

    const pkceAdapter = createPkceAdapter({
        providerId: 'orcarouter-oauth',
        store: pkceStore,
        authorizer: {
            authorize: async () => ({ ok: true, code: FAKE_CODE, verifier: FAKE_VERIFIER }),
        },
        fetchImpl: async () =>
            jsonResponse({ key: FAKE_KEY_2, user_id: 'fake-user', scope: 'api' }),
    });
    const pkceResult = await pkceAdapter.acquire({ force: true });

    assert.equal(apiResult.ok, true);
    assert.equal(pkceResult.ok, true);
    if (!apiResult.ok || !pkceResult.ok) return;

    // Identical fields, identical key shape: downstream code must not be able
    // to tell the two apart.
    assert.deepEqual(Object.keys(apiResult.credential).sort(), Object.keys(pkceResult.credential).sort());
    assert.match(apiResult.credential.apiKey, /^sk-orca-/);
    assert.match(pkceResult.credential.apiKey, /^sk-orca-/);
    assert.equal(apiResult.credential.source, 'api-key');
    assert.equal(pkceResult.credential.source, 'pkce');
    assert.equal(pkceResult.credential.scope, 'api');
});

test('the API key adapter persists through the store and never invents a refresh token', async () => {
    const store = createTestStore();
    const adapter = createApiKeyAdapter({ providerId: 'orcarouter', apiKey: FAKE_KEY, store });
    const result = await adapter.acquire();
    assert.equal(result.ok, true);
    assert.equal(store.current?.apiKey, FAKE_KEY);
    assert.equal(store.current?.status, 'active');
    // A pasted key is a durable credential: no refresh material anywhere.
    assert.ok(!('refreshToken' in (store.current as object)));
});

test('a malformed pasted key is rejected without touching the store', async () => {
    const store = createTestStore();
    const adapter = createApiKeyAdapter({ providerId: 'orcarouter', apiKey: 'nope', store });
    const result = await adapter.acquire();
    assert.equal(result.ok, false);
    assert.equal(store.current, null);
});

/* ------------------------------------------------------------------ *
 * Code exchange
 * ------------------------------------------------------------------ */

test('the exchange posts the verifier in the body to /api/v1/auth/keys, and never in a URL', async () => {
    let capturedUrl = '';
    let capturedBody: any = null;
    let capturedMethod = '';

    const result = await exchangeAuthCode({
        authBaseUrl: 'https://www.orcarouter.ai',
        code: FAKE_CODE,
        codeVerifier: FAKE_VERIFIER,
        fetchImpl: async (input: any, init: any) => {
            capturedUrl = String(input);
            capturedMethod = init.method;
            capturedBody = JSON.parse(init.body);
            return jsonResponse({ key: FAKE_KEY, user_id: 'fake-user', scope: 'api' });
        },
    });

    assert.equal(result.ok, true);
    assert.equal(capturedUrl, 'https://www.orcarouter.ai/api/v1/auth/keys');
    assert.equal(capturedMethod, 'POST');
    assert.equal(capturedBody.code_verifier, FAKE_VERIFIER);
    assert.equal(capturedBody.code_challenge_method, 'S256');
    // The verifier must not have been smuggled into the request URL.
    assert.ok(!capturedUrl.includes(FAKE_VERIFIER));
    assert.ok(!capturedUrl.includes(FAKE_CODE));
    // And the exchange must never touch the inference origin.
    assert.ok(!capturedUrl.includes('api.orcarouter.ai'));
});

test('the granted scope is read back, and a weaker grant is refused', async () => {
    const downgraded = await exchangeAuthCode({
        authBaseUrl: 'https://www.orcarouter.ai',
        code: FAKE_CODE,
        codeVerifier: FAKE_VERIFIER,
        fetchImpl: async () => jsonResponse({ key: FAKE_KEY, user_id: 'u', scope: 'readonly' }),
    });
    assert.equal(downgraded.ok, false);
    if (!downgraded.ok) assert.equal(downgraded.error.code, 'scope_downgrade');

    const missing = await exchangeAuthCode({
        authBaseUrl: 'https://www.orcarouter.ai',
        code: FAKE_CODE,
        codeVerifier: FAKE_VERIFIER,
        fetchImpl: async () => jsonResponse({ key: FAKE_KEY, user_id: 'u' }),
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.error.code, 'scope_downgrade');
});

test('HTTP failures map to actionable, non-leaking errors', async () => {
    const cases: Array<[number, string]> = [
        [400, 'challenge_method_rejected'],
        [403, 'code_expired_or_used'],
        [429, 'rate_limited'],
    ];
    for (const [status, expectedCode] of cases) {
        const result = await exchangeAuthCode({
            authBaseUrl: 'https://www.orcarouter.ai',
            code: FAKE_CODE,
            codeVerifier: FAKE_VERIFIER,
            // The body deliberately echoes a key to prove it is not surfaced.
            fetchImpl: async () => new Response(`leaked ${FAKE_KEY}`, { status }),
        });
        assert.equal(result.ok, false, `status ${status}`);
        if (!result.ok) {
            assert.equal(result.error.code, expectedCode);
            assert.ok(!result.error.message.includes(FAKE_KEY));
        }
    }
});

test('a 403 surfaces as expired-or-reused and a network failure as a retryable error', async () => {
    const denied = await exchangeAuthCode({
        authBaseUrl: 'https://www.orcarouter.ai',
        code: FAKE_CODE,
        codeVerifier: FAKE_VERIFIER,
        fetchImpl: async () => new Response('', { status: 403 }),
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.error.code, 'code_expired_or_used');

    const offline = await exchangeAuthCode({
        authBaseUrl: 'https://www.orcarouter.ai',
        code: FAKE_CODE,
        codeVerifier: FAKE_VERIFIER,
        fetchImpl: async () => {
            throw new TypeError('network down');
        },
    });
    assert.equal(offline.ok, false);
    if (!offline.ok) assert.equal(offline.error.code, 'network');
});

test('a response with no usable key is refused without echoing the payload', async () => {
    const result = await exchangeAuthCode({
        authBaseUrl: 'https://www.orcarouter.ai',
        code: FAKE_CODE,
        codeVerifier: FAKE_VERIFIER,
        fetchImpl: async () => jsonResponse({ key: 'not-an-orca-key', scope: 'api' }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.error.code, 'invalid_response');
        assert.ok(!result.error.message.includes('not-an-orca-key'));
    }
});

test('the exchange honours an external abort as a cancellation', async () => {
    const controller = new AbortController();
    const pending = exchangeAuthCode({
        authBaseUrl: 'https://www.orcarouter.ai',
        code: FAKE_CODE,
        codeVerifier: FAKE_VERIFIER,
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
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'cancelled');
});

/* ------------------------------------------------------------------ *
 * Durable-key lifecycle
 * ------------------------------------------------------------------ */

test('the PKCE adapter reuses a stored active key instead of minting a new one', async () => {
    const store = createTestStore();
    let authorizations = 0;
    const adapter = createPkceAdapter({
        providerId: 'orcarouter-oauth',
        store,
        authorizer: {
            authorize: async () => {
                authorizations += 1;
                return { ok: true, code: FAKE_CODE, verifier: FAKE_VERIFIER };
            },
        },
        fetchImpl: async () => jsonResponse({ key: FAKE_KEY, user_id: 'u', scope: 'api' }),
    });

    const first = await adapter.acquire({ force: true });
    assert.equal(first.ok, true);
    const second = await adapter.acquire();
    const third = await adapter.acquire();

    // OrcaRouter caps PKCE-issued keys per user per day, so re-authorizing on
    // every call would lock the user out.
    assert.equal(authorizations, 1, 'must not re-authorize when a key is stored');
    assert.equal(second.ok && second.credential.apiKey, FAKE_KEY);
    assert.equal(third.ok && third.credential.generation, (first as any).credential.generation);
});

test('a denied authorization never writes a credential', async () => {
    const store = createTestStore();
    const adapter = createPkceAdapter({
        providerId: 'orcarouter-oauth',
        store,
        authorizer: {
            authorize: async () => ({
                ok: false,
                error: { code: 'denied' as const, message: 'declined', reauthRequired: false },
            }),
        },
        fetchImpl: async () => jsonResponse({}),
    });
    const result = await adapter.acquire({ force: true });
    assert.equal(result.ok, false);
    assert.equal(store.current, null);
});

test('a revoked durable key is terminal — the relay never attempts a refresh', async () => {
    const revoked = classifyRelayResponse(401);
    assert.equal(revoked.kind, 'needs_reauth');
    assert.equal(revoked.terminal, true);

    const forbidden = classifyRelayResponse(403);
    assert.equal(forbidden.kind, 'needs_reauth');

    // Non-auth failures continue to be retryable, not terminal.
    assert.equal(classifyRelayResponse(200).kind, 'ok');
    assert.equal(classifyRelayResponse(429).kind, 'rate_limited');
    assert.equal(classifyRelayResponse(429).terminal, false);
    assert.equal(classifyRelayResponse(500).kind, 'server_error');
    assert.equal(classifyRelayResponse(500).terminal, false);
});

test('a 401 marks only the exact rejected generation', () => {
    const current: OrcaCredential = {
        providerId: 'orcarouter-oauth',
        source: 'pkce',
        apiKey: FAKE_KEY,
        scope: 'api',
        accountId: 'acct-1',
        generation: 3,
        createdAt: 1,
        status: 'active',
    };

    // Matching generation, same account: marked.
    assert.equal(markRejectedGeneration(current, { providerId: 'orcarouter-oauth', generation: 3 })?.status, 'needsReauth');

    // A late failure from an older generation must be dropped: the user has
    // already reauthorized and the new credential is healthy.
    assert.equal(markRejectedGeneration(current, { providerId: 'orcarouter-oauth', generation: 2 }), null);

    // A different provider entry must not be affected.
    assert.equal(markRejectedGeneration(current, { providerId: 'orcarouter', generation: 3 }), null);

    // A different account must not be affected.
    assert.equal(
        markRejectedGeneration(current, { providerId: 'orcarouter-oauth', generation: 3, accountId: 'acct-2' }),
        null,
    );
});

test('a late 401 cannot poison a credential written by a newer login', () => {
    const rejected: OrcaCredential = {
        providerId: 'orcarouter-oauth',
        source: 'pkce',
        apiKey: FAKE_KEY,
        scope: 'api',
        accountId: 'acct-1',
        generation: 4,
        createdAt: 1,
        status: 'active',
    };
    // The user reconnected in the meantime; the stored credential is generation 5.
    const current: OrcaCredential = { ...rejected, apiKey: FAKE_KEY_2, generation: 5, createdAt: 2 };

    // The stale rejection must be ignored…
    assert.equal(markRejectedGeneration(current, { providerId: 'orcarouter-oauth', generation: 4 }), null);
    // …and the newer credential must be untouched.
    assert.equal(current.status, 'active');
    assert.equal(current.apiKey, FAKE_KEY_2);
});
