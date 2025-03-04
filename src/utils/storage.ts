import type { ProviderConfig, StorageData } from '@/typings';

import { PROVIDERS_DATA } from './constant';

// 封装存储 & 读取 & 监听变化的方法
const storage = {
    //  存储数据
    set: (key: string, value: any): Promise<void> => {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, () => resolve());
        });
    },
    remove: (key: string): Promise<void> => {
        return new Promise((resolve) => {
            chrome.storage.local.remove([key], () => resolve());
        });
    },
    //  读取数据
    get: <T>(key: string): Promise<T | null> => {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key] || null);
            });
        });
    },

    //  监听数据变化
    onChanged: (callback: (changes: Record<string, chrome.storage.StorageChange>) => void) => {
        chrome.storage.onChanged.addListener(callback);
    },

    //  获取完整配置
    getConfig: async (): Promise<StorageData> => {
        const providers = (await storage.get<Record<string, ProviderConfig>>('providers')) || {};
        const selectedProvider = await storage.get<string>('selectedProvider');
        const selectedModel = await storage.get<string>('selectedModel');
        return { providers, selectedProvider, selectedModel };
    },
    //  获取指定服务商的 API Key
    getApiKey: async (provider: string): Promise<string | null> => {
        const providers = (await storage.get<Record<string, ProviderConfig>>('providers')) || {};
        return providers[provider]?.apiKey ?? null;
    },

    //  存储完整的 providers 数据
    setProviders: async (providers: Record<string, ProviderConfig>): Promise<void> => {
        await storage.set('providers', providers);
    },

    //  获取完整的 providers 数据
    getProviders: async (): Promise<Record<string, ProviderConfig>> => {
        return (await storage.get<Record<string, ProviderConfig>>('providers')) || {};
    },

    //  更新某个服务商的 API Key
    updateApiKey: async (provider: string, apiKey: string): Promise<void> => {
        const data =
            (await storage.get<Record<string, ProviderConfig>>('providers')) || PROVIDERS_DATA;
        if (!data[provider]) {
            throw new Error(`数据非法，没有服务商：${provider}`);
        }

        data[provider].apiKey = apiKey;

        await storage.set('providers', data);
    },

    //  设置当前选中的服务商
    setSelectedProvider: async (provider: string): Promise<void> => {
        await storage.set('selectedProvider', provider);
    },

    //  设置当前选中的模型
    setSelectedModel: async (model: string): Promise<void> => {
        await storage.set('selectedModel', model);
    },

    setChatBoxSize: async ({ width, height }: { width: number; height: number }): Promise<void> => {
        await storage.set('height', height);
        await storage.set('width', width);
    },
    getChatBoxSize: async () => {
        const width = (await storage.get<number>('width')) || 500;
        const height = (await storage.get<number>('height')) || 500;
        return { width, height };
    },
    setIsChatBoxIcon: async (isIcon: boolean): Promise<void> => {
        await storage.set('isIcon', isIcon);
    },
    getIsChatBoxIcon: async () => {
        return await storage.get<boolean>('isIcon');
    },

    getLocale: async (): Promise<string | null> => {
        try {
            const result = await chrome.storage.local.get('locale');
            return result.locale || null;
        } catch (error) {
            console.error('Failed to get locale:', error);
            return null;
        }
    },

    setLocale: async (locale: string): Promise<void> => {
        try {
            await chrome.storage.local.set({ locale });
            window.dispatchEvent(new CustomEvent('localeChange', { detail: { locale } }));
        } catch (error) {
            console.error('Failed to set locale:', error);
        }
    },

    setWebSearchEnabled: async (enabled: boolean): Promise<void> => {
        await storage.set('webSearchEnabled', enabled);
    },

    getWebSearchEnabled: async (): Promise<boolean> => {
        return (await storage.get<boolean>('webSearchEnabled')) ?? false;
    },
};

export default storage;
