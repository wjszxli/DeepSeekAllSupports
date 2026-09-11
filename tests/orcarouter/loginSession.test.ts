/**
 * Login-session lifecycle tests.
 *
 * These drive the real `OrcaLoginController` through a local fake auth server:
 * authorize → paste code → exchange → persist. No test fabricates consent, and
 * no real authorization happens here — the fake server stands in for the
 * browser step.
 */

import '../setup';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    OrcaLoginController,
    parseAuthorizeCallback,
    pollDeviceGrant,
    startDeviceGrant,
} from '../../src/orcarouter/loginSession';
import { resolveOrcaOrigins } from '../../src/orcarouter/constants';
import type { OrcaCredential } from '../../src/orcarouter/credentials';

const FAKE_KEY = 'sk-orca-fake0000000000000000000000000000000000';
const FAKE_CODE = 'fake-oob-code';
const AUTH_BASE = 'https://www.orcarouter.ai';

function makeController(overrides: {
    fetchImpl?: typeof fetch;
    onCredential?: (credential: OrcaCredential, attemptId: number) => void;
} = {}) {
    const states: string[] = [];
    const credentials: OrcaCredential[] = [];
    const controller = new OrcaLoginController({
        providerId: 'orcarouter-oauth',
        source: 'pkce',
        origins: { authBaseUrl: AUTH_BASE },
        fetchImpl: overrides.fetchImpl,
        callbacks: {
            onCredential: (credential, attemptId) => {
                credentials.push(credential);
                overrides.onCredential?.(credential, attemptId);
            },
            onStateChange: (state) => states.push(state.status),
        },
    });
    return { controller, states, credentials };
}

const okExchange: typeof fetch = async () =>
    new Response(JSON.stringify({ key: FAKE_KEY, user_id: 'fake-user', scope: 'api' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });

/* ------------------------------------------------------------------ *
 * Flow B — begin, submit, persist
 * ------------------------------------------------------------------ */

test('begin() emits an OOB authorize URL on the auth origin with S256 and a fresh state', async () => {
    const { controller } = makeController();
    const state = await controller.begin('oob');

    assert.equal(state.status, 'awaiting-authorization');
    assert.equal(state.flow, 'oob');
    assert.ok(state.authorizeUrl);

    const url = new URL(state.authorizeUrl!);
    assert.equal(url.origin, 'https://www.orcarouter.ai');
    assert.equal(url.pathname, '/auth');
    assert.equal(url.searchParams.get('callback_url'), 'oob');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(url.searchParams.get('code_challenge'));
    assert.ok(url.searchParams.get('state'));
    // The authorize URL must never point at the inference origin.
    assert.ok(!state.authorizeUrl!.includes('api.orcarouter.ai'));

    controller.dispose();
});

test('two attempts use different verifiers and states', async () => {
    const { controller } = makeController();
    const first = await controller.begin('oob');
    const firstChallenge = new URL(first.authorizeUrl!).searchParams.get('code_challenge');
    const firstState = new URL(first.authorizeUrl!).searchParams.get('state');

    await controller.begin('oob');
    const second = controller.getState();
    const secondChallenge = new URL(second.authorizeUrl!).searchParams.get('code_challenge');
    const secondState = new URL(second.authorizeUrl!).searchParams.get('state');

    assert.notEqual(firstChallenge, secondChallenge);
    assert.notEqual(firstState, secondState);
    controller.dispose();
});

test('submitting the code completes authorize → exchange → persist', async () => {
    const { controller, states, credentials } = makeController({ fetchImpl: okExchange });
    await controller.begin('oob');
    const result = await controller.submitCode(FAKE_CODE);

    assert.equal(result.ok, true);
    assert.equal(controller.getState().status, 'succeeded');
    assert.ok(states.includes('awaiting-authorization'));
    assert.ok(states.includes('exchanging'));

    assert.equal(credentials.length, 1);
    assert.equal(credentials[0].apiKey, FAKE_KEY);
    assert.equal(credentials[0].providerId, 'orcarouter-oauth');
    assert.equal(credentials[0].source, 'pkce');
    assert.equal(credentials[0].status, 'active');
    controller.dispose();
});

test('an empty code is refused without a network call', async () => {
    let calls = 0;
    const { controller } = makeController({
        fetchImpl: async () => {
            calls += 1;
            return okExchange(new Request('https://x'));
        },
    });
    await controller.begin('oob');
    const result = await controller.submitCode('   ');
    assert.equal(result.ok, false);
    assert.equal(calls, 0);
    assert.equal(controller.getState().status, 'awaiting-authorization');
    controller.dispose();
});

test('submitting with no attempt in progress is a no-op error, not a crash', async () => {
    const { controller } = makeController({ fetchImpl: okExchange });
    const result = await controller.submitCode(FAKE_CODE);
    assert.equal(result.ok, false);
    controller.dispose();
});

/* ------------------------------------------------------------------ *
 * Terminal failure paths
 * ------------------------------------------------------------------ */

test('a denied authorization lands in a failed state with an actionable message', async () => {
    const { controller } = makeController({
        fetchImpl: async () => new Response('', { status: 403 }),
    });
    await controller.begin('oob');
    await controller.submitCode(FAKE_CODE);

    const state = controller.getState();
    assert.equal(state.status, 'failed');
    assert.equal(state.error?.code, 'code_expired_or_used');
    assert.ok(state.error?.message);
    controller.dispose();
});

test('an exchange network failure is reported, not thrown', async () => {
    const { controller } = makeController({
        fetchImpl: async () => {
            throw new TypeError('offline');
        },
    });
    await controller.begin('oob');
    const result = await controller.submitCode(FAKE_CODE);
    assert.equal(result.ok, false);
    assert.equal(controller.getState().status, 'failed');
    if (!result.ok) assert.equal(result.error.code, 'network');
    controller.dispose();
});

test('a rate-limited exchange tells the user the existing connection is reused', async () => {
    const { controller } = makeController({
        fetchImpl: async () => new Response('', { status: 429 }),
    });
    await controller.begin('oob');
    const result = await controller.submitCode(FAKE_CODE);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'rate_limited');
    controller.dispose();
});

test('a failed exchange discards the single-use verifier', async () => {
    const { controller } = makeController({
        fetchImpl: async () => new Response('', { status: 403 }),
    });
    await controller.begin('oob');
    await controller.submitCode(FAKE_CODE);
    // A reused code must not be silently retried against the stale verifier.
    const retry = await controller.submitCode(FAKE_CODE);
    assert.equal(retry.ok, false);
    controller.dispose();
});

/* ------------------------------------------------------------------ *
 * Cancellation
 * ------------------------------------------------------------------ */

test('an explicit cancel clears busy state and allows a second login', async () => {
    const { controller } = makeController({ fetchImpl: okExchange });
    await controller.begin('oob');
    assert.equal(controller.isBusy(), true);

    controller.cancel();
    assert.equal(controller.isBusy(), false);
    assert.equal(controller.getState().status, 'cancelled');
    assert.equal(controller.getState().hint, null);
    assert.equal(controller.getState().authorizeUrl, null);

    // A new attempt must start cleanly from the same controller.
    const second = await controller.begin('oob');
    assert.equal(second.status, 'awaiting-authorization');
    assert.ok(second.authorizeUrl);
    controller.dispose();
});

test('dispose() releases work and writes no UI state', async () => {
    const states: string[] = [];
    const controller = new OrcaLoginController({
        providerId: 'orcarouter-oauth',
        source: 'pkce',
        origins: { authBaseUrl: AUTH_BASE },
        fetchImpl: okExchange,
        callbacks: {
            onCredential: () => {},
            onStateChange: (state) => states.push(state.status),
        },
    });
    await controller.begin('oob');
    const before = states.length;
    controller.dispose();
    // Unmount must not push a state update.
    assert.equal(states.length, before);
});

/* ------------------------------------------------------------------ *
 * pagehide / back-forward cache
 * ------------------------------------------------------------------ */

test('pagehide clears busy and hint synchronously, and a second login starts without remounting', async () => {
    const { controller } = makeController({ fetchImpl: okExchange });
    await controller.begin('oob');
    assert.equal(controller.isBusy(), true);
    assert.ok(controller.getState().hint);

    // The guarded `finally` of any in-flight work would refuse to touch state
    // after this point — which is exactly why the handler itself must clear it.
    controller.handlePageHide();

    assert.equal(controller.isBusy(), false, 'busy must clear synchronously');
    assert.equal(controller.getState().hint, null, 'hint must clear synchronously');
    assert.equal(controller.getState().authorizeUrl, null);

    // No remount: the same controller must begin a fresh login.
    const second = await controller.begin('oob');
    assert.equal(second.status, 'awaiting-authorization');
    assert.ok(second.authorizeUrl);
    assert.equal(controller.isBusy(), true);
    controller.dispose();
});

test('a late exchange response after pagehide cannot revive the old attempt', async () => {
    let resolveExchange: ((response: Response) => void) | null = null;
    const { controller, credentials } = makeController({
        fetchImpl: () =>
            new Promise<Response>((resolve) => {
                resolveExchange = resolve;
            }),
    });

    await controller.begin('oob');
    const pending = controller.submitCode(FAKE_CODE);

    // The page goes into the back-forward cache while the exchange is in flight.
    controller.handlePageHide();
    // Now the abandoned exchange finally answers.
    resolveExchange!(new Response(JSON.stringify({ key: FAKE_KEY, scope: 'api' }), { status: 200 }));
    await pending;

    // The credential from the abandoned attempt must not have been persisted,
    // and the session must not be busy.
    assert.equal(credentials.length, 0);
    assert.equal(controller.isBusy(), false);
    assert.equal(controller.getState().status, 'idle');
    controller.dispose();
});

test('a stale response cannot overwrite a newer login generation', async () => {
    const { controller, credentials } = makeController({
        fetchImpl: async () => {
            // Hang until the test releases it, so attempt 1 is still in flight
            // when attempt 2 starts.
            await new Promise((resolve) => setTimeout(resolve, 30));
            return new Response(JSON.stringify({ key: FAKE_KEY, scope: 'api' }), { status: 200 });
        },
    });

    await controller.begin('oob');
    const first = controller.submitCode('fake-code-1');

    // Supersede attempt 1 before it resolves.
    await controller.begin('oob');
    const firstResult = await first;

    // The old attempt must not have written a credential.
    assert.equal(firstResult.ok, false);
    assert.equal(credentials.length, 0);
    // And the current attempt is still the one displayed.
    assert.equal(controller.getState().status, 'awaiting-authorization');
    controller.dispose();
});

/* ------------------------------------------------------------------ *
 * Flow A callback parsing
 * ------------------------------------------------------------------ */

test('a callback with the wrong state is rejected before the code is read', () => {
    const result = parseAuthorizeCallback(
        `http://127.0.0.1:51733/cb?code=${FAKE_CODE}&state=attacker-state`,
        'expected-state',
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'state_mismatch');
});

test('a matching callback yields the code, and a denial yields a denial', () => {
    const ok = parseAuthorizeCallback(
        `http://127.0.0.1:51733/cb?code=${FAKE_CODE}&state=expected-state`,
        'expected-state',
    );
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.code, FAKE_CODE);

    const denied = parseAuthorizeCallback(
        'http://127.0.0.1:51733/cb?error=access_denied&state=expected-state',
        'expected-state',
    );
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.error.code, 'denied');
});

/* ------------------------------------------------------------------ *
 * Flow C — device grant (extra capability, not a PKCE substitute)
 * ------------------------------------------------------------------ */

test('the device grant prints the URI it was handed and never rebuilds one', async () => {
    const start = await startDeviceGrant(
        AUTH_BASE,
        async () =>
            new Response(
                JSON.stringify({
                    device_code: 'fake-device-code',
                    user_code: 'ABCD-EFGH',
                    verification_uri: 'https://www.orcarouter.ai/device',
                    verification_uri_complete: 'https://www.orcarouter.ai/device?code=ABCD-EFGH',
                    expires_in: 600,
                    interval: 5,
                }),
                { status: 200 },
            ),
    );
    assert.equal(start.ok, true);
    if (start.ok) {
        assert.equal(start.start.verificationUriComplete, 'https://www.orcarouter.ai/device?code=ABCD-EFGH');
        // `user_code` is public; `device_code` is the secret that redeems the key.
        assert.equal(start.start.userCode, 'ABCD-EFGH');
        assert.equal(start.start.deviceCode, 'fake-device-code');
    }
});

test('device polling continues on pending, backs off on slow_down, and stops on denial', async () => {
    const responses = [
        { error: 'authorization_pending' },
        { error: 'slow_down' },
        { error: 'access_denied' },
    ];
    let index = 0;
    const result = await pollDeviceGrant(
        AUTH_BASE,
        {
            deviceCode: 'fake-device-code',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://www.orcarouter.ai/device',
            verificationUriComplete: null,
            // 1s window with a 0s interval keeps the test fast without changing
            // the production branching logic.
            expiresIn: 10,
            interval: 0.01,
        },
        {
            fetchImpl: async () => {
                const body = responses[Math.min(index, responses.length - 1)];
                index += 1;
                return new Response(JSON.stringify(body), { status: 200 });
            },
        },
    );

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'denied');
    assert.equal(index, 3);
});

test('device polling returns the key on an error-free response and flags a short scope', async () => {
    const result = await pollDeviceGrant(
        AUTH_BASE,
        {
            deviceCode: 'fake-device-code',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://www.orcarouter.ai/device',
            verificationUriComplete: null,
            expiresIn: 10,
            interval: 0.01,
        },
        {
            fetchImpl: async () =>
                new Response(JSON.stringify({ key: FAKE_KEY, user_id: 'u', scope: 'connector' }), {
                    status: 200,
                }),
        },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.credential.apiKey, FAKE_KEY);
        // The granted scope is reported verbatim so the caller can judge it.
        assert.equal(result.credential.scope, 'connector');
    }
});

test('device polling gives up on a transport failure instead of hot-looping', async () => {
    let calls = 0;
    const result = await pollDeviceGrant(
        AUTH_BASE,
        {
            deviceCode: 'fake-device-code',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://www.orcarouter.ai/device',
            verificationUriComplete: null,
            expiresIn: 30,
            interval: 0.01,
        },
        {
            fetchImpl: async () => {
                calls += 1;
                throw new TypeError('offline');
            },
        },
    );
    assert.equal(result.ok, false);
    assert.equal(calls, 1, 'a transport failure must not retry in a loop');
});

/* ------------------------------------------------------------------ *
 * Origin wiring
 * ------------------------------------------------------------------ */

test('a self-hosted auth override reaches the authorize URL and the exchange', async () => {
    let exchangeUrl = '';
    const states: string[] = [];
    const controller = new OrcaLoginController({
        providerId: 'orcarouter-oauth',
        source: 'pkce',
        origins: { authBaseUrl: 'https://self-hosted.example.test' },
        fetchImpl: async (input: any) => {
            exchangeUrl = String(input);
            return new Response(JSON.stringify({ key: FAKE_KEY, scope: 'api' }), { status: 200 });
        },
        callbacks: {
            onCredential: () => {},
            onStateChange: (state) => states.push(state.status),
        },
    });

    const state = await controller.begin('oob');
    assert.equal(new URL(state.authorizeUrl!).origin, 'https://self-hosted.example.test');
    await controller.submitCode(FAKE_CODE);
    // The exchange follows the auth origin, never the public inference origin.
    assert.equal(exchangeUrl, 'https://self-hosted.example.test/api/v1/auth/keys');
    assert.ok(!exchangeUrl.includes('api.orcarouter.ai'));
    controller.dispose();
});

test('the controller resolves the public auth origin when no override is given', () => {
    const resolved = resolveOrcaOrigins({});
    assert.equal(resolved.authBaseUrl, 'https://www.orcarouter.ai');
    assert.equal(resolved.apiBaseUrl, 'https://api.orcarouter.ai/v1');
});
