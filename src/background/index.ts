import type { OllamaResponse } from '@/types';
import { fetchData, handleMessage, initLogger, Logger, requiresApiKey } from '@/utils';
import { MODIFY_HEADERS_RULE_ID, PROVIDERS_DATA } from '@/utils/constant';
import storage from '@/utils/storage';

import { fetchWebPage, searchWeb } from './search';

// Initialize logger
const logger = new Logger('background');
initLogger().then((config) => {
    logger.info('Logger initialized with config', config);
});

chrome.declarativeNetRequest.updateDynamicRules(
    {
        addRules: [
            {
                id: MODIFY_HEADERS_RULE_ID, // 规则 ID
                priority: 1,
                action: {
                    // @ts-ignore
                    type: 'modifyHeaders',
                    // @ts-ignore
                    requestHeaders: [
                        {
                            header: 'Origin',
                            // @ts-ignore
                            operation: 'set',
                            value: PROVIDERS_DATA.Ollama.apiHost,
                        },
                    ],
                },
                condition: {
                    urlFilter: `${PROVIDERS_DATA.Ollama.apiHost}/*`,
                    // @ts-ignore
                    resourceTypes: ['xmlhttprequest'],
                },
            },
        ],
        removeRuleIds: [MODIFY_HEADERS_RULE_ID], // 先删除旧规则，防止重复
    },
    () => {
        if (chrome.runtime.lastError) {
            logger.error('更新规则失败:', chrome.runtime.lastError);
        } else {
            logger.info('规则更新成功！');
        }
    },
);

const requestControllers = new Map();

// 监听 `popup.ts` 或 `content.ts` 发送的消息，并代理 API 请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    logger.debug('Message received', { action: request.action, sender });

    // Handle provider settings updates
    if (request.action === 'providerSettingsUpdated') {
        logger.info('Provider settings updated, broadcasting to all tabs', request.provider);

        // 强制更新存储中的数据
        storage.getConfig().then((config) => {
            logger.info('Current config:', config);

            // 确保所有存储都已更新
            storage.getSelectedProvider().then((provider) => {
                logger.info('Selected provider:', provider);

                // 广播到所有标签页
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach((tab) => {
                        if (tab.id) {
                            chrome.tabs
                                .sendMessage(tab.id, {
                                    action: 'providerSettingsUpdated',
                                    provider: request.provider,
                                    timestamp: Date.now(), // 添加时间戳以确保消息唯一性
                                })
                                .catch(() => {
                                    // 忽略无法接收消息的标签页的错误
                                });
                        }
                    });
                });

                // 通知 popup 和 options 页面
                chrome.runtime
                    .sendMessage({
                        action: 'providerSettingsUpdated',
                        provider: request.provider,
                        timestamp: Date.now(),
                    })
                    .catch(() => {
                        // 忽略错误
                    });

                sendResponse({ success: true });
            });
        });

        return true;
    }

    if (request.action === 'fetchData') {
        const controller = new AbortController();
        const tabId = sender?.tab?.id;

        if (tabId) {
            requestControllers.set(tabId, controller);
            logger.debug('Request controller set for tab', { tabId });
        }

        logger.info('Sending API request', { url: request.url, method: request.method });

        fetchData({
            url: request.url,
            method: request.method,
            headers: request.headers,
            body: request.body,
            onStream: (chunk) => {
                storage.getConfig().then(async (config) => {
                    const { selectedProvider, providers } = config;
                    if (!selectedProvider) return;

                    if (!requiresApiKey(selectedProvider, providers)) {
                        try {
                            const data: OllamaResponse = JSON.parse(chunk);
                            const {
                                message: { content },
                                done,
                            } = data;
                            if (done && tabId) {
                                chrome.tabs.sendMessage(tabId, {
                                    type: 'streamResponse',
                                    response: { data: 'data: [DONE]\n\n', ok: true, done: true },
                                });
                            } else if (content && tabId) {
                                chrome.tabs.sendMessage(tabId, {
                                    type: 'streamResponse',
                                    response: { data: content, ok: true, done: false },
                                });
                            }
                        } catch (error) {
                            logger.error('streamResponse error', error);
                            logger.debug('tabId', tabId);
                            sendResponse({ ok: false, error });
                            if (tabId) {
                                chrome.tabs.sendMessage(tabId, {
                                    type: 'streamResponse',
                                    response: { data: 'data: [DONE]\n\n', ok: false, done: true },
                                });
                            }
                        }
                    } else if (tabId) {
                        handleMessage(chunk, { tab: { id: tabId } });
                    }
                });
            },
            controller,
        })
            .then((response) => {
                if (!request.body.includes('"stream":true')) {
                    sendResponse(response);
                }
            })
            .catch((error) => {
                if (tabId) {
                    requestControllers.delete(tabId);
                }
                sendResponse({ ok: false, error: error.message });
            })
            .finally(() => {
                if (tabId) {
                    requestControllers.delete(tabId);
                }
            });

        return true;
    }

    if (request.action === 'performSearch') {
        logger.info('📡 处理搜索请求:', request.query);
        searchWeb(request.query)
            .then((results) => {
                sendResponse({ success: true, results });
            })
            .catch((error) => {
                logger.error('搜索处理失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // 确保异步 sendResponse 可以工作
    }

    if (request.action === 'fetchWebContent') {
        logger.info('📡 处理网页内容获取请求:', request.url);
        fetchWebPage(request.url)
            .then((content) => {
                // Return the content without parsing for thinking parts
                sendResponse({
                    success: true,
                    content: content,
                });
            })
            .catch((error: any) => {
                logger.error('网页内容获取失败:', error);
                sendResponse({ success: false, error: error.message || 'Unknown error' });
            });
        return true; // 确保异步 sendResponse 可以工作
    }

    if (request.action === 'abortRequest') {
        const tabId = sender?.tab?.id;
        logger.info('Aborting request', { tabId });
        logger.info('🚫 中止请求', tabId);
        if (tabId) {
            const controller = requestControllers.get(tabId);
            if (controller) {
                controller.abort();
                requestControllers.delete(tabId);
                sendResponse({ success: true });
            }
        } else {
            sendResponse({ success: false, error: 'No active request to abort' });
        }
        return true;
    }

    if (request.action === 'getStorage') {
        storage.get(request.key).then((value) => sendResponse({ value }));
        return true; // 确保 sendResponse 可异步返回
    }

    if (request.action === 'setStorage') {
        storage.set(request.key, request.value).then(() => sendResponse({ success: true }));
        return true;
    }

    return false; // 没有匹配到任务
});

chrome.runtime.onInstalled.addListener((details) => {
    chrome.contextMenus.create({
        id: 'openChatWindow',
        title: '打开 AI 窗口聊天',
        contexts: ['page', 'selection', 'image', 'link'],
    });

    chrome.contextMenus.create({
        id: 'summarizeCurrentPage',
        title: '总结当前页面',
        contexts: ['page', 'selection', 'image', 'link'],
    });

    chrome.sidePanel.setOptions({
        enabled: false,
    });

    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        // 打开说明页面
        chrome.tabs.create({
            url: chrome.runtime.getURL('/install.html'),
        });
    }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'openChatWindow' && tab?.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, {
            action: 'openChatWindow',
            selectedText: info.selectionText || '',
        });
    }

    if (info.menuItemId === 'summarizeCurrentPage' && tab?.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, {
            action: 'summarizeCurrentPage',
        });
    }
});

chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'open-chat') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) {
            return;
        }
        try {
            if (tab.id !== undefined) {
                const [{ result }] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        const selection = window.getSelection();
                        return selection ? selection.toString() : '';
                    },
                });

                chrome.tabs.sendMessage(tab.id, {
                    action: 'openChatWindow',
                    selectedText: result || null,
                });
            }
        } catch {
            if (tab.id !== undefined) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'openChatWindow',
                    selectedText: null,
                });
            }
        }
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, _info, tab) => {
    if (!tab.url) return;

    await chrome.sidePanel.setOptions({
        tabId,
        enabled: false,
    });
});
