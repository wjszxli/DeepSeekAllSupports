import type { Model, RequestMethod, WebsiteMetadata } from '@/types';
import { ConfigModelType } from '@/types';
import llmStore from '@/store/llm';

import { CHAT_BOX_ID, CHAT_BUTTON_ID } from './constant';
import { Logger } from './logger';

export * from './logger';
export * from './i18n';

// Create a logger for this module
const logger = new Logger('utils');

export const requestApi = (url: string, method: RequestMethod = 'GET', requestBody?: any) => {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            {
                action: 'fetchData',
                url,
                method,
                body: JSON.stringify({ ...requestBody, stream: false }),
            },
            (response) => {
                logger.info('API response:', { response });
                if (response.status === 200) {
                    resolve(response.data);
                } else {
                    logger.error('API request failed:', { error: response.error });
                    reject(response.error);
                }
            },
        );
    });
};

// 移除按钮
export const removeChatButton = async () => {
    const chatButton = document.getElementById(CHAT_BUTTON_ID);
    if (chatButton) chatButton.remove();
};

export const removeChatBox = async () => {
    const chatBox = document.getElementById(CHAT_BOX_ID);
    if (chatBox) chatBox.remove();
};

export const isLocalhost = (selectedProvider: string | null) => {
    // Check for specific providers that are known to be localhost or don't require API key
    return (
        selectedProvider === 'Ollama' ||
        selectedProvider === 'ollama' ||
        selectedProvider === 'lmstudio'
    );
};

/**
 * Extract website metadata from the current page
 * @returns Promise resolving to website metadata
 */
export async function extractWebsiteMetadata(): Promise<WebsiteMetadata> {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) {
            throw new Error('No active tab found');
        }

        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                try {
                    const extractContent = () => {
                        const mainElements = document.querySelectorAll(
                            'main, article, [role="main"]',
                        );
                        let contentText = '';

                        if (mainElements.length > 0) {
                            mainElements.forEach((element) => {
                                contentText += `${(element as HTMLElement).textContent}`;
                            });
                        } else {
                            contentText = document.body.textContent || '';
                        }

                        return contentText;
                    };

                    const content = extractContent().replace(/\n/g, '');
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
                    // We can't use our logger here because this code runs in the browser context
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

export const getDefaultGroupName = (id: string, provider?: string) => {
    const str = id.toLowerCase();

    // 定义分隔符
    let firstDelimiters = ['/', ' ', ':'];
    let secondDelimiters = ['-', '_'];

    if (
        provider &&
        ['aihubmix', 'silicon', 'ocoolai', 'o3', 'dmxapi'].includes(provider.toLowerCase())
    ) {
        firstDelimiters = ['/', ' ', '-', '_', ':'];
        secondDelimiters = [];
    }

    // 第一类分隔规则
    for (const delimiter of firstDelimiters) {
        if (str.includes(delimiter)) {
            return str.split(delimiter)[0];
        }
    }

    // 第二类分隔规则
    for (const delimiter of secondDelimiters) {
        if (str.includes(delimiter)) {
            const parts = str.split(delimiter);
            return parts.length > 1 ? parts[0] + '-' + parts[1] : parts[0];
        }
    }

    return str;
};

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
