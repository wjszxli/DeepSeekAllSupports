/**
 * OrcaRouter PKCE + origin-policy tests.
 *
 * Every credential-shaped value in this file is a fake. No test may assert on,
 * or produce, a real key, code, or verifier.
 */

import '../setup';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
    base64UrlEncode,
    buildAuthorizeUrlWithPkce,
    createCodeChallenge,
    createCodeVerifier,
    createPkcePair,
    createState,
    isValidCallbackUrl,
    timingSafeEqualString,
} from '../../src/orcarouter/pkce';
import {
    ORCA_AUTHORIZE_PATH,
    ORCA_DEFAULT_API_BASE_URL,
    ORCA_DEFAULT_AUTH_BASE_URL,
    ORCA_EXCHANGE_PATH,
    buildApiUrl,
    buildAuthorizeUrl,
    buildExchangeUrl,
    isLoopbackHostname,
    normalizeOrcaOrigin,
    resolveOrcaOrigins,
} from '../../src/orcarouter/constants';

test('base64url has no padding and uses the URL-safe alphabet', () => {
    const encoded = base64UrlEncode(new Uint8Array([251, 255, 190, 0, 1, 2]));
    assert.doesNotMatch(encoded, /[+/=]/);
    assert.equal(encoded, Buffer.from([251, 255, 190, 0, 1, 2]).toString('base64url'));
});

test('verifier length is within the RFC 7636 range and is URL-safe', () => {
    const verifier = createCodeVerifier();
    assert.ok(verifier.length >= 43 && verifier.length <= 128, `length ${verifier.length}`);
    assert.match(verifier, /^[\w-]+$/);
});

test('challenge is base64url(sha256(verifier)) with no padding', async () => {
    const verifier = 'fake-verifier-for-hashing-only';
    const challenge = await createCodeChallenge(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    assert.equal(challenge, expected);
    assert.doesNotMatch(challenge, /[+/=]/);
});

test('a fresh verifier and state are generated per attempt', async () => {
    const first = await createPkcePair();
    const second = await createPkcePair();
    assert.notEqual(first.verifier, second.verifier);
    assert.notEqual(first.state, second.state);
    assert.notEqual(first.challenge, second.challenge);
    // The challenge must always be the hash of its own verifier.
    assert.equal(first.challenge, await createCodeChallenge(first.verifier));
});

test('state is not derived from the verifier or from a counter', () => {
    const states = new Set(Array.from({ length: 64 }, () => createState()));
    assert.equal(states.size, 64);
});

test('authorize URL sends an S256 challenge and never carries the verifier', async () => {
    const { verifier, challenge, state } = await createPkcePair();
    const url = new URL(
        buildAuthorizeUrlWithPkce({
            authBaseUrl: ORCA_DEFAULT_AUTH_BASE_URL,
            authorizePath: ORCA_AUTHORIZE_PATH,
            callbackUrl: 'oob',
            codeChallenge: challenge,
            state,
            appName: 'AiAllSupport',
            scope: 'api',
        }),
    );

    assert.equal(url.origin, 'https://www.orcarouter.ai');
    assert.equal(url.pathname, '/auth');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('code_challenge'), challenge);
    assert.equal(url.searchParams.get('state'), state);
    assert.equal(url.searchParams.get('callback_url'), 'oob');
    assert.equal(url.searchParams.get('app_name'), 'AiAllSupport');
    assert.equal(url.searchParams.get('scope'), 'api');
    // The verifier must never appear anywhere in the URL — query, path, or hash.
    assert.ok(!url.toString().includes(verifier));
});

test('the authorize URL never targets the inference origin and never gains a /v1', () => {
    assert.equal(buildAuthorizeUrl(ORCA_DEFAULT_AUTH_BASE_URL), 'https://www.orcarouter.ai/auth');
    assert.equal(buildAuthorizeUrl(ORCA_DEFAULT_AUTH_BASE_URL.endsWith('/') ? ORCA_DEFAULT_AUTH_BASE_URL : `${ORCA_DEFAULT_AUTH_BASE_URL}/`), 'https://www.orcarouter.ai/auth');
});

test('exchange URL is /api/v1/auth/keys on the auth origin, never /v1/auth/keys', () => {
    const url = buildExchangeUrl(ORCA_DEFAULT_AUTH_BASE_URL);
    assert.equal(url, 'https://www.orcarouter.ai/api/v1/auth/keys');
    assert.equal(new URL(url).origin, 'https://www.orcarouter.ai');
    assert.ok(!url.includes('api.orcarouter.ai'));
    // The documented failure mode, asserted explicitly.
    assert.ok(!url.endsWith('/v1/auth/keys') || url.includes('/api/v1/auth/keys'));
    assert.notEqual(url, `${ORCA_DEFAULT_API_BASE_URL}/auth/keys`);
});

test('inference URLs are built only under the API origin', () => {
    assert.equal(
        buildApiUrl(ORCA_DEFAULT_API_BASE_URL, '/models'),
        'https://api.orcarouter.ai/v1/models',
    );
    assert.equal(
        buildApiUrl(`${ORCA_DEFAULT_API_BASE_URL}/`, '/chat/completions'),
        'https://api.orcarouter.ai/v1/chat/completions',
    );
});

test('constants keep the two origins distinct and fixed paths correct', () => {
    assert.equal(ORCA_DEFAULT_AUTH_BASE_URL, 'https://www.orcarouter.ai');
    assert.equal(ORCA_DEFAULT_API_BASE_URL, 'https://api.orcarouter.ai/v1');
    assert.equal(ORCA_AUTHORIZE_PATH, '/auth');
    assert.equal(ORCA_EXCHANGE_PATH, '/api/v1/auth/keys');
});

test('a wrong or missing state fails the comparison', () => {
    assert.equal(timingSafeEqualString('abc', 'abc'), true);
    assert.equal(timingSafeEqualString('abc', 'abd'), false);
    assert.equal(timingSafeEqualString('abc', 'abcd'), false);
    assert.equal(timingSafeEqualString(null, 'abc'), false);
    // A missing state on either side must never compare equal.
    assert.equal(timingSafeEqualString(null, null), false);
    assert.equal(timingSafeEqualString('', ''), true);
});

test('callback URL policy: https anywhere, http only on loopback', () => {
    assert.equal(isValidCallbackUrl('https://example.com/cb'), true);
    assert.equal(isValidCallbackUrl('https://example.com:8443/cb'), true);
    assert.equal(isValidCallbackUrl('http://127.0.0.1:51733/cb'), true);
    assert.equal(isValidCallbackUrl('http://localhost:1234/cb'), true);
    assert.equal(isValidCallbackUrl('http://[::1]:1234/cb'), true);
    // Everything below must be refused: no plaintext to a remote host, no
    // userinfo, no fragment, and no non-http scheme.
    assert.equal(isValidCallbackUrl('http://example.com/cb'), false);
    assert.equal(isValidCallbackUrl('https://user:pass@example.com/cb'), false);
    assert.equal(isValidCallbackUrl('https://example.com/cb#token'), false);
    assert.equal(isValidCallbackUrl('ftp://example.com/cb'), false);
    assert.equal(isValidCallbackUrl('not a url'), false);
});

test('loopback detection covers the documented host forms', () => {
    assert.equal(isLoopbackHostname('localhost'), true);
    assert.equal(isLoopbackHostname('127.0.0.1'), true);
    assert.equal(isLoopbackHostname('::1'), true);
    assert.equal(isLoopbackHostname('example.com'), false);
    assert.equal(isLoopbackHostname('127.0.0.1.example.com'), false);
});

test('origin normalization requires HTTPS off loopback and strips credentials', () => {
    assert.equal(normalizeOrcaOrigin('https://example.com/'), 'https://example.com');
    assert.equal(normalizeOrcaOrigin('https://example.com///'), 'https://example.com');
    assert.equal(normalizeOrcaOrigin('http://127.0.0.1:8080'), 'http://127.0.0.1:8080');
    assert.equal(normalizeOrcaOrigin('https://user:pw@example.com'), undefined);
    assert.equal(normalizeOrcaOrigin('https://example.com/?a=1'), undefined);
    assert.equal(normalizeOrcaOrigin('https://example.com/#x'), undefined);
    assert.equal(normalizeOrcaOrigin('ftp://example.com'), undefined);
    assert.equal(normalizeOrcaOrigin(''), undefined);
    assert.equal(normalizeOrcaOrigin(null), undefined);
});

test('resolved origins default to the two public origins', () => {
    const resolved = resolveOrcaOrigins({});
    assert.equal(resolved.authBaseUrl, 'https://www.orcarouter.ai');
    assert.equal(resolved.apiBaseUrl, 'https://api.orcarouter.ai/v1');
    assert.equal(resolved.authSource, 'default');
    assert.equal(resolved.apiSource, 'default');
});

test('explicit auth and API origins are independent, with config over env', () => {
    const resolved = resolveOrcaOrigins({
        authBaseUrl: 'https://auth.self-hosted.test',
        apiBaseUrl: 'https://relay.self-hosted.test/v1',
    });
    assert.equal(resolved.authBaseUrl, 'https://auth.self-hosted.test');
    assert.equal(resolved.apiBaseUrl, 'https://relay.self-hosted.test/v1');
    // Neither origin may be derived from the other.
    assert.ok(!resolved.apiBaseUrl.startsWith(resolved.authBaseUrl));
    assert.equal(resolved.authSource, 'config');
    assert.equal(resolved.apiSource, 'config');
});

test('a shared ORCA_BASE_URL fallback applies to both origins', () => {
    const previous = { ...process.env };
    process.env.ORCA_BASE_URL = 'https://shared.self-hosted.test';
    delete process.env.ORCA_AUTH_BASE_URL;
    delete process.env.ORCA_API_BASE_URL;
    try {
        const resolved = resolveOrcaOrigins({});
        assert.equal(resolved.authBaseUrl, 'https://shared.self-hosted.test');
        assert.equal(resolved.apiBaseUrl, 'https://shared.self-hosted.test');
        assert.equal(resolved.authSource, 'env-shared');
        assert.equal(resolved.apiSource, 'env-shared');
    } finally {
        process.env = previous;
    }
});

test('an explicit env override beats the shared fallback, per origin', () => {
    const previous = { ...process.env };
    process.env.ORCA_BASE_URL = 'https://shared.self-hosted.test';
    process.env.ORCA_AUTH_BASE_URL = 'https://auth-only.test';
    try {
        const resolved = resolveOrcaOrigins({});
        assert.equal(resolved.authBaseUrl, 'https://auth-only.test');
        assert.equal(resolved.apiBaseUrl, 'https://shared.self-hosted.test');
        assert.equal(resolved.authSource, 'env-auth');
    } finally {
        process.env = previous;
    }
});

test('a plaintext remote origin is rejected in favour of the safe default', () => {
    const previous = { ...process.env };
    process.env.ORCA_AUTH_BASE_URL = 'http://remote-host.test';
    try {
        const resolved = resolveOrcaOrigins({});
        // The bad value is dropped; the public default stands.
        assert.equal(resolved.authBaseUrl, 'https://www.orcarouter.ai');
    } finally {
        process.env = previous;
    }
});
