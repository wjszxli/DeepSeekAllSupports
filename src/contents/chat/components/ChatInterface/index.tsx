import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { Button, Input, message as messageNotification, Typography, Modal } from 'antd';
import {
    SendOutlined,
    CloseOutlined,
    CopyOutlined,
    RedoOutlined,
    DeleteOutlined,
    GlobalOutlined,
    LinkOutlined,
} from '@ant-design/icons';
import './index.scss';
import './promptSuggestions.css';
import type { TranslationKey } from '@/contexts/LanguageContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { md } from '@/utils/markdownRenderer';
import { ChatMessage } from '@/types';
import { Robot } from '@/types';
import storage from '@/utils/storage';
import { featureSettings } from '@/utils/featureSettings';
import rootStore from '@/store';
import { getMessageService } from '@/services/MessageService';
import { getUserMessage } from '@/utils/message/input';
import { MessageBlockType, MainTextMessageBlock, ThinkingMessageBlock } from '@/types/messageBlock';
import { ChatInterfaceProps, EmptyChatProps, MessageBubbleProps, Prompt } from '../../type';

const MessageBubble = memo(
    ({ message, isStreaming, t, copyToClipboard, regenerateResponse }: MessageBubbleProps) => {
        const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);

        const toggleThinking = useCallback(() => {
            setIsThinkingExpanded((prev) => !prev);
        }, []);

        const handleCopy = useCallback(() => {
            const response = message.text;
            copyToClipboard(response);
        }, [copyToClipboard, message.text]);

        // 渲染消息内容
        const renderMessageContent = useCallback(() => {
            if (message.sender === 'ai') {
                const { thinking = '', text: response } = message;

                // 通用的渲染Markdown函数
                const renderMarkdown = (content: string) => {
                    return md.render(content || '');
                };

                // 先检查是否有思考部分
                if (thinking) {
                    // 渲染思考和响应内容
                    const thinkingHtml = renderMarkdown(thinking);
                    const responseHtml = renderMarkdown(response);

                    return (
                        <>
                            <div
                                className={`thinking-container ${
                                    isThinkingExpanded ? 'expanded' : 'collapsed'
                                }`}
                            >
                                <div className="thinking-header" onClick={toggleThinking}>
                                    <span className="thinking-label">🧠 {t('think')}</span>
                                    <span className="thinking-toggle">
                                        {isThinkingExpanded ? '▼' : '►'}
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
                const renderedHtml = renderMarkdown(message.text);

                return (
                    <div
                        className={`message-content ${isStreaming ? 'streaming' : ''}`}
                        dangerouslySetInnerHTML={{ __html: renderedHtml }}
                    />
                );
            }
            return <div className="message-content">{message.text}</div>;
        }, [message, isStreaming, t, isThinkingExpanded]);

        return (
            <div className={`message-bubble ${message.sender}`}>
                <div className="message-header">
                    <div className="sender-name">
                        {message.sender === 'user' ? t('you') : t('assistant')}
                    </div>
                </div>
                {renderMessageContent()}
                {message.sender === 'ai' && !isStreaming && (
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

const ChatInterface = ({ initialText }: ChatInterfaceProps) => {
    const [inputMessage, setInputMessage] = useState(initialText || '');
    const [isComposing, setIsComposing] = useState(false);
    const [showPrompts, setShowPrompts] = useState(false);
    const [filteredPrompts, setFilteredPrompts] = useState<Prompt[]>([]);
    const [selectedPromptIndex, setSelectedPromptIndex] = useState<number>(-1);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);
    const [webSearchEnabled, setWebSearchEnabled] = useState(false);
    const [useWebpageContext, setUseWebpageContext] = useState(true);
    const { t } = useLanguage();
    const messagesWrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const messageService = useMemo(() => getMessageService(rootStore), []);

    // Load settings
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const [webSearch, webpageContext] = await Promise.all([
                    storage.getWebSearchEnabled(),
                    storage.getUseWebpageContext(),
                ]);

                setWebSearchEnabled(webSearch ?? false);
                setUseWebpageContext(webpageContext ?? true);
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        };

        loadSettings();
    }, []);

    const handleWebSearchToggle = useCallback(
        async (checked: boolean) => {
            try {
                const newState = await featureSettings.toggleWebSearch(checked, t);
                setWebSearchEnabled(newState);
            } catch (error) {
                console.error('Failed to toggle web search:', error);
            }
        },
        [t],
    );

    const handleWebpageContextToggle = useCallback(
        async (checked: boolean) => {
            try {
                const newState = await featureSettings.toggleWebpageContext(checked, t);
                setUseWebpageContext(newState);
            } catch (error) {
                console.error('Failed to toggle webpage context:', error);
            }
        },
        [t],
    );

    const scrollToBottom = useCallback(() => {
        if (messagesWrapperRef.current) {
            messagesWrapperRef.current.scrollTop = messagesWrapperRef.current.scrollHeight;
        }
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages.length, scrollToBottom]);

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

    const cancelStreamingResponse = useCallback(() => {
        if (window.currentAbortController) {
            window.currentAbortController.abort();
        }

        setStreamingMessageId(null);
        setIsLoading(false);
    }, []);

    // Effect to monitor message blocks for updates
    useEffect(() => {
        const handleMessageBlockUpdate = (event: Event) => {
            const customEvent = event as CustomEvent<{
                blockId: string;
                content: string;
                type: string;
            }>;
            if (!customEvent.detail) return;

            const { content, type } = customEvent.detail;

            if (streamingMessageId) {
                setMessages((prevMessages) => {
                    return prevMessages.map((msg) => {
                        if (msg.id === streamingMessageId) {
                            if (type === MessageBlockType.MAIN_TEXT) {
                                return { ...msg, text: content };
                            } else if (type === MessageBlockType.THINKING) {
                                return { ...msg, thinking: content };
                            }
                        }
                        return msg;
                    });
                });
            }
        };

        // Create and dispatch a custom event for testing
        document.addEventListener('message_block_update', handleMessageBlockUpdate);

        return () => {
            document.removeEventListener('message_block_update', handleMessageBlockUpdate);
        };
    }, [streamingMessageId]);

    const sendChatMessage = useCallback(
        async (inputText: string) => {
            if (!inputText.trim()) return;

            const userMessage: ChatMessage = {
                id: Date.now(),
                text: inputText,
                sender: 'user',
            };

            setMessages((prev) => [...prev, userMessage]);
            setIsLoading(true);

            // Generate AI message ID
            const aiMessageId = Date.now() + 100;

            try {
                // Create initial AI message with thinking indicator
                const aiMessage: ChatMessage = {
                    id: aiMessageId,
                    text: t('thinking'),
                    sender: 'ai',
                };

                setMessages((prev) => [...prev, aiMessage]);
                setStreamingMessageId(aiMessageId);

                // Default robot configuration
                const defaultRobot: Robot = {
                    id: 'default',
                    name: 'AI Assistant',
                    prompt: 'You are an AI assistant. Be helpful, concise, and accurate.',
                    type: 'chat',
                    topics: [
                        {
                            id: 'default-topic',
                            assistantId: 'default',
                            name: 'Default Topic',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            messages: [],
                        },
                    ],
                    selectedTopicId: 'default-topic',
                };

                // Use the MessageService to send the message
                const { message, blocks } = getUserMessage({
                    robot: defaultRobot,
                    topic: defaultRobot.topics[0],
                    content: inputText,
                });

                // Set up a monitor for the message blocks
                const monitorInterval = setInterval(() => {
                    // Check for updated blocks in the store
                    const updatedBlocks = rootStore.messageBlockStore.blocks;

                    // Find relevant blocks for our message
                    const mainTextBlock = Array.from(updatedBlocks.values()).find(
                        (b) => b.messageId === message.id && b.type === MessageBlockType.MAIN_TEXT,
                    ) as MainTextMessageBlock | undefined;

                    const thinkingBlock = Array.from(updatedBlocks.values()).find(
                        (b) => b.messageId === message.id && b.type === MessageBlockType.THINKING,
                    ) as ThinkingMessageBlock | undefined;

                    // Update our UI based on the blocks
                    setMessages((prevMessages) => {
                        return prevMessages.map((msg) => {
                            if (msg.id === aiMessageId) {
                                return {
                                    ...msg,
                                    text: mainTextBlock?.content || msg.text,
                                    thinking: thinkingBlock?.content || msg.thinking,
                                };
                            }
                            return msg;
                        });
                    });

                    // If the message is done, clear the interval
                    const messageComplete = mainTextBlock?.status === 'success';
                    if (messageComplete) {
                        clearInterval(monitorInterval);
                    }
                }, 100);

                // Send the message
                await messageService.sendMessage(message, blocks, defaultRobot, 'default-topic');

                // Clean up the interval
                clearInterval(monitorInterval);

                // Request completed
                setStreamingMessageId(null);
                setIsLoading(false);
                scrollToBottom();
            } catch (error) {
                console.error('Error sending message:', error);
                messageNotification.error('Error processing message. Please try again.');
                setIsLoading(false);
                setStreamingMessageId(null);
            }
        },
        [t, messageService, scrollToBottom],
    );

    const regenerateResponse = useCallback(async () => {
        if (messages.length < 2 || isLoading) return;

        // Find the last user message
        const lastUserMessageIndex = messages.map((m) => m.sender).lastIndexOf('user');
        if (lastUserMessageIndex === -1) return;

        const lastUserMessage = messages[lastUserMessageIndex];

        // Remove the last AI response
        setMessages((prev) => prev.slice(0, -1));

        // Resend the last user message
        await sendChatMessage(lastUserMessage.text);
    }, [messages, isLoading, sendChatMessage]);

    const clearMessages = useCallback(() => {
        Modal.confirm({
            title: t('clearConfirmTitle'),
            content: t('clearConfirmContent'),
            onOk: () => {
                setMessages([]);
                messageNotification.success(t('chatCleared'));
            },
        });
    }, [t]);

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

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setInputMessage(value);

        // 处理提示建议
        if (value.startsWith('/') && !isLoading) {
            const query = value.slice(1).toLowerCase();
            const filtered = commonPrompts.filter((prompt) =>
                prompt.name.toLowerCase().includes(query),
            );
            setFilteredPrompts(filtered);
            setShowPrompts(filtered.length > 0);
            setSelectedPromptIndex(filtered.length > 0 ? 0 : -1);
        } else {
            setShowPrompts(false);
        }
    };

    const handleCompositionStart = () => {
        setIsComposing(true);
    };

    const handleCompositionEnd = () => {
        setIsComposing(false);
    };

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (showPrompts) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedPromptIndex((prev) =>
                        prev < filteredPrompts.length - 1 ? prev + 1 : prev,
                    );
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedPromptIndex((prev) => (prev > 0 ? prev - 1 : prev));
                } else if (e.key === 'Tab' || e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedPromptIndex >= 0) {
                        const selectedPrompt = filteredPrompts[selectedPromptIndex];
                        setInputMessage(selectedPrompt.content);
                        setShowPrompts(false);
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowPrompts(false);
                }
                return;
            }

            // 处理发送消息
            if (e.key === 'Enter' && !e.shiftKey && !shouldDisableButton) {
                e.preventDefault();
                sendChatMessage(inputMessage);
                setInputMessage('');
            }
        },
        [
            showPrompts,
            filteredPrompts,
            selectedPromptIndex,
            shouldDisableButton,
            inputMessage,
            sendChatMessage,
        ],
    );

    const handleSend = useCallback(() => {
        if (!shouldDisableButton) {
            sendChatMessage(inputMessage);
            setInputMessage('');
        }
    }, [shouldDisableButton, sendChatMessage, inputMessage]);

    const handleExampleClick = useCallback(
        (text: string) => {
            setInputMessage(text);
            if (inputRef.current) {
                inputRef.current.focus();
            }
        },
        [inputRef],
    );

    return (
        <div className="chat-interface">
            <div className="chat-controls">
                <div className="control-item">
                    <LinkOutlined
                        className={useWebpageContext ? 'icon-enabled' : 'icon-disabled'}
                    />
                    <span className="control-label">{t('includeWebpage')}</span>
                    <Button
                        type={useWebpageContext ? 'primary' : 'default'}
                        size="small"
                        onClick={() => handleWebpageContextToggle(!useWebpageContext)}
                    >
                        {useWebpageContext ? t('on') : t('off')}
                    </Button>
                </div>
                <div className="control-item">
                    <GlobalOutlined
                        className={webSearchEnabled ? 'icon-enabled' : 'icon-disabled'}
                    />
                    <span className="control-label">{t('webSearch')}</span>
                    <Button
                        type={webSearchEnabled ? 'primary' : 'default'}
                        size="small"
                        onClick={() => handleWebSearchToggle(!webSearchEnabled)}
                    >
                        {webSearchEnabled ? t('on') : t('off')}
                    </Button>
                </div>
                {isLoading && (
                    <div className="control-item">
                        <Button
                            type="default"
                            icon={<CloseOutlined />}
                            onClick={cancelStreamingResponse}
                            size="small"
                        >
                            {t('stop')}
                        </Button>
                    </div>
                )}
                {messages.length > 0 && (
                    <div className="control-item">
                        <Button
                            type="default"
                            icon={<DeleteOutlined />}
                            onClick={clearMessages}
                            size="small"
                        >
                            {t('clear')}
                        </Button>
                    </div>
                )}
            </div>

            <div className="chat-messages-wrapper" ref={messagesWrapperRef}>
                {messages.length === 0 ? (
                    <EmptyChat t={t} handleExampleClick={handleExampleClick} />
                ) : (
                    <div className="chat-messages">
                        {messages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                isStreaming={streamingMessageId === message.id}
                                t={t}
                                copyToClipboard={copyToClipboard}
                                regenerateResponse={regenerateResponse}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="chat-input-wrapper">
                <div className="chat-input-container">
                    <div className="input-with-prompts">
                        <Input.TextArea
                            ref={inputRef}
                            className="chat-input"
                            value={inputMessage}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            onCompositionStart={handleCompositionStart}
                            onCompositionEnd={handleCompositionEnd}
                            placeholder={t('typeMessage')}
                            autoSize={{ minRows: 1, maxRows: 5 }}
                            disabled={isLoading && streamingMessageId !== null}
                        />

                        {showPrompts && (
                            <div className="prompt-suggestions">
                                {filteredPrompts.map((prompt, index) => (
                                    <div
                                        key={prompt.key}
                                        className={`prompt-item ${
                                            index === selectedPromptIndex ? 'selected' : ''
                                        }`}
                                        onClick={() => {
                                            setInputMessage(prompt.content);
                                            setShowPrompts(false);
                                            if (inputRef.current) {
                                                inputRef.current.focus();
                                            }
                                        }}
                                    >
                                        {prompt.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={handleSend}
                        disabled={shouldDisableButton}
                        className="send-button"
                    />
                </div>
                <div className="chat-input-tip">
                    <Typography.Text type="secondary">{t('pressTip')}</Typography.Text>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
