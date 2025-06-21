import { t } from '@/locales/i18n';
import type { ProviderConfig, StorageData } from '@/types';
import settingStore, { SettingsState } from '@/store/setting';

import { PROVIDERS_DATA } from './constant';

// 封装存储 & 读取 & 监听变化的方法
const storageUtils = {
    //  存储数据
    set: async <T>(key: string, value: T): Promise<void> => {
        try {
            await chrome.storage.local.set({ [key]: value });
        } catch (error) {
            console.error(`Failed to set ${key}:`, error);
        }
    },
    remove: async (key: string): Promise<void> => {
        try {
            await chrome.storage.local.remove(key);
        } catch (error) {
            console.error(`Failed to remove ${key}:`, error);
        }
    },
    //  读取数据
    get: async <T>(key: string): Promise<T | null> => {
        try {
            const result = await chrome.storage.local.get(key);
            return result[key] || null;
        } catch (error) {
            console.error(`Failed to get ${key}:`, error);
            return null;
        }
    },

    //  监听数据变化
    onChanged: (callback: (changes: Record<string, chrome.storage.StorageChange>) => void) => {
        chrome.storage.onChanged.addListener(callback);
    },

    //  获取完整配置
    getConfig: async (): Promise<StorageData> => {
        const providers =
            (await storageUtils.get<Record<string, ProviderConfig>>('providers')) || {};
        const selectedProvider = await storageUtils.get<string>('selectedProvider');
        let selectedModel = await storageUtils.get<string>('selectedModel');

        if (selectedProvider) {
            selectedModel =
                providers[selectedProvider]?.selectedModel ||
                providers[selectedProvider]?.models[0].value;
        }

        return { providers, selectedProvider, selectedModel };
    },
    //  获取指定服务商的 API Key
    getApiKey: async (provider: string): Promise<string | null> => {
        const providers =
            (await storageUtils.get<Record<string, ProviderConfig>>('providers')) || {};
        return providers[provider]?.apiKey ?? null;
    },

    //  存储完整的 providers 数据
    setProviders: async (providers: Record<string, ProviderConfig>): Promise<void> => {
        await storageUtils.set('providers', providers);
    },

    //  获取完整的 providers 数据
    getProviders: async (): Promise<Record<string, ProviderConfig>> => {
        return (await storageUtils.get<Record<string, ProviderConfig>>('providers')) || {};
    },

    //  更新某个服务商的 API Key
    updateApiKey: async (provider: string, apiKey: string): Promise<void> => {
        const data =
            (await storageUtils.get<Record<string, ProviderConfig>>('providers')) || PROVIDERS_DATA;
        if (!data[provider]) {
            throw new Error(t('invalidProviderData').replace('{provider}', provider));
        }

        data[provider].apiKey = apiKey;

        await storageUtils.set('providers', data);
    },

    //  设置当前选中的服务商
    setSelectedProvider: async (provider: string): Promise<void> => {
        await storageUtils.set('selectedProvider', provider);
    },

    //  获取当前选中的服务商
    getSelectedProvider: async (): Promise<string> => {
        return (await storageUtils.get<string>('selectedProvider')) || 'DeepSeek';
    },

    //  设置当前选中的模型
    setSelectedModel: async (model: string): Promise<void> => {
        const selectedProvider = await storageUtils.getSelectedProvider();
        let providers = await storageUtils.getProviders();
        if (!providers) {
            providers = PROVIDERS_DATA;
        }

        providers[selectedProvider].selectedModel = model;
        await storageUtils.setProviders(providers);
    },

    // Chat box size methods - now use settings store
    setChatBoxSize: async ({ width, height }: { width: number; height: number }): Promise<void> => {
        settingStore.setChatBoxSize({ width, height });
    },

    getChatBoxSize: async () => {
        return settingStore.getChatBoxSize();
    },

    // Settings-related methods now use settingStore
    setIsChatBoxIcon: async (isIcon: boolean): Promise<void> => {
        settingStore.setIsChatBoxIcon(isIcon);
    },
    getIsChatBoxIcon: async () => {
        return settingStore.isChatBoxIcon;
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
        settingStore.setWebSearchEnabled(enabled);
    },

    getWebSearchEnabled: async (): Promise<boolean> => {
        return settingStore.webSearchEnabled;
    },

    setUseWebpageContext: async (enabled: boolean): Promise<void> => {
        settingStore.setUseWebpageContext(enabled);
    },

    getUseWebpageContext: async (): Promise<boolean> => {
        return settingStore.useWebpageContext;
    },

    // 获取启用的搜索引擎列表
    getEnabledSearchEngines: async (): Promise<string[]> => {
        return settingStore.enabledSearchEngines;
    },

    // 设置启用的搜索引擎列表
    setEnabledSearchEngines: async (engines: string[]): Promise<void> => {
        settingStore.setEnabledSearchEngines(engines);
    },

    // 获取Tavily API密钥
    getTavilyApiKey: async (): Promise<string | null> => {
        return settingStore.tavilyApiKey || null;
    },

    // 设置Tavily API密钥
    setTavilyApiKey: async (apiKey: string): Promise<void> => {
        settingStore.setTavilyApiKey(apiKey);
    },

    // 获取搜索过滤的域名列表
    getFilteredDomains: async (): Promise<string[]> => {
        return settingStore.filteredDomains;
    },

    // 设置搜索过滤的域名列表
    setFilteredDomains: async (domains: string[]): Promise<void> => {
        settingStore.setFilteredDomains(domains);
    },

    // Get all settings at once
    getAllSettings: async (): Promise<SettingsState> => {
        return settingStore.getAllSettings();
    },

    // Set all settings at once
    setAllSettings: async (settings: Partial<SettingsState>): Promise<void> => {
        await settingStore.importSettings(settings);
    },
};

export default storageUtils;
