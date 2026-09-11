import { Model, Provider, Robot } from '@/types';
import { ConfigModelType } from '@/types';
import { Message } from '@/types/message';
import { Chunk } from '@/types/chunk';
import BaseLangChainProvider from '../providers/BaseLangChainProvider';
import LangChainProviderFactory from '../providers/LangChainProviderFactory';
import { filterContextMessages, filterUsefulMessages } from '@/utils/message/filters';
import { findLast } from 'lodash';
import { getModelForInterface, navigateToSettings, requiresApiKey } from '@/utils';
import llmStore from '@/store/llm';
import type { RootStore } from '@/store';
import { Logger } from '@/utils/logger';
import { discoverModelsForProvider, isOrcaRouterProvider } from '@/orcarouter/provider';

const logger = new Logger('LangChainService');

export default class LangChainService {
    private provider: BaseLangChainProvider;

    // Static collection of active providers for tool refresh
    private static activeProviders: Set<BaseLangChainProvider> = new Set();
    private static toolRefreshInitialized = false;

    constructor(provider: Provider, rootStore?: RootStore) {
        // 检测 apiKey 是否需要配置
        this.checkApiKey(provider);

        this.provider = LangChainProviderFactory.create(provider, rootStore);

        // Register this provider for tool refresh
        LangChainService.activeProviders.add(this.provider);

        // Initialize tool refresh system if not already done
        if (!LangChainService.toolRefreshInitialized && rootStore) {
            LangChainService.initializeToolRefresh(rootStore);
        }
    }

    /**
     * Initialize the global tool refresh system
     */
    private static initializeToolRefresh(rootStore: RootStore) {
        if (LangChainService.toolRefreshInitialized) return;

        const refreshCallback = () => {
            logger.info(
                `[LangChainService] Refreshing tools for ${LangChainService.activeProviders.size} active providers`,
            );
            LangChainService.activeProviders.forEach((provider) => {
                try {
                    provider.refreshTools();
                } catch (error) {
                    console.error('[LangChainService] Error refreshing tools for provider:', error);
                }
            });
        };

        rootStore.settingStore.registerToolRefreshCallback(refreshCallback);
        LangChainService.toolRefreshInitialized = true;

        logger.info('[LangChainService] Tool refresh system initialized');
    }

    /**
     * Remove a provider from the active providers set
     */
    public dispose() {
        LangChainService.activeProviders.delete(this.provider);
    }

    /**
     * Static method to refresh tools for all active providers
     */
    public static refreshAllTools() {
        logger.info(
            `[LangChainService] Manually refreshing tools for ${LangChainService.activeProviders.size} active providers`,
        );
        LangChainService.activeProviders.forEach((provider) => {
            try {
                provider.refreshTools();
            } catch (error) {
                console.error('[LangChainService] Error refreshing tools for provider:', error);
            }
        });
    }

    /**
     * Static method to get debug information about active providers and their tools
     */
    public static getDebugInfo() {
        const info: {
            activeProviders: number;
            toolRefreshInitialized: boolean;
            providers: Array<{
                tools: Array<{
                    name: string;
                    description: string;
                }>;
                toolCount: number;
            }>;
        } = {
            activeProviders: LangChainService.activeProviders.size,
            toolRefreshInitialized: LangChainService.toolRefreshInitialized,
            providers: [],
        };

        LangChainService.activeProviders.forEach((provider) => {
            const tools = provider.getTools();
            info.providers.push({
                tools: tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description.substring(0, 100) + '...',
                })),
                toolCount: tools.length,
            });
        });

        return info;
    }

    private checkApiKey(provider: Provider) {
        // 如果不需要 apiKey，跳过检测
        if (!requiresApiKey(provider)) {
            return;
        }

        // 如果需要 apiKey 但没有值，弹出提示
        if (!provider.apiKey || provider.apiKey.trim() === '') {
            this.showApiKeyMissingDialog(provider);
        }
    }

    private showApiKeyMissingDialog(provider: Provider) {
        const providerName = provider.name || provider.id;

        // 延迟弹窗，避免阻塞构造函数
        setTimeout(() => {
            if (typeof window !== 'undefined' && window.confirm) {
                const userConfirmed = window.confirm(
                    `${providerName} 需要配置 API Key 才能正常使用。\n\n是否现在前往设置页面进行配置？`,
                );

                if (userConfirmed) {
                    navigateToSettings();
                }
            } else {
                // 在非浏览器环境中，使用 console 提示
                console.warn(
                    `${providerName} requires API Key configuration. Please configure it in settings.`,
                );
            }
        }, 100);
    }

    async check(): Promise<{ valid: boolean; error: Error | null }> {
        return this.provider.check();
    }

    /**
     * Refresh tools based on current settings
     * This should be called when search settings change
     */
    public refreshTools() {
        this.provider.refreshTools();
    }

    /**
     * Get available tools
     */
    public getTools() {
        return this.provider.getTools();
    }

    /**
     * Check if tools are available
     */
    public hasTools() {
        return this.provider.hasTools();
    }

    async getModels(provider: Provider): Promise<Model[]> {
        // OrcaRouter's catalog is discovered through its own capability-aware
        // path, so the two auth entries cannot drift from each other or from the
        // OpenAI request path.
        if (isOrcaRouterProvider(provider)) {
            const result = await discoverModelsForProvider(provider);
            return result.models;
        }
        return this.provider.models(provider);
    }

    async completions({
        messages,
        robot,
        onChunk,
        onFilterMessages,
    }: {
        messages: Message[];
        robot: Robot;
        onChunk: (chunk: Chunk) => void;
        onFilterMessages?: (messages: Message[]) => void;
    }): Promise<void> {
        // 确保消息已经过滤
        messages = filterContextMessages(messages);

        const lastUserMessage = findLast(messages, (m) => m.role === 'user');
        if (!lastUserMessage) {
            console.error('completions returning early: Missing lastUserMessage');
            return;
        }

        const filteredMessages = filterUsefulMessages(messages);

        await this.provider.completions({
            messages: filteredMessages,
            robot,
            onChunk,
            onFilterMessages: onFilterMessages || (() => {}),
        });
    }

    // Static methods merged from AiService.ts
    static async checkApiProvider(
        provider: Provider,
        rootStore?: RootStore,
    ): Promise<{ valid: boolean; error: Error | null }> {
        const langChainService = new LangChainService(provider, rootStore);
        const result = await langChainService.check();
        if (result.valid && !result.error) {
            return result;
        }
        return langChainService.check();
    }

    static async getModels(provider: Provider, rootStore?: RootStore): Promise<Model[]> {
        if (isOrcaRouterProvider(provider)) {
            const result = await discoverModelsForProvider(provider);
            return result.models;
        }
        const langChainService = new LangChainService(provider, rootStore);
        return langChainService.getModels(provider);
    }

    static async fetchChatCompletion({
        messages,
        robot,
        onChunkReceived,
        interfaceType = ConfigModelType.CHAT,
        rootStore,
    }: {
        messages: Message[];
        robot: Robot;
        onChunkReceived: (chunk: Chunk) => void;
        interfaceType?: ConfigModelType;
        rootStore?: RootStore;
    }): Promise<void> {
        const model = getModelForInterface(interfaceType);
        const provider = llmStore.providers.find((p) => p.id === model.provider);

        if (!provider) {
            throw new Error('Provider not found');
        }

        robot.model = model;
        provider.selectedModel = model;

        messages = filterContextMessages(messages);

        const lastUserMessage = findLast(messages, (m) => m.role === 'user');
        if (!lastUserMessage) {
            console.error(
                'fetchChatCompletion returning early: Missing lastUserMessage or lastAnswer',
            );
            return;
        }

        const langChainService = new LangChainService(provider, rootStore);
        try {
            await langChainService.completions({
                messages,
                robot,
                onChunk: onChunkReceived,
                onFilterMessages: (filteredMessages) => {
                    console.log('Filtered messages:', filteredMessages.length);
                },
            });
        } finally {
            // Clean up the service instance
            langChainService.dispose();
        }
    }
}

// Add global debugging functions in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    (window as any).debugLangChain = {
        refreshAllTools: LangChainService.refreshAllTools,
        getDebugInfo: LangChainService.getDebugInfo,
    };
}
