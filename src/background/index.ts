import { initLogger, Logger } from '@/utils';
import { MODIFY_HEADERS_RULE_ID, PROVIDERS_DATA } from '@/utils/constant';
import storage from '@/utils/storage';

const logger = new Logger('background');

initLogger().then((config) => {
    logger.info('Logger initialized with config', config);
});

// 修改请求头
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
