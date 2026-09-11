/**
 * Live end-to-end check against the real OrcaRouter service.
 *
 * This script drives the **implemented provider code path**, not a bare curl:
 *  - `discoverOrcaCatalog` from `src/orcarouter/catalog.ts` performs the live
 *    `GET https://api.orcarouter.ai/v1/models` with the user's key;
 *  - `emitInferenceRequest` from `src/orcarouter/relay.ts` performs a real
 *    inference request through the shared relay.
 *
 * The key is read from `ORCAROUTER_API_KEY` and is never printed, logged, or
 * written to a file. Only counts, model ids, and status codes are reported.
 *
 * Usage: TS_NODE_PROJECT=tests/tsconfig.json node --require ts-node/register scripts/orcarouter-live.ts
 */

import '../tests/setup';
import { discoverOrcaCatalog, filterModelsForCapability } from '../src/orcarouter/catalog';
import { emitInferenceRequest } from '../src/orcarouter/relay';
import { ORCA_DEFAULT_API_BASE_URL, ORCA_DEFAULT_AUTH_BASE_URL } from '../src/orcarouter/constants';

const API_KEY = process.env.ORCAROUTER_API_KEY?.trim();
const API_BASE = process.env.ORCA_API_BASE_URL?.trim() || ORCA_DEFAULT_API_BASE_URL;

interface Report {
    authOrigin: string;
    inferenceOrigin: string;
    catalog: {
        source: string;
        status: number | null;
        modelCount: number;
        chatCount: number;
        imageChatCount: number;
        sampleIds: string[];
        degradedReason: string | null;
    };
    inference: {
        ok: boolean;
        status: number | null;
        modelUsed: string | null;
        message: string | null;
    };
    authOriginProbe: {
        exchangePathReachable: boolean;
        note: string;
    };
}

async function main(): Promise<void> {
    if (!API_KEY) {
        console.error('ORCAROUTER_API_KEY is not set; skipping the live check.');
        process.exitCode = 2;
        return;
    }

    const report: Report = {
        authOrigin: ORCA_DEFAULT_AUTH_BASE_URL,
        inferenceOrigin: API_BASE,
        catalog: {
            source: '',
            status: null,
            modelCount: 0,
            chatCount: 0,
            imageChatCount: 0,
            sampleIds: [],
            degradedReason: null,
        },
        inference: { ok: false, status: null, modelUsed: null, message: null },
        authOriginProbe: { exchangePathReachable: false, note: '' },
    };

    /* ---- 1. Live model catalog through the implemented discovery path ---- */
    const catalog = await discoverOrcaCatalog({
        apiBaseUrl: API_BASE,
        apiKey: API_KEY,
        capability: 'chat',
    });

    report.catalog.source = catalog.source;
    report.catalog.status = catalog.status;
    report.catalog.modelCount = catalog.models.length;
    report.catalog.degradedReason = catalog.degradedReason;
    report.catalog.chatCount = filterModelsForCapability(catalog.models, 'chat').length;
    report.catalog.imageChatCount = filterModelsForCapability(
        catalog.models,
        'vision',
        'image',
    ).length;
    report.catalog.sampleIds = catalog.models.slice(0, 8).map((model) => model.id);

    /* ---- 2. Real inference through the shared relay path ---- */
    const model = catalog.models[0]?.id;
    if (model) {
        const outcome = await emitInferenceRequest(
            { id: 'orcarouter', apiKey: API_KEY, apiHost: API_BASE },
            {
                path: '/chat/completions',
                body: {
                    model,
                    messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
                    max_tokens: 16,
                    stream: false,
                },
            },
        );
        report.inference.ok = outcome.ok;
        report.inference.status = outcome.ok ? outcome.response.status : outcome.status;
        report.inference.modelUsed = model;
        report.inference.message = outcome.ok ? null : outcome.message;
    }

    /* ---- 3. Auth-origin reachability probe (no credentials involved) ---- */
    // Confirms the documented split: the exchange endpoint lives on the auth
    // origin, and the inference origin must not serve it.
    try {
        const probe = await fetch(`${ORCA_DEFAULT_AUTH_BASE_URL}/api/v1/auth/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // A deliberately empty body: this asserts routing, not authorization.
            body: JSON.stringify({}),
        });
        report.authOriginProbe.exchangePathReachable = probe.status !== 404;
        report.authOriginProbe.note = `POST ${ORCA_DEFAULT_AUTH_BASE_URL}/api/v1/auth/keys -> HTTP ${probe.status}`;
    } catch {
        report.authOriginProbe.note = 'auth origin probe failed to connect';
    }

    console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
    console.error('live check failed:', error?.message ?? error);
    process.exitCode = 1;
});
