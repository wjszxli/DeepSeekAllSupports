import { makeAutoObservable } from 'mobx';
import { db } from '@/db';
import { FILTERED_DOMAINS, SEARCH_ENGINES } from '@/utils/constant';
import { Logger } from '@/utils/logger';

const logger = new Logger('settingStore');

export interface ChatBoxSize {
    width: number;
    height: number;
}

export interface SettingsState {
    // Interface settings
    isChatBoxIcon: boolean;
    useWebpageContext: boolean;
    size: ChatBoxSize;

    // Search settings
    webSearchEnabled: boolean;
    enabledSearchEngines: string[];
    tavilyApiKey: string;
    exaApiKey: string;
    bochaApiKey: string;
    filteredDomains: string[];
}

// Setting keys
const IS_CHAT_BOX_ICON_KEY = 'isChatBoxIcon';
const USE_WEBPAGE_CONTEXT_KEY = 'useWebpageContext';
const SIZE_KEY = 'size';
const WEB_SEARCH_ENABLED_KEY = 'webSearchEnabled';
const ENABLED_SEARCH_ENGINES_KEY = 'enabledSearchEngines';
const TAVILY_API_KEY = 'tavilyApiKey';
const EXA_API_KEY = 'exaApiKey';
const BOCHA_API_KEY = 'bochaApiKey';
const FILTERED_DOMAINS_KEY = 'filteredDomains';

// Default values
const DEFAULT_SIZE: ChatBoxSize = { width: 600, height: 800 };

class SettingStore {
    // Interface settings
    isChatBoxIcon: boolean = true;
    useWebpageContext: boolean = true;
    size: ChatBoxSize = DEFAULT_SIZE;

    // Search settings
    webSearchEnabled: boolean = false;
    enabledSearchEngines: string[] = [SEARCH_ENGINES.GOOGLE, SEARCH_ENGINES.BAIDU];
    tavilyApiKey: string = '';
    exaApiKey: string = '';
    bochaApiKey: string = '';
    filteredDomains: string[] = FILTERED_DOMAINS;

    constructor() {
        makeAutoObservable(this);
        this.loadSettings();
    }

    async loadSettings() {
        try {
            // Load individual settings
            const isChatBoxIcon = await db.settings.get(IS_CHAT_BOX_ICON_KEY);
            const useWebpageContext = await db.settings.get(USE_WEBPAGE_CONTEXT_KEY);
            const size = await db.settings.get(SIZE_KEY);
            const webSearchEnabled = await db.settings.get(WEB_SEARCH_ENABLED_KEY);
            const enabledSearchEngines = await db.settings.get(ENABLED_SEARCH_ENGINES_KEY);
            const tavilyApiKey = await db.settings.get(TAVILY_API_KEY);
            const exaApiKey = await db.settings.get(EXA_API_KEY);
            const bochaApiKey = await db.settings.get(BOCHA_API_KEY);
            const filteredDomains = await db.settings.get(FILTERED_DOMAINS_KEY);

            // Apply settings if they exist
            if (isChatBoxIcon !== undefined) this.isChatBoxIcon = isChatBoxIcon.value;
            if (useWebpageContext !== undefined) this.useWebpageContext = useWebpageContext.value;
            if (size !== undefined) this.size = size.value;
            if (webSearchEnabled !== undefined) this.webSearchEnabled = webSearchEnabled.value;
            if (enabledSearchEngines !== undefined)
                this.enabledSearchEngines = enabledSearchEngines.value;
            if (tavilyApiKey !== undefined) this.tavilyApiKey = tavilyApiKey.value;
            if (exaApiKey !== undefined) this.exaApiKey = exaApiKey.value;
            if (bochaApiKey !== undefined) this.bochaApiKey = bochaApiKey.value;
            if (filteredDomains !== undefined) this.filteredDomains = filteredDomains.value;

            // Migration: Check for old width/height values in chrome storage
            await this.migrateOldSizeSettings();
        } catch (error) {
            logger.error('Failed to load settings:', error);
            // Save default settings if loading fails
            this.saveSettings();
        }
    }

    async migrateOldSizeSettings() {
        try {
            // Check for old width/height values in chrome storage
            const result = await chrome.storage.local.get(['width', 'height']);

            if (result.width || result.height) {
                const width = result.width || DEFAULT_SIZE.width;
                const height = result.height || DEFAULT_SIZE.height;

                // Update the size setting with migrated values
                this.size = { width, height };
                await this.saveSettings();

                // Remove old keys
                await chrome.storage.local.remove(['width', 'height']);

                logger.info('Migrated old size settings to new format');
            }
        } catch (error) {
            logger.warn('Failed to migrate old size settings:', error);
        }
    }

    async saveSettings() {
        try {
            // Save each setting individually
            await db.settings.put({ key: IS_CHAT_BOX_ICON_KEY, value: this.isChatBoxIcon });
            await db.settings.put({ key: USE_WEBPAGE_CONTEXT_KEY, value: this.useWebpageContext });
            await db.settings.put({ key: SIZE_KEY, value: JSON.parse(JSON.stringify(this.size)) });
            await db.settings.put({ key: WEB_SEARCH_ENABLED_KEY, value: this.webSearchEnabled });
            await db.settings.put({
                key: ENABLED_SEARCH_ENGINES_KEY,
                value: JSON.parse(JSON.stringify(this.enabledSearchEngines)),
            });
            if (this.tavilyApiKey) {
                await db.settings.put({ key: TAVILY_API_KEY, value: this.tavilyApiKey });
            }
            if (this.exaApiKey) {
                await db.settings.put({ key: EXA_API_KEY, value: this.exaApiKey });
            }
            if (this.bochaApiKey) {
                await db.settings.put({ key: BOCHA_API_KEY, value: this.bochaApiKey });
            }
            await db.settings.put({
                key: FILTERED_DOMAINS_KEY,
                value: JSON.parse(JSON.stringify(this.filteredDomains)),
            });
        } catch (error) {
            logger.error('Failed to save settings:', error);
        }
    }

    // Get all settings as an object
    getAllSettings(): SettingsState {
        return {
            isChatBoxIcon: this.isChatBoxIcon,
            useWebpageContext: this.useWebpageContext,
            size: this.size,
            webSearchEnabled: this.webSearchEnabled,
            enabledSearchEngines: this.enabledSearchEngines,
            tavilyApiKey: this.tavilyApiKey,
            exaApiKey: this.exaApiKey,
            bochaApiKey: this.bochaApiKey,
            filteredDomains: this.filteredDomains,
        };
    }

    // Import settings from an object
    async importSettings(settings: Partial<SettingsState>) {
        // Update only the settings that are provided
        if (settings.isChatBoxIcon !== undefined) this.isChatBoxIcon = settings.isChatBoxIcon;
        if (settings.useWebpageContext !== undefined)
            this.useWebpageContext = settings.useWebpageContext;
        if (settings.size !== undefined) this.size = settings.size;
        if (settings.webSearchEnabled !== undefined)
            this.webSearchEnabled = settings.webSearchEnabled;
        if (settings.enabledSearchEngines !== undefined)
            this.enabledSearchEngines = settings.enabledSearchEngines;
        if (settings.tavilyApiKey !== undefined) this.tavilyApiKey = settings.tavilyApiKey;
        if (settings.exaApiKey !== undefined) this.exaApiKey = settings.exaApiKey;
        if (settings.bochaApiKey !== undefined) this.bochaApiKey = settings.bochaApiKey;
        if (settings.filteredDomains !== undefined) this.filteredDomains = settings.filteredDomains;

        // Save the imported settings
        await this.saveSettings();

        // Handle mutually exclusive settings
        if (this.webSearchEnabled && this.useWebpageContext) {
            this.useWebpageContext = false;
            await this.saveSettings();
        }

        logger.info('Settings imported successfully');
    }

    // Interface settings methods
    setIsChatBoxIcon(value: boolean) {
        this.isChatBoxIcon = value;
        this.saveSettings();
    }

    setUseWebpageContext(value: boolean) {
        this.useWebpageContext = value;

        // If enabling webpage context, disable web search (they are mutually exclusive)
        if (value && this.webSearchEnabled) {
            this.webSearchEnabled = false;
        }

        this.saveSettings();
    }

    // Size settings methods
    setSize(size: ChatBoxSize) {
        this.size = { ...size };
        this.saveSettings();
    }

    setChatBoxSize(size: ChatBoxSize) {
        this.setSize(size);
    }

    getChatBoxSize(): ChatBoxSize {
        return { ...this.size };
    }

    // Search settings methods
    setWebSearchEnabled(value: boolean) {
        this.webSearchEnabled = value;

        // If enabling web search, disable webpage context (they are mutually exclusive)
        if (value && this.useWebpageContext) {
            this.useWebpageContext = false;
        }

        this.saveSettings();
    }

    setEnabledSearchEngines(engines: string[]) {
        this.enabledSearchEngines = engines;
        this.saveSettings();
    }

    setTavilyApiKey(key: string) {
        this.tavilyApiKey = key;
        this.saveSettings();
    }

    setExaApiKey(key: string) {
        this.exaApiKey = key;
        this.saveSettings();
    }

    setBochaApiKey(key: string) {
        this.bochaApiKey = key;
        this.saveSettings();
    }

    setFilteredDomains(domains: string[]) {
        this.filteredDomains = domains;
        this.saveSettings();
    }

    addFilteredDomain(domain: string) {
        if (!this.filteredDomains.includes(domain)) {
            this.filteredDomains.push(domain);
            this.saveSettings();
        }
    }

    removeFilteredDomain(domain: string) {
        this.filteredDomains = this.filteredDomains.filter((d) => d !== domain);
        this.saveSettings();
    }
}

const settingStore = new SettingStore();
export default settingStore;
