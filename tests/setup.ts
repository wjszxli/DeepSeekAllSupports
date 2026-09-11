/**
 * Shared test bootstrap.
 *
 * The OrcaRouter modules are written for a browser (MV3 extension pages and the
 * extension service worker), so tests supply the same globals the browser does
 * and then import the modules. Import this file **before** any `@/orcarouter`
 * module.
 *
 * Nothing here produces or asserts on a real credential.
 */

import { webcrypto } from 'node:crypto';

type MutableGlobal = Record<string, unknown>;

const globalObject = globalThis as unknown as MutableGlobal;

if (!globalObject.crypto) {
    Object.defineProperty(globalObject, 'crypto', {
        value: webcrypto,
        configurable: true,
        writable: true,
    });
}

// `fetch` is native in Node 18+, which is the version this repository targets.

export {};
