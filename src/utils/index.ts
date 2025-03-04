import type { RequestMethod } from '@/typings';

import { CHAT_BOX_ID, CHAT_BUTTON_ID, URL_MAP } from './constant';
import storage from './storage';

// 通用 Fetch 封装，支持流式响应
export const fetchData = async ({
    url,
    method = 'POST',
    body,
    headers = {},
    timeout = 100000,
    onStream,
    controller,
}: {
    url: string;
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    timeout?: number;
    onStream?: (chunk: string) => void;
    controller: AbortController;
}): Promise<{ status: number; ok: boolean; data: any }> => {
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const { selectedProvider } = await storage.getConfig();
    if (!selectedProvider) {
        throw new Error('请先选择服务商');
    }

    const apiKey = await storage.getApiKey(selectedProvider);
    if (!apiKey && !isLocalhost(selectedProvider)) {
        throw new Error('请输入 API Key');
    }

    const base_url = URL_MAP[selectedProvider as keyof typeof URL_MAP];
    if (!base_url) {
        throw new Error(`未找到 ${selectedProvider} 的基础 URL`);
    }

    try {
        const config: RequestInit = {
            method,
            body,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                ...headers,
            },
            signal: controller.signal,
        };

        if (isLocalhost(selectedProvider)) {
            delete (config.headers as Record<string, string>).Authorization;
        }

        if (method === 'GET' || method === 'HEAD') {
            delete config.body;
        }

        const response = await fetch(base_url + url, config);

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        if (body && body.includes('"stream":true') && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                onStream?.(chunk);
            }
            return { status: response.status, ok: response.ok, data: {} };
        } else {
            const data = await response.json();
            return { status: response.status, ok: response.ok, data };
        }
    } catch (error) {
        console.error('fetchData 错误:', error);
        throw error;
    }
};

export const requestAIStream = async (
    url: string,
    method: RequestMethod = 'GET',
    requestBody: object,
    onData: (chunk: { data: string; done: boolean }) => void,
) => {
    return new Promise<void>((resolve, reject) => {
        const listener = (msg: any) => {
            if (msg.type === 'streamResponse') {
                if (msg.response.done) {
                    // 发送最后一次数据
                    onData(msg.response);
                    chrome.runtime.onMessage.removeListener(listener);
                    resolve();
                } else if (msg.response.ok) {
                    onData(msg.response);
                } else {
                    reject(new Error(msg.response.error));
                }
            }
        };

        chrome.runtime.onMessage.addListener(listener);

        const controller = new AbortController();
        // @ts-ignore
        window.currentAbortController = controller;
        // @ts-ignore
        window.currentAbortController.signal.addEventListener('abort', () => {
            chrome.runtime.sendMessage({ action: 'abortRequest' });
        });

        chrome.runtime.sendMessage(
            {
                action: 'fetchData',
                url,
                method,
                body: JSON.stringify({ ...requestBody, stream: true }), // 启用流式模式
            },
            () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError.message);
                }
            },
        );

        window.currentAbortController.signal.addEventListener('abort', () => {
            console.log('🚫 中止请求.......');
            onData({ data: '', done: true });
            chrome.runtime.onMessage.removeListener(listener);
            resolve();
        });
    });
};

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
                console.log('API 响应:', response);
                if (response.status === 200) {
                    resolve(response.data);
                } else {
                    console.error('API 请求失败:', response.error);
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
    await storage.remove('chatHistory');
    // @ts-ignore
    if (window.currentAbortController) {
        // @ts-ignore
        window.currentAbortController.abort();
        // @ts-expect-error
        window.currentAbortController = null;
    }
};

export const isLocalhost = (selectedProvider: string | null) => {
    return selectedProvider === 'Ollama';
};

export const handleMessage = (message: string, sender: { tab: { id: number } }) => {
    const lines = message.split('\n');

    for (const line of lines) {
        if (line.trim() === '' || !line.startsWith('data: ')) continue;

        const data = line.slice(6);
        if (sender?.tab?.id) {
            if (data === '[DONE]') {
                chrome.tabs.sendMessage(sender.tab.id, {
                    type: 'streamResponse',
                    response: { data: '', ok: true, done: true },
                });
                break;
            } else {
                chrome.tabs.sendMessage(sender.tab.id, {
                    type: 'streamResponse',
                    response: { data: line, ok: true, done: false },
                });
            }
        }
    }
};

// 解析模型响应中的思考和回复部分
export const parseModelResponse = (content: string): { thinking: string; response: string } => {
    // 检查是否为JSON格式的响应，包含reasoning_content字段
    try {
        // 尝试解析JSON
        if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
            const jsonData = JSON.parse(content);
            if (jsonData.reasoning_content && typeof jsonData.content === 'string') {
                // 返回推理内容和实际响应
                return {
                    thinking: jsonData.reasoning_content.trim(),
                    response: jsonData.content.trim(),
                };
            }
        }
    } catch (e) {
        // 不是合法的JSON或者没有预期字段，继续处理为<think>标签
    }

    // 处理使用<think>标签的情况
    // 使用正则表达式匹配所有 <think>...</think> 标签
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
    let match;
    let thinking = '';

    // 创建内容的副本，用于移除思考部分
    let processedContent = content;

    // 收集所有的思考内容
    const matches = [];
    while ((match = thinkRegex.exec(content)) !== null) {
        matches.push({
            fullMatch: match[0],
            thinkingContent: match[1].trim(),
            index: match.index,
        });
    }

    // 按照索引排序，确保按正确的顺序处理
    matches.sort((a, b) => a.index - b.index);

    // 收集思考内容并从响应中移除
    for (const match of matches) {
        // 如果已经有思考内容，添加分隔符
        if (thinking) {
            thinking += '\n\n';
        }
        thinking += match.thinkingContent;

        // 从响应中移除思考部分
        processedContent = processedContent.replace(match.fullMatch, '');
    }

    // 清理响应中可能存在的多余空行和前后空白
    const response = processedContent.trim().replace(/\n{3,}/g, '\n\n');

    return { thinking, response };
};
