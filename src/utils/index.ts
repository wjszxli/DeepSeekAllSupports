import type { Model, Provider, WebsiteMetadata, ConfigModelType } from '@/types';
import llmStore from '@/store/llm';

import { CHAT_BOX_ID, CHAT_BUTTON_ID, PROVIDERS_DATA, FLOATING_CHAT_BUTTON_ID } from './constant';
import storage from './storage';

export * from './logger';
export * from './i18n';

// 延迟创建Logger实例，避免循环依赖
let logger: any = {
    info: (msg: string, ...args: any[]) => console.log(`[utils] ${msg}`, ...args),
    error: (msg: string, ...args: any[]) => console.error(`[utils] ${msg}`, ...args),
    warn: (msg: string, ...args: any[]) => console.warn(`[utils] ${msg}`, ...args),
    debug: (msg: string, ...args: any[]) => console.debug(`[utils] ${msg}`, ...args),
};

// 异步初始化真正的Logger
(async () => {
    try {
        const { Logger } = await import('./logger');
        logger = new Logger('utils');
    } catch (error) {
        console.error('Failed to initialize logger in utils:', error);
    }
})();

// 移除按钮
export const removeChatButton = async () => {
    const chatButton = document.getElementById(CHAT_BUTTON_ID);
    if (chatButton) chatButton.remove();
};

export const removeChatBox = async () => {
    const chatBox = document.getElementById(CHAT_BOX_ID);
    if (chatBox) chatBox.remove();
    await storage.remove('chatHistory');
    // @ts-ignore
    if (window.currentAbortController) {
        // @ts-ignore
        window.currentAbortController.abort();
        // @ts-expect-error
        window.currentAbortController = null;
    }
};

export const removeFloatingChatButton = async () => {
    const floatingButton = document.getElementById(FLOATING_CHAT_BUTTON_ID);
    if (floatingButton) floatingButton.remove();
};

/**
 * Extract website metadata from the current page
 * @returns Promise resolving to website metadata
 */
export async function extractWebsiteMetadata(): Promise<WebsiteMetadata> {
    try {
        // 检查当前执行环境
        const isContentScript = typeof window !== 'undefined' && window.location;
        const isExtensionContext = typeof chrome !== 'undefined' && chrome.runtime && chrome.tabs;

        if (isContentScript) {
            // 在 content script 环境中直接提取当前页面内容
            return extractCurrentPageContent();
        } else if (isExtensionContext) {
            // 在扩展环境中使用 chrome API
            return extractFromActiveTab();
        } else {
            throw new Error('Unsupported execution environment');
        }
    } catch (error) {
        logger.error('Error extracting website metadata:', { error });
        return {
            system: {
                language: 'en',
            },
            website: {
                url: 'about:blank',
                origin: 'about:blank',
                title: 'Unknown page',
                content: 'Failed to extract page content',
                type: 'html',
                selection: '',
            },
            id: '0',
        };
    }
}

/**
 * 在 content script 环境中直接提取当前页面内容
 */
function extractCurrentPageContent(): WebsiteMetadata {
    try {
        const extractContent = () => {
            const selectors = [
                'main',
                'article',
                '[role="main"]',
                '#main-content',
                '.main-content',
                '#main',
                '.main',
                '#content',
                '.content',
            ].join(', ');

            const mainElements = document.querySelectorAll(selectors);
            let contentText = '';

            if (mainElements.length > 0) {
                mainElements.forEach((element) => {
                    contentText += `${(element as HTMLElement).innerText || ''} `;
                });
            } else {
                contentText = document.body.innerText || '';
            }

            return contentText;
        };

        const content = extractContent().replace(/\s+/g, ' ').trim();
        const language = navigator.language || 'en-US';

        return {
            system: {
                language: language,
            },
            website: {
                url: document.location.href,
                origin: document.location.origin,
                title: document.title,
                content: content.slice(0, 15000),
                type: 'html',
                selection: window.getSelection()?.toString() || '',
                language: language,
            },
            id: Date.now().toString(), // 使用时间戳作为 ID
        };
    } catch (error) {
        console.error('Error extracting current page content:', error);
        throw error;
    }
}

/**
 * 在扩展环境中使用 chrome API 提取活动标签页内容
 */
async function extractFromActiveTab(): Promise<WebsiteMetadata> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
        throw new Error('No active tab found');
    }

    const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            try {
                const extractContent = () => {
                    const selectors = [
                        'main',
                        'article',
                        '[role="main"]',
                        '#main-content',
                        '.main-content',
                        '#main',
                        '.main',
                        '#content',
                        '.content',
                    ].join(', ');

                    const mainElements = document.querySelectorAll(selectors);
                    let contentText = '';

                    if (mainElements.length > 0) {
                        mainElements.forEach((element) => {
                            contentText += `${(element as HTMLElement).innerText || ''} `;
                        });
                    } else {
                        contentText = document.body.innerText || '';
                    }

                    return contentText;
                };

                const content = extractContent().replace(/\s+/g, ' ').trim();
                const language = navigator.language || 'en-US';

                return {
                    url: document.location.href,
                    origin: document.location.origin,
                    title: document.title,
                    content: content.slice(0, 15000),
                    type: 'html',
                    selection: window.getSelection()?.toString() || '',
                    language: language,
                };
            } catch (error) {
                console.error('Error extracting webpage content:', error);
                return {
                    url: document.location.href,
                    origin: document.location.origin,
                    title: document.title || 'Unknown page',
                    content: 'Failed to extract page content',
                    type: 'html',
                    selection: '',
                    hash: '0',
                };
            }
        },
    });

    if (!result || !result[0] || !result[0].result) {
        throw new Error('Failed to extract webpage content');
    }

    const extractedData = result[0].result;
    const language = extractedData.language || 'en';

    return {
        system: {
            language: language,
        },
        website: extractedData,
        id: tab.id.toString(),
    };
}

export const getModelGroupOptions = (models: Model[] = []) => {
    const groupMap: Record<string, any[]> = {};
    models.forEach((model) => {
        const group = model.group || 'Other';
        if (!groupMap[group]) groupMap[group] = [];
        groupMap[group].push({ label: model.name, value: model.id });
    });

    const sortedGroups = Object.keys(groupMap).sort((a, b) => {
        const aFree = a.includes('Free');
        const bFree = b.includes('Free');
        if (aFree && !bFree) return -1;
        if (!aFree && bFree) return 1;
        return a.localeCompare(b);
    });

    return sortedGroups.map((group) => ({
        label: group,
        options: groupMap[group],
    }));
};

/**
 * 获取特定界面类型的模型
 *
 * 根据界面类型（聊天、弹窗、侧边栏）获取相应的模型。
 * 如果特定界面类型没有设置模型，会按照以下顺序回退：
 * 1. 指定界面类型的模型
 * 2. 聊天界面的模型
 * 3. 默认模型
 *
 * @example
 * // 在聊天界面获取模型
 * const chatModel = getModelForInterface(ConfigModelType.CHAT);
 *
 * // 在弹窗界面获取模型
 * const popupModel = getModelForInterface(ConfigModelType.POPUP);
 *
 * @param type 界面类型
 * @returns 对应界面类型的模型
 */
export function getModelForInterface(type: ConfigModelType) {
    return llmStore.getModelForType(type);
}

/**
 * Navigate to settings page
 * Handles both Chrome extension and web environments
 */
export const navigateToSettings = () => {
    try {
        // 优先使用 Chrome 扩展标准的 openOptionsPage，它在 popup / content script / sidepanel 都可用
        if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
            chrome.runtime.openOptionsPage(() => {
                const error = chrome.runtime.lastError;
                if (error) {
                    console.error('Failed to open options page:', error);
                    // fallback: 直接在新标签页打开 options.html
                    openOptionsPageInNewTab();
                }
            });
            return;
        }

        // 如果 openOptionsPage 不可用（例如非扩展环境），尝试直接打开 options.html
        openOptionsPageInNewTab();
    } catch (error) {
        console.error('Failed to navigate to settings:', error);
    }
};

const openOptionsPageInNewTab = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        const optionsUrl = chrome.runtime.getURL('options.html');

        // 在 background / service worker 中可使用 tabs.create；content script 中 tabs.create 不可用，会静默失败
        if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
            try {
                chrome.tabs.create({ url: optionsUrl }, (tab) => {
                    if (chrome.runtime.lastError) {
                        console.error('Failed to create options tab:', chrome.runtime.lastError);
                        windowOpenOptions(optionsUrl);
                    } else if (!tab) {
                        windowOpenOptions(optionsUrl);
                    }
                });
                return;
            } catch (error) {
                console.error('chrome.tabs.create failed:', error);
            }
        }

        windowOpenOptions(optionsUrl);
    } else if (typeof window !== 'undefined') {
        // 纯网页环境
        if (window.location.hash) {
            window.location.hash = '#/settings';
        } else {
            window.location.href = '/options.html';
        }
    }
};

const windowOpenOptions = (url: string) => {
    if (typeof window !== 'undefined' && window.open) {
        window.open(url, '_blank');
    }
};

/**
 * 判断指定的 provider 是否需要 API Key
 * @param provider Provider对象或provider ID字符串
 * @param providers 可选的providers配置对象
 * @returns boolean 是否需要API Key
 */
export const requiresApiKey = (
    provider: Provider | string,
    providers?: Record<string, any>,
): boolean => {
    let providerConfig: any;

    if (typeof provider === 'string') {
        // 如果传入的是字符串ID，从配置中查找
        providerConfig = providers?.[provider] || PROVIDERS_DATA[provider];
    } else {
        // 如果传入的是Provider对象，直接使用
        providerConfig = provider;
    }

    // 默认需要API Key，除非明确设置为false
    return providerConfig?.requiresApiKey !== false;
};

export const mapLegacyNameToId = (name: string): string | null => {
    switch (name) {
        case 'DeepSeek':
            return 'deepseek';
        case 'SiliconFlow':
            return 'silicon';
        case 'Ollama':
            return 'ollama';
        case 'Aliyun':
            return 'dashscope';
        case 'Baidu':
            return 'baidu-cloud';
        case 'Tencent':
            return 'tencent-cloud-ti';
        default:
            return null;
    }
};
