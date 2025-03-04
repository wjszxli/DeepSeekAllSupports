import type { OllamaResponse, SearchResult } from '@/typings';
import { fetchData, handleMessage, isLocalhost } from '@/utils';
import { MODIFY_HEADERS_RULE_ID, URL_MAP } from '@/utils/constant';
import storage from '@/utils/storage';
import { load } from 'cheerio';

// 专门用于网页搜索的函数
async function searchWeb(query: string): Promise<SearchResult[]> {
    try {
        console.log('执行百度搜索:', query);

        // 使用百度搜索
        const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
        });

        if (!response.ok) {
            throw new Error(`百度搜索请求失败，状态码: ${response.status}`);
        }

        const html = await response.text();

        // 使用cheerio解析百度搜索结果HTML
        const $ = load(html);
        const results: SearchResult[] = [];

        // 百度搜索结果通常在带有特定class的div中
        // 注意：百度可能会更改其HTML结构，以下选择器可能需要根据实际情况调整
        $('.result, .c-container').each((i, element) => {
            if (i >= 5) return false; // 只获取前5个结果

            const titleElement = $(element).find('.t, .c-title');
            const title = titleElement.text().trim();

            // 获取链接（百度使用重定向链接）
            let link = titleElement.find('a').attr('href') || '';

            // 获取摘要
            const snippet = $(element).find('.c-abstract, .content-abstract').text().trim();

            // Only add result when title and link exist
            if (title && link) {
                results.push({
                    title,
                    link,
                    snippet,
                });
            }

            // Return true to continue iteration
            return true;
        });

        if (results.length === 0) {
            console.log('未能从百度搜索结果中提取数据，可能选择器需要更新');
        }

        return results;
    } catch (error: any) {
        console.error('百度搜索失败:', error);
        // 搜索失败时返回空数组
        return [];
    }
}

// 专门用于获取网页内容的函数
async function fetchWebPage(url: string): Promise<string> {
    try {
        console.log('获取网页内容:', url);

        // 处理百度重定向链接
        let targetUrl = url;

        // 如果是百度重定向链接，需要获取真实URL
        if (
            url.startsWith('http://www.baidu.com/link?') ||
            url.startsWith('https://www.baidu.com/link?')
        ) {
            console.log('检测到百度重定向链接，获取真实URL');

            try {
                const redirectResponse = await fetch(url, {
                    method: 'GET',
                    redirect: 'manual', // 不自动跟随重定向，以便我们获取Location头
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                    },
                });

                // 检查是否是重定向响应
                if (redirectResponse.status === 302 || redirectResponse.status === 301) {
                    const location = redirectResponse.headers.get('Location');
                    if (location) {
                        targetUrl = location;
                        console.log('获取到真实URL:', targetUrl);
                    }
                }
            } catch (redirectError) {
                console.error('解析百度重定向链接失败:', redirectError);
                // 如果失败，继续使用原始URL
            }
        }

        // 创建一个请求，使用合适的User-Agent以模拟浏览器
        const contentResponse = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
        });

        if (!contentResponse.ok) {
            throw new Error(
                `Failed to fetch page: ${contentResponse.status} ${contentResponse.statusText}`,
            );
        }

        const html = await contentResponse.text();

        // 使用cheerio解析HTML
        const $ = load(html);

        // 移除不需要的元素
        $('script, style, meta, link, noscript, svg, iframe, img').remove();

        // 获取标题
        const title = $('title').text().trim();

        // 获取正文内容，规范化空白
        const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

        // 限制内容长度
        const maxContentLength = 5000;
        let content =
            bodyText.length > maxContentLength
                ? bodyText.substring(0, maxContentLength) + '...'
                : bodyText;

        return `${title}\n\n${content}`;
    } catch (error: any) {
        console.error('Failed to fetch web content:', error);
        return `Error fetching content from ${url}: ${error.message || 'Unknown error'}`;
    }
}

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
                        // @ts-ignore
                        { header: 'Origin', operation: 'set', value: URL_MAP.Ollama },
                    ],
                },
                condition: {
                    urlFilter: `${URL_MAP.Ollama}/*`,
                    // @ts-ignore
                    resourceTypes: ['xmlhttprequest'],
                },
            },
        ],
        removeRuleIds: [MODIFY_HEADERS_RULE_ID], // 先删除旧规则，防止重复
    },
    () => {
        if (chrome.runtime.lastError) {
            console.error('更新规则失败:', chrome.runtime.lastError);
        } else {
            console.log('规则更新成功！');
        }
    },
);

const requestControllers = new Map();

// 监听 `popup.ts` 或 `content.ts` 发送的消息，并代理 API 请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchData') {
        const controller = new AbortController();

        if (sender?.tab?.id) {
            requestControllers.set(sender.tab.id, controller);
        }

        console.log('📡 发送请求:', request.body);

        fetchData({
            url: request.url,
            method: request.method,
            headers: request.headers,
            body: request.body,
            onStream: (chunk) => {
                storage.getConfig().then((config) => {
                    const { selectedProvider } = config;
                    if (isLocalhost(selectedProvider)) {
                        try {
                            const data: OllamaResponse = JSON.parse(chunk);
                            const {
                                message: { content },
                                done,
                            } = data;
                            if (done && sender?.tab?.id) {
                                chrome.tabs.sendMessage(sender.tab.id, {
                                    type: 'streamResponse',
                                    response: { data: 'data: [DONE]\n\n', ok: true, done: true },
                                });
                            } else if (content && sender?.tab?.id) {
                                chrome.tabs.sendMessage(sender.tab.id, {
                                    type: 'streamResponse',
                                    response: { data: content, ok: true, done: false },
                                });
                            }
                        } catch (error) {
                            sendResponse({ ok: false, error });
                            if (sender?.tab?.id) {
                                chrome.tabs.sendMessage(sender.tab.id, {
                                    type: 'streamResponse',
                                    response: { data: 'data: [DONE]\n\n', ok: false, done: true },
                                });
                            }
                        }
                    } else if (sender?.tab?.id) {
                        handleMessage(chunk, { tab: { id: sender.tab.id } });
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
                if (sender?.tab?.id) {
                    requestControllers.delete(sender.tab.id);
                }
                sendResponse({ ok: false, error: error.message });
            })
            .finally(() => {
                if (sender?.tab?.id) {
                    requestControllers.delete(sender.tab.id);
                }
            });

        return true;
    }

    if (request.action === 'performSearch') {
        console.log('📡 处理搜索请求:', request.query);
        searchWeb(request.query)
            .then((results) => {
                sendResponse({ success: true, results });
            })
            .catch((error) => {
                console.error('搜索处理失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // 确保异步 sendResponse 可以工作
    }

    if (request.action === 'fetchWebContent') {
        console.log('📡 处理网页内容获取请求:', request.url);
        fetchWebPage(request.url)
            .then((content) => {
                // Return the content without parsing for thinking parts
                sendResponse({
                    success: true,
                    content: content,
                });
            })
            .catch((error: any) => {
                console.error('网页内容获取失败:', error);
                sendResponse({ success: false, error: error.message || 'Unknown error' });
            });
        return true; // 确保异步 sendResponse 可以工作
    }

    if (request.action === 'abortRequest') {
        console.log('🚫 中止请求', sender?.tab?.id);
        if (sender?.tab?.id) {
            const controller = requestControllers.get(sender.tab.id);
            if (controller) {
                controller.abort();
                requestControllers.delete(sender.tab.id);
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
