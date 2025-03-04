import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { Button, Input, message as messageNotification, Typography } from 'antd';
import {
    SendOutlined,
    LinkOutlined,
    CloseOutlined,
    CopyOutlined,
    RedoOutlined,
} from '@ant-design/icons';
import { sendMessage, sendMessageWithWebpageContext } from '@/services/chatService';
import { md } from '@/utils/markdownRenderer';
import './index.scss';
import './promptSuggestions.css';
import type { TranslationKey } from '@/contexts/LanguageContext';
import { useLanguage } from '@/contexts/LanguageContext';
import WebSearchToggle from '../WebSearchToggle';
import storage from '@/utils/storage';
import { useStableCallback, useThrottledCallback } from '@/utils/reactOptimizations';
import { LRUCache } from '@/utils/memoryOptimization';
import { performSearch, fetchWebContent } from '@/services/localChatService';
import { parseModelResponse } from '@/utils';

interface ChatMessage {
    id: number;
    text: string;
    sender: 'user' | 'ai' | 'system';
    isThinking?: boolean;
}

interface Prompt {
    key: string;
    name: string;
    content: string;
}

interface ChatInterfaceProps {
    initialText?: string;
}

interface MessageBubbleProps {
    message: ChatMessage;
    isStreaming: boolean;
    t: (key: TranslationKey) => string;
    copyToClipboard: (text: string) => void;
    regenerateResponse: () => void;
}

interface EmptyChatProps {
    t: (key: TranslationKey) => string;
    handleExampleClick: (text: string) => void;
}

interface ThinkingIndicatorProps {
    t: (key: TranslationKey) => string;
}

const markdownCache = new LRUCache<string, string>(50);

const MessageBubble = memo(
    ({ message, isStreaming, t, copyToClipboard, regenerateResponse }: MessageBubbleProps) => {
        const handleCopy = useCallback(() => {
            const { response } = parseModelResponse(message.text);
            copyToClipboard(response);
        }, [copyToClipboard, message.text, message.sender]);

        // 解析消息中的思考部分和回复部分
        const { thinking, response } = useMemo(() => {
            // 只处理AI消息
            if (message.sender === 'ai') {
                return parseModelResponse(message.text);
            }
            // 对于用户消息，不进行解析
            return { thinking: '', response: message.text };
        }, [message.text, message.sender]);

        // 渲染消息内容
        const renderMessageContent = useCallback(() => {
            if (message.sender === 'ai') {
                // 先检查是否有思考部分
                if (thinking) {
                    // 为了防止缓存混淆，生成唯一的缓存键
                    const thinkingHash =
                        thinking.length + '-' + thinking.substr(0, 20).replace(/\s/g, '');
                    const responseHash =
                        response.length + '-' + response.substr(0, 20).replace(/\s/g, '');

                    const thinkingCacheKey = `thinking-${message.id}-${thinkingHash}`;
                    const responseCacheKey = `response-${message.id}-${responseHash}`;

                    let thinkingHtml = markdownCache.get(thinkingCacheKey);
                    let responseHtml = markdownCache.get(responseCacheKey);

                    if (!thinkingHtml) {
                        const thinkingDiv = document.createElement('div');
                        thinkingDiv.innerHTML = md.render(thinking || '');
                        thinkingHtml = thinkingDiv.innerHTML;
                        markdownCache.set(thinkingCacheKey, thinkingHtml);
                    }

                    if (!responseHtml) {
                        const responseDiv = document.createElement('div');
                        responseDiv.innerHTML = md.render(response || '');
                        responseHtml = responseDiv.innerHTML;
                        markdownCache.set(responseCacheKey, responseHtml);
                    }

                    return (
                        <>
                            <div className="thinking-container">
                                <div className="thinking-header">
                                    <span className="thinking-label">
                                        {t('thinking') || '已深思熟虑'}
                                    </span>
                                </div>
                                <div
                                    className="thinking-content"
                                    dangerouslySetInnerHTML={{ __html: thinkingHtml }}
                                />
                            </div>
                            {response && (
                                <div
                                    className={`message-content ${isStreaming ? 'streaming' : ''}`}
                                    dangerouslySetInnerHTML={{ __html: responseHtml }}
                                />
                            )}
                        </>
                    );
                }

                // 没有思考部分，只渲染响应
                // 为了防止缓存混淆，使用消息长度作为键的一部分
                const messageHash =
                    message.text.length + '-' + message.text.substr(0, 20).replace(/\s/g, '');
                const cacheKey = `message-${message.id}-${messageHash}`;
                let renderedHtml = markdownCache.get(cacheKey);

                if (!renderedHtml) {
                    // 创建一个临时 div 来解析和修改 HTML 内容
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = md.render(message.text || '');
                    renderedHtml = tempDiv.innerHTML;
                    markdownCache.set(cacheKey, renderedHtml);
                }

                return (
                    <div
                        className={`message-content ${isStreaming ? 'streaming' : ''}`}
                        dangerouslySetInnerHTML={{ __html: renderedHtml }}
                    />
                );
            } else {
                return <div className="message-content">{message.text}</div>;
            }
        }, [message, isStreaming, t, thinking, response]);

        return (
            <div
                className={`message-bubble ${message.sender} ${
                    isStreaming ? 'streaming-message' : ''
                }`}
            >
                <div className="message-header">
                    <div className="sender-name">
                        {message.sender === 'user' ? t('you') : t('assistant')}
                    </div>
                </div>
                {renderMessageContent()}

                {message.sender === 'ai' && !message.isThinking && !isStreaming && (
                    <div className="message-actions-bottom">
                        <Button
                            type="text"
                            size="small"
                            onClick={handleCopy}
                            icon={<CopyOutlined />}
                            className="action-button"
                        >
                            {t('copy')}
                        </Button>
                        <Button
                            type="text"
                            size="small"
                            onClick={regenerateResponse}
                            icon={<RedoOutlined />}
                            className="action-button"
                        >
                            {t('regenerate')}
                        </Button>
                    </div>
                )}
            </div>
        );
    },
);

const EmptyChat = memo(({ t, handleExampleClick }: EmptyChatProps) => (
    <div className="empty-chat">
        <div className="emoji">💬</div>
        <Typography.Text className="title">{t('aiAssistant')}</Typography.Text>
        <Typography.Text className="message">{t('askAnything')}</Typography.Text>
        <div className="examples">
            <div className="example" onClick={() => handleExampleClick(t('exampleSummarize'))}>
                {t('exampleSummarize')}
            </div>
            <div className="example" onClick={() => handleExampleClick(t('exampleMainPoints'))}>
                {t('exampleMainPoints')}
            </div>
            <div className="example" onClick={() => handleExampleClick(t('exampleHowToUse'))}>
                {t('exampleHowToUse')}
            </div>
        </div>
    </div>
));

const ThinkingIndicator = memo(({ t }: ThinkingIndicatorProps) => (
    <div className="message-bubble ai thinking">
        <div className="message-header">
            <div className="sender-name">{t('assistant')}</div>
        </div>
        <div className="thinking-indicator">
            {t('thinking')}
            <span className="dot-animation">
                <span className="dot">.</span>
                <span className="dot">.</span>
                <span className="dot">.</span>
            </span>
        </div>
    </div>
));

const ChatInterface = ({ initialText }: ChatInterfaceProps) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState(initialText || '');
    const [isLoading, setIsLoading] = useState(false);
    const [useWebpageContext, setUseWebpageContext] = useState(true);
    const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);
    const [showThinking, setShowThinking] = useState(true);
    const [isComposing, setIsComposing] = useState(false);
    const [showPrompts, setShowPrompts] = useState(false);
    const [filteredPrompts, setFilteredPrompts] = useState<Prompt[]>([]);
    const [selectedPromptIndex, setSelectedPromptIndex] = useState<number>(-1);
    const messagesWrapperRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguage();
    const messageIdCounter = useRef(0);

    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const previousMessagesLengthRef = useRef(0);

    const isInputEmpty = useMemo(() => inputMessage.trim() === '', [inputMessage]);
    const shouldDisableButton = useMemo(
        () => isLoading || isInputEmpty || isComposing,
        [isLoading, isInputEmpty, isComposing],
    );

    // 定义常用提示
    const commonPrompts: Prompt[] = useMemo(
        () => [
            {
                key: 'translate',
                name: t('translate' as TranslationKey),
                content: t('translatePrompt' as TranslationKey),
            },
            {
                key: 'summary',
                name: t('summarize' as TranslationKey),
                content: t('summarizePrompt' as TranslationKey),
            },
            {
                key: 'explain',
                name: t('explain' as TranslationKey),
                content: t('explainPrompt' as TranslationKey),
            },
            {
                key: 'code',
                name: t('codeReview' as TranslationKey),
                content: t('codeReviewPrompt' as TranslationKey),
            },
            {
                key: 'rewrite',
                name: t('rewrite' as TranslationKey),
                content: t('rewritePrompt' as TranslationKey),
            },
        ],
        [t],
    );

    const handlePromptSelect = useCallback((prompt: Prompt) => {
        setInputMessage(prompt.content);
        setShowPrompts(false);
        setSelectedPromptIndex(-1);
    }, []);

    // 当AI正在处理时添加一个思考消息
    useEffect(() => {
        if (isLoading && showThinking) {
            // 立即添加思考消息
            const thinkingMessage: ChatMessage = {
                id: messageIdCounter.current++,
                text: '',
                sender: 'ai',
                isThinking: true,
            };
            setMessages((prevMessages) => [...prevMessages, thinkingMessage]);
        }
    }, [isLoading, showThinking]);

    // 当响应到达或出错时删除思考消息
    useEffect(() => {
        if (!isLoading) {
            // 当加载完成时删除任何思考消息
            setMessages((prevMessages) => prevMessages.filter((msg) => !msg.isThinking));
        }
    }, [isLoading]);

    // 当消息变化时滚动到底部
    useEffect(() => {
        if (messages.length !== previousMessagesLengthRef.current) {
            scrollToBottom();
            previousMessagesLengthRef.current = messages.length;
        }
    }, [messages.length]);

    // 当流式更新时滚动到底部
    useEffect(() => {
        if (streamingMessageId) {
            scrollToBottom();
        }
    }, [streamingMessageId]);

    // 卸载时清理思考超时
    useEffect(() => {
        return () => {
            if (thinkingTimeoutRef.current) {
                clearTimeout(thinkingTimeoutRef.current);
            }
        };
    }, []);

    // 用于更好性能的节流滚动到底部函数
    const scrollToBottom = useThrottledCallback(
        () => {
            if (messagesWrapperRef.current) {
                // 滚动包装器到底部
                messagesWrapperRef.current.scrollTop = messagesWrapperRef.current.scrollHeight;
            }
        },
        100,
        [],
    );

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingMessageId]);

    const copyToClipboard = useCallback(
        (text: string) => {
            navigator.clipboard
                .writeText(text)
                .then(() => {
                    messageNotification.success(t('copied'), 2);
                })
                .catch(() => {
                    messageNotification.error(t('failedCopy'));
                });
        },
        [t],
    );

    // 清除思考超时辅助函数
    const clearThinkingTimeout = useCallback(() => {
        if (thinkingTimeoutRef.current) {
            clearTimeout(thinkingTimeoutRef.current);
            thinkingTimeoutRef.current = null;
        }
    }, []);

    // 创建流式更新处理程序工厂
    const createStreamUpdateHandler = useCallback(
        (aiMessageId: number) => {
            let accumulator = ''; // 用于累积内容并检测思考内容
            let hasSeenThinkingContent = false; // 标志以跟踪是否看到任何思考内容
            let isJsonFormat = false; // 标志以跟踪响应是否为JSON格式

            return (partialResponse: string) => {
                // 如果这是第一个块，设置流消息ID并隐藏思考指示器
                if (!streamingMessageId) {
                    setStreamingMessageId(aiMessageId);
                    setShowThinking(false);
                    clearThinkingTimeout();
                }

                // 将新块添加到我们的累加器
                accumulator += partialResponse;

                // 检查这可能是一个带有reasoning_content的JSON响应
                if (!isJsonFormat && accumulator.trim().startsWith('{')) {
                    isJsonFormat = true;
                }

                // 检查这可能是一个包含任何思考指示器的块
                if (!hasSeenThinkingContent) {
                    if (isJsonFormat && accumulator.includes('reasoning_content')) {
                        hasSeenThinkingContent = true;
                    } else if (
                        accumulator.includes('<think>') ||
                        accumulator.includes('</think>')
                    ) {
                        hasSeenThinkingContent = true;
                    }
                }

                let messageText = '';

                // 处理累积的内容
                try {
                    // 使用我们的实用函数解析内容
                    const parsed = parseModelResponse(accumulator);

                    if (parsed.thinking) {
                        hasSeenThinkingContent = true;

                        // 对于JSON格式，我们重建消息
                        if (isJsonFormat) {
                            // 创建一个JSON对象，将被parseModelResponse再次解析
                            messageText = JSON.stringify({
                                reasoning_content: parsed.thinking,
                                content: parsed.response,
                            });
                        } else {
                            // 对于<think>标签格式，将思考内容包装在标签中
                            messageText = `<think>${parsed.thinking}</think>\n\n${parsed.response}`;
                        }
                    } else {
                        // 没有检测到思考内容
                        messageText = isJsonFormat
                            ? accumulator // 保持原始JSON
                            : parsed.response; // 使用处理后的响应
                    }
                } catch (error) {
                    // 如果发生任何错误，只需使用原始累加器
                    console.error('Error processing response:', error);
                    messageText = accumulator;
                }

                // 更新消息
                setMessages((prevMessages) => {
                    // 过滤掉任何思考指示器
                    const filteredMessages = prevMessages.filter((msg) => !msg.isThinking);

                    const existingMessage = filteredMessages.find((msg) => msg.id === aiMessageId);

                    return existingMessage
                        ? filteredMessages.map((msg) =>
                              msg.id === aiMessageId
                                  ? {
                                        ...msg,
                                        text: messageText,
                                    }
                                  : msg,
                          )
                        : [
                              ...filteredMessages,
                              {
                                  id: aiMessageId,
                                  text: messageText,
                                  sender: 'ai',
                              },
                          ];
                });
            };
        },
        [streamingMessageId, clearThinkingTimeout],
    );

    // 创建一个函数来取消正在进行中的流式响应
    const cancelStreamingResponse = useCallback(() => {
        // 使用全局中止控制器取消API请求
        if (window.currentAbortController) {
            window.currentAbortController.abort();
        }

        // 更新UI状态
        setStreamingMessageId(null);
        setIsLoading(false);
        setShowThinking(false);
        clearThinkingTimeout();
    }, [clearThinkingTimeout]);

    // 处理发送消息或停止流式响应
    const handleSendMessage = useCallback(
        async (e?: React.KeyboardEvent | React.MouseEvent) => {
            // 如果存在默认事件行为，则阻止它
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }

            // 如果存在活动流式响应，停止它
            if (streamingMessageId) {
                cancelStreamingResponse();
                return;
            }

            if (!inputMessage.trim()) return;

            const userMessage: ChatMessage = {
                id: Date.now(),
                text: inputMessage,
                sender: 'user',
            };

            setMessages((prev) => [...prev, userMessage]);
            setInputMessage('');
            setIsLoading(true);

            // 设置一个超时，在短延迟后显示思考指示器
            clearThinkingTimeout();
            thinkingTimeoutRef.current = setTimeout(() => {
                if (isLoading && !streamingMessageId) {
                    setShowThinking(true);
                }
            }, 300);

            try {
                // 检查是否启用了网络搜索
                const webSearchEnabled = await storage.getWebSearchEnabled();
                // 确保 enhancedMessage 始终是字符串类型
                let enhancedMessage = inputMessage;

                // 如果启用了网络搜索，先执行搜索
                if (webSearchEnabled) {
                    // 添加一条系统消息，通知用户正在搜索
                    const searchingMessage: ChatMessage = {
                        id: Date.now() + 1,
                        text: t('searchingWeb' as any),
                        sender: 'system',
                    };
                    setMessages((prev) => [...prev, searchingMessage]);

                    // 执行网络搜索
                    const searchResults = await performSearch(inputMessage);

                    console.log('searchResults', searchResults);
                    // 如果有搜索结果，获取网页内容
                    if (searchResults.length > 0) {
                        const contents = await Promise.all(
                            searchResults.slice(0, 2).map((result) => fetchWebContent(result.link)),
                        );

                        console.log('contents', contents);

                        // 构建包含搜索结果的增强消息
                        const webContext = `${t('webSearchResultsTips1')}:${contents
                            .map(
                                (content, i) =>
                                    `${t('Source')} ${i + 1}: ${
                                        searchResults[i].title
                                    }\n${content.substring(0, 1500)}\n`,
                            )
                            .join('\n')}
${t('webSearchResultsTips2')}: ${inputMessage}
`;
                        enhancedMessage = webContext;

                        // 更新系统消息，告知用户搜索完成
                        const searchCompleteMessage: ChatMessage = {
                            id: Date.now() + 2,
                            text: t('searchComplete' as any),
                            sender: 'system',
                        };
                        setMessages((prev) =>
                            prev.map((msg) =>
                                msg.id === searchingMessage.id ? searchCompleteMessage : msg,
                            ),
                        );
                    } else {
                        // 如果没有搜索结果，告知用户
                        const noResultsMessage: ChatMessage = {
                            id: Date.now() + 2,
                            text: t('noSearchResults' as any),
                            sender: 'system',
                        };
                        setMessages((prev) =>
                            prev.map((msg) =>
                                msg.id === searchingMessage.id ? noResultsMessage : msg,
                            ),
                        );
                    }
                }

                const messageId = Date.now() + 100;
                setStreamingMessageId(messageId);

                const streamingMessage: ChatMessage = {
                    id: messageId,
                    text: '',
                    sender: 'ai',
                };

                setMessages((prev) => [...prev, streamingMessage]);

                // 定义流式更新处理函数
                const handleStreamUpdate = (chunk: string) => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === messageId ? { ...msg, text: msg.text + chunk } : msg,
                        ),
                    );
                };

                // 根据是否使用网页上下文选择适当的发送函数
                if (useWebpageContext) {
                    await sendMessageWithWebpageContext(
                        enhancedMessage ?? '',
                        true,
                        handleStreamUpdate,
                    );
                } else {
                    await sendMessage(enhancedMessage ?? '', handleStreamUpdate);
                }

                // 请求完成
                setStreamingMessageId(null);
                setIsLoading(false);
                clearThinkingTimeout();
                setShowThinking(false);
                scrollToBottom();
            } catch (error) {
                console.error('Error in handleSendMessage:', error);
                messageNotification.error(t('errorProcessing'));
                setIsLoading(false);
                clearThinkingTimeout();
                setShowThinking(false);
            }
        },
        [
            inputMessage,
            isLoading,
            streamingMessageId,
            useWebpageContext,
            cancelStreamingResponse,
            clearThinkingTimeout,
            scrollToBottom,
            t,
        ],
    );

    // 函数重新生成最后一个AI响应
    const regenerateResponse = useCallback(async () => {
        if (messages.length < 2) return;

        const lastUserMessageIndex = messages.map((m) => m.sender).lastIndexOf('user');
        if (lastUserMessageIndex === -1) return;

        const lastUserMessage = messages[lastUserMessageIndex];

        // 过滤掉任何思考指示器和最后一个用户消息后的消息
        setMessages(
            messages.filter((msg, index) => !msg.isThinking && index <= lastUserMessageIndex),
        );

        setIsLoading(true);

        // 设置一个超时，在短延迟后显示思考指示器
        clearThinkingTimeout();
        thinkingTimeoutRef.current = setTimeout(() => {
            if (isLoading && !streamingMessageId) {
                setShowThinking(true);
            }
        }, 300);

        try {
            // 创建一个空的AI消息占位符，将逐步更新
            const aiMessageId = Date.now();
            const handleStreamUpdate = createStreamUpdateHandler(aiMessageId);

            // 在开始流式响应之前设置streamingMessageId
            setStreamingMessageId(aiMessageId);

            // 使用流式回调调用适当的API
            await (useWebpageContext
                ? sendMessageWithWebpageContext(lastUserMessage.text, true, handleStreamUpdate)
                : sendMessage(lastUserMessage.text, handleStreamUpdate));

            // 标记流式响应完成
            setStreamingMessageId(null);
            setIsLoading(false);
            setShowThinking(false);
            clearThinkingTimeout();
        } catch (error) {
            console.error('Error regenerating response:', error);
            setMessages((prevMessages) => {
                // 过滤掉任何思考指示器
                const filteredMessages = prevMessages.filter((msg) => !msg.isThinking);
                return [
                    ...filteredMessages,
                    {
                        id: Date.now(),
                        text: t('errorRegenerating'),
                        sender: 'system',
                    },
                ];
            });
            setIsLoading(false);
            setStreamingMessageId(null);
            setShowThinking(false);
            clearThinkingTimeout();
        }
    }, [
        messages,
        isLoading,
        streamingMessageId,
        t,
        useWebpageContext,
        clearThinkingTimeout,
        createStreamUpdateHandler,
    ]);

    const handleExampleClick = useCallback(
        (exampleText: string) => {
            // 创建一个将在更新inputMessage时执行的函数
            const sendExample = () => {
                // 使用示例文本直接在handleSendMessage的新实现中
                const userMessage: ChatMessage = {
                    id: Date.now(),
                    text: exampleText,
                    sender: 'user',
                };

                // 将消息添加到聊天中
                setMessages((prev) => [...prev, userMessage]);
                setInputMessage(''); // 清除输入字段

                // 现在触发其余的发送过程
                // 我们将调用一个修改后的handleSendMessage逻辑，不依赖于inputMessage
                if (streamingMessageId) {
                    cancelStreamingResponse();
                    return;
                }

                setIsLoading(true);
                clearThinkingTimeout();
                thinkingTimeoutRef.current = setTimeout(() => {
                    if (isLoading && !streamingMessageId) {
                        setShowThinking(true);
                    }
                }, 300);

                // 使用其余的handleSendMessage逻辑，但使用我们的exampleText
                const processMessage = async () => {
                    try {
                        const aiMessageId = Date.now();
                        const handleStreamUpdate = createStreamUpdateHandler(aiMessageId);

                        // 设置streaming message ID
                        setStreamingMessageId(aiMessageId);

                        await (useWebpageContext
                            ? sendMessageWithWebpageContext(exampleText, true, handleStreamUpdate)
                            : sendMessage(exampleText, handleStreamUpdate));

                        setStreamingMessageId(null);
                        setIsLoading(false);
                        setShowThinking(false);
                        clearThinkingTimeout();
                        scrollToBottom();
                    } catch (error) {
                        console.error('Error in example message:', error);
                        messageNotification.error(t('errorProcessing'));
                        setIsLoading(false);
                        clearThinkingTimeout();
                        setShowThinking(false);
                    }
                };

                processMessage();
            };

            // 首先更新输入字段以提供视觉反馈
            setInputMessage(exampleText);
            // 然后在小延迟后发送以确保UI更新
            setTimeout(sendExample, 50);
        },
        [
            streamingMessageId,
            cancelStreamingResponse,
            setIsLoading,
            clearThinkingTimeout,
            isLoading,
            createStreamUpdateHandler,
            useWebpageContext,
            sendMessageWithWebpageContext,
            sendMessage,
            setStreamingMessageId,
            setShowThinking,
            scrollToBottom,
            t,
        ],
    );

    // Memoize the context toggle handler
    const toggleWebpageContext = useCallback(() => {
        setUseWebpageContext((prev) => !prev);
    }, []);

    // 修改以处理提示放置
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setInputMessage(newValue);

        // 检查输入是否以'/'开头，并且是第一个字符或跟随一个换行符
        if (newValue === '/' || /(?:^|\n)\/$/.test(newValue)) {
            setShowPrompts(true);
            setFilteredPrompts(commonPrompts);
        }
        // 如果输入以'/'开头，后面跟着一些文本，过滤提示
        else if (newValue.startsWith('/') && !newValue.includes(' ')) {
            const searchTerm = newValue.slice(1).toLowerCase();
            setShowPrompts(true);
            setFilteredPrompts(
                commonPrompts.filter(
                    (prompt) =>
                        prompt.key.toLowerCase().includes(searchTerm) ||
                        prompt.name.toLowerCase().includes(searchTerm),
                ),
            );
        }
        // 如果输入不以'/'开头或后面跟着一个空格，隐藏提示
        else {
            setShowPrompts(false);
        }
    };

    const handleCompositionStart = () => {
        setIsComposing(true);
    };

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
        setIsComposing(false);
        // 确保在合成结束时更新输入值
        setInputMessage((e.target as HTMLTextAreaElement).value);
    };

    // 替换keydown处理程序与稳定的回调
    const handleKeyDown = useStableCallback((e: React.KeyboardEvent) => {
        // 导航提示建议
        if (showPrompts && filteredPrompts.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedPromptIndex((prev) =>
                    prev < filteredPrompts.length - 1 ? prev + 1 : 0,
                );
                return;
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedPromptIndex((prev) =>
                    prev > 0 ? prev - 1 : filteredPrompts.length - 1,
                );
                return;
            }

            if (e.key === 'Enter' && selectedPromptIndex >= 0) {
                e.preventDefault();
                handlePromptSelect(filteredPrompts[selectedPromptIndex]);
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                setShowPrompts(false);
                setSelectedPromptIndex(-1);
                return;
            }
        }

        // Don't trigger send during IME composition
        if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // 添加一个效果来在消息变化时滚动到底部
    useEffect(() => {
        // 每当消息变化或流式状态变化时滚动到底部
        scrollToBottom();
    }, [messages, streamingMessageId, scrollToBottom]);

    // 添加一个resize观察器来处理窗口调整大小
    useEffect(() => {
        // 创建一个resize观察器来处理窗口调整大小
        const resizeObserver = new ResizeObserver(() => {
            scrollToBottom();
        });

        // 观察消息包装器元素
        if (messagesWrapperRef.current) {
            resizeObserver.observe(messagesWrapperRef.current);
        }

        // 在卸载时清理观察器
        return () => {
            resizeObserver.disconnect();
        };
    }, [scrollToBottom]);

    // 添加复制按钮点击处理程序，并进行适当的清理
    useEffect(() => {
        const handleCopyButtonClick = async (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const copyButton = target.closest('.copy-button') as HTMLElement | null;
            if (!copyButton) return;

            event.preventDefault();
            event.stopPropagation();

            // 获取code数据属性
            const codeData = copyButton ? copyButton.getAttribute('data-code') : null;
            const code = codeData ? decodeURIComponent(codeData) : null;

            if (code) {
                console.log('code', code);
                navigator.clipboard
                    .writeText(code)
                    .then(() => {
                        messageNotification.success(t('copied'), 2);
                    })
                    .catch(() => {
                        messageNotification.error(t('failedCopy'));
                    });
            }
        };

        // 添加事件监听器
        document.addEventListener('click', handleCopyButtonClick, true);

        // 在组件卸载时清理事件监听器
        return () => {
            document.removeEventListener('click', handleCopyButtonClick, true);
        };
    }, [t]);

    return (
        <div className="chat-interface-container">
            {showPrompts && filteredPrompts.length > 0 ? (
                <div className="prompt-suggestions-overlay">
                    <div className="prompt-suggestions">
                        {filteredPrompts.map((prompt, index) => (
                            <div
                                key={prompt.key}
                                className={`prompt-item ${
                                    index === selectedPromptIndex ? 'selected' : ''
                                }`}
                                onClick={() => handlePromptSelect(prompt)}
                            >
                                <div className="prompt-name">{prompt.name}</div>
                                <div className="prompt-preview">
                                    {prompt.content.slice(0, 60)}...
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
            <div className="chat-controls">
                <div className="context-label" onClick={toggleWebpageContext}>
                    <span>
                        <LinkOutlined className={useWebpageContext ? 'enabled' : 'disabled'} />
                        {t('includeWebpage')}
                    </span>
                </div>
                <WebSearchToggle />
            </div>
            <div className="messages-wrapper" ref={messagesWrapperRef}>
                <div ref={messagesContainerRef} className="messages-container">
                    {messages.length === 0 ? (
                        <EmptyChat t={t} handleExampleClick={handleExampleClick} />
                    ) : (
                        messages.map((msg) => {
                            if (msg.isThinking) {
                                return <ThinkingIndicator key={msg.id} t={t} />;
                            }
                            return (
                                <MessageBubble
                                    key={msg.id}
                                    message={msg}
                                    isStreaming={streamingMessageId === msg.id}
                                    t={t}
                                    copyToClipboard={copyToClipboard}
                                    regenerateResponse={regenerateResponse}
                                />
                            );
                        })
                    )}
                </div>
            </div>
            <div className="input-container">
                <div className="input-wrapper">
                    <Input.TextArea
                        value={inputMessage}
                        onChange={handleInputChange}
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
                        onKeyDown={handleKeyDown}
                        placeholder={t('typeMessage')}
                        autoSize={{ minRows: 1, maxRows: 6 }}
                        className="message-input"
                    />
                </div>
                <Button
                    type="primary"
                    icon={streamingMessageId ? <CloseOutlined /> : <SendOutlined />}
                    onClick={handleSendMessage}
                    loading={isLoading && !streamingMessageId}
                    className={`send-button ${
                        shouldDisableButton && !streamingMessageId ? 'disabled' : 'enabled'
                    }`}
                    disabled={shouldDisableButton && !streamingMessageId}
                >
                    {streamingMessageId ? t('stop') : t('send')}
                </Button>
            </div>
        </div>
    );
};

export default ChatInterface;
