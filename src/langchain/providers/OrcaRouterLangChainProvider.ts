import { ChatOpenAI } from '@langchain/openai';
import OpenAiLangChainProvider from './OpenAiLangChainProvider';
import type { CompletionsParams, Provider } from '@/types';
import type { RootStore } from '@/store';
import { ChunkType } from '@/types/chunk';
import { Logger } from '@/utils/logger';
import { resolveOrcaOrigins } from '@/orcarouter/constants';
import { classifyRelayResponse, sanitizeErrorText } from '@/orcarouter/credentials';
import orcaRouterStore from '@/orcarouter/store';
import { resolveCredentialProviderId } from '@/orcarouter/provider';

const logger = new Logger('OrcaRouterLangChainProvider');

/**
 * Inference adapter for OrcaRouter.
 *
 * Both authentication choices (`orcarouter`, `orcarouter-oauth`) land here: the
 * credential is one OrcaRouter API key whichever adapter produced it, and this
 * class does not know or care which one it is.
 *
 * Requests always go to the **inference** origin (`https://api.orcarouter.ai/v1`)
 * with a Bearer token. OrcaRouter speaks the OpenAI wire format, so the shared
 * OpenAI-compatible transport is correct for both the `openai` and `anthropic`
 * model families it routes.
 */
export default class OrcaRouterLangChainProvider extends OpenAiLangChainProvider {
    constructor(provider: Provider, rootStore?: RootStore) {
        super(provider, rootStore);
        logger.info(
            `OrcaRouter provider initialized for "${provider.id}" against ${this.resolveBaseUrl()}`,
        );
    }

    /**
     * The inference origin. An explicit provider config wins, then the
     * `ORCA_API_BASE_URL` / `ORCA_BASE_URL` overrides, then the public default.
     * Never derived from the auth origin.
     */
    private resolveBaseUrl(): string {
        const { apiBaseUrl } = resolveOrcaOrigins({
            apiBaseUrl: this.provider.apiHost,
        });
        // OpenAiLangChainProvider appends `/v1` when it is missing, so pass the
        // origin through unchanged and let that normalization stay in one place.
        return apiBaseUrl;
    }

    initialize(stream = true): ChatOpenAI {
        return new ChatOpenAI({
            modelName: this.provider.selectedModel?.id,
            temperature: 0.7,
            streaming: stream,
            apiKey: this.provider.apiKey,
            configuration: { baseURL: this.resolveBaseUrl() },
        });
    }

    /**
     * A revoked durable key is a terminal reauthentication requirement, not a
     * retry. This marks the exact credential generation that made the rejected
     * request and surfaces an actionable message instead of looping.
     */
    private handleRelayFailure(error: unknown, onChunk: CompletionsParams['onChunk']): boolean {
        const status = extractStatus(error);
        if (status === null) return false;

        const classification = classifyRelayResponse(status);
        if (classification.kind !== 'needs_reauth') return false;

        const credentialProviderId = resolveCredentialProviderId(this.provider);
        const credential = orcaRouterStore.read(credentialProviderId);
        if (credential) {
            const changed = orcaRouterStore.markNeedsReauth(
                credentialProviderId,
                credential.generation,
            );
            logger.warn(
                `OrcaRouter key rejected (HTTP ${status}); reauth marked: ${changed}`,
            );
        }

        onChunk({
            type: ChunkType.ERROR,
            error: {
                message:
                    'OrcaRouter rejected this key — it was revoked or replaced. ' +
                    'Reconnect the account in Settings to continue.',
            },
        } as any);
        return true;
    }

    async completions(params: CompletionsParams): Promise<void> {
        const originalOnChunk = params.onChunk;
        const wrapped: CompletionsParams['onChunk'] = (chunk) => {
            if (chunk.type === ChunkType.ERROR) {
                const error: any = (chunk as any).error;
                const status = extractStatus(error);
                if (status !== null && classifyRelayResponse(status).kind === 'needs_reauth') {
                    this.handleRelayFailure(error, originalOnChunk);
                    return;
                }
                // Never let an upstream body carry a credential into the UI.
                originalOnChunk({
                    ...chunk,
                    error: { ...error, message: sanitizeErrorText(error?.message, 400) },
                } as any);
                return;
            }
            originalOnChunk(chunk);
        };

        try {
            await super.completions({ ...params, onChunk: wrapped });
        } catch (error) {
            if (!this.handleRelayFailure(error, originalOnChunk)) throw error;
        }
    }
}

/** Pull an HTTP status out of whatever shape the OpenAI SDK surfaced. */
function extractStatus(error: unknown): number | null {
    if (!error || typeof error !== 'object') return null;
    const candidate = error as { status?: unknown; response?: { status?: unknown }; code?: unknown };
    const raw = candidate.status ?? candidate.response?.status ?? candidate.code;
    const status = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(status) && status >= 100 ? status : null;
}

/** Re-exported for tests that assert the adapter selects the right transport. */
export { extractStatus };

