/**
 * Persistence for OrcaRouter credentials and catalog state.
 *
 * The **secret itself lives where this project already keeps provider secrets**:
 * `llmStore.providers[].apiKey`, persisted to `chrome.storage.local` by the
 * existing mobx-persist setup. This module only adds the non-secret credential
 * metadata (source, granted scope, account, generation, reauth status) and the
 * catalog cache, so no second credential store is introduced.
 */

import { makeAutoObservable } from 'mobx';
import { makePersistable } from 'mobx-persist-store';
import chromeStorageAdapter from '@/store/chromeStorageAdapter';
import llmStore from '@/store/llm';
import type { OrcaCredential, OrcaCredentialSource, OrcaCredentialStore } from './credentials';
import type { OrcaCatalogResult, OrcaModel } from './catalog';

export interface OrcaCredentialMetadata {
    source: OrcaCredentialSource;
    scope: string | null;
    accountId: string | null;
    /**
     * Monotonic per-write counter. Persisted so a `401` arriving after a
     * restart still cannot be attributed to the wrong credential generation.
     */
    generation: number;
    createdAt: number;
    status: 'active' | 'needsReauth';
}

export interface OrcaCatalogCacheEntry {
    models: OrcaModel[];
    source: 'live' | 'fallback';
    degradedReason: string | null;
    fetchedAt: number;
}

class OrcaRouterStore {
    metadata: Record<string, OrcaCredentialMetadata> = {};
    catalog: Record<string, OrcaCatalogCacheEntry> = {};

    constructor() {
        makeAutoObservable(this);
        makePersistable(this, {
            name: 'orcarouter-store',
            properties: ['metadata', 'catalog'],
            storage: chromeStorageAdapter as any,
        });
    }

    private defaultMetadata(source: OrcaCredentialSource): OrcaCredentialMetadata {
        return {
            source,
            scope: null,
            accountId: null,
            generation: 0,
            createdAt: 0,
            status: 'active',
        };
    }

    getMetadata(providerId: string): OrcaCredentialMetadata {
        return this.metadata[providerId] ?? this.defaultMetadata('api-key');
    }

    private setMetadata(providerId: string, patch: Partial<OrcaCredentialMetadata>): void {
        this.metadata = {
            ...this.metadata,
            [providerId]: { ...this.getMetadata(providerId), ...patch },
        };
    }

    /**
     * Read the credential for a provider. The key comes from the provider's own
     * `apiKey` field — the project's single secret location — and is returned
     * only to code that needs to send it.
     */
    read(providerId: string): OrcaCredential | null {
        const provider = llmStore.providers.find((item) => item.id === providerId);
        const apiKey = provider?.apiKey?.trim();
        if (!apiKey) return null;
        const meta = this.getMetadata(providerId);
        return {
            providerId,
            source: meta.source,
            apiKey,
            scope: meta.scope,
            accountId: meta.accountId,
            generation: meta.generation,
            createdAt: meta.createdAt,
            status: meta.status,
        };
    }

    /**
     * Persist a credential. The next generation is derived from the stored
     * metadata, so a late failure attributed to an older generation can be
     * recognized and dropped.
     */
    write(credential: OrcaCredential): void {
        const provider = llmStore.providers.find((item) => item.id === credential.providerId);
        const nextGeneration = Math.max(
            this.getMetadata(credential.providerId).generation + 1,
            credential.generation,
        );
        if (provider) {
            llmStore.updateProvider({
                ...provider,
                apiKey: credential.apiKey,
                // A credential is only ever written for an existing key.
                enabled: true,
            });
        }
        this.setMetadata(credential.providerId, {
            source: credential.source,
            scope: credential.scope,
            accountId: credential.accountId,
            generation: nextGeneration,
            createdAt: credential.createdAt,
            status: credential.status,
        });
    }

    /**
     * Clear the credential. Refuses to blank a key the user pasted manually
     * under a *different* provider entry, which is why it is keyed by provider.
     */
    clear(providerId: string): void {
        const provider = llmStore.providers.find((item) => item.id === providerId);
        if (provider) {
            llmStore.updateProvider({ ...provider, apiKey: '' });
        }
        this.setMetadata(providerId, {
            ...this.defaultMetadata(this.getMetadata(providerId).source),
            status: 'active',
        });
    }

    /**
     * Mark one exact credential generation as needing reauthentication.
     * Returns `true` when this call actually changed the stored state, so a
     * stale rejection can be reported and ignored rather than surfacing as a
     * fresh error against a credential the user has already replaced.
     */
    markNeedsReauth(providerId: string, rejectedGeneration: number): boolean {
        const meta = this.getMetadata(providerId);
        if (meta.generation !== rejectedGeneration) return false;
        if (meta.status === 'needsReauth') return false;
        this.setMetadata(providerId, { status: 'needsReauth' });
        return true;
    }

    isNeedsReauth(providerId: string): boolean {
        return this.getMetadata(providerId).status === 'needsReauth';
    }

    /** The adapter the credential seam writes through. */
    get credentialStore(): OrcaCredentialStore {
        return {
            read: (providerId: string) => this.read(providerId),
            write: (credential: OrcaCredential) => this.write(credential),
            clear: (providerId: string) => this.clear(providerId),
        };
    }

    /* ---------------- catalog cache ---------------- */

    saveCatalog(providerId: string, result: OrcaCatalogResult): void {
        this.catalog = {
            ...this.catalog,
            [providerId]: {
                models: result.models,
                source: result.source,
                degradedReason: result.degradedReason,
                fetchedAt: result.fetchedAt,
            },
        };
    }

    getCatalog(providerId: string): OrcaCatalogCacheEntry | null {
        return this.catalog[providerId] ?? null;
    }
}

const orcaRouterStore = new OrcaRouterStore();
export default orcaRouterStore;
