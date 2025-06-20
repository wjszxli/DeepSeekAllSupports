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

interface Prompt {
    key: string;
    name: string;
    content: string;
}

const MessageBubble = memo(
    ({ message, isStreaming, t, copyToClipboard, regenerateResponse }: MessageBubbleProps) => {
        const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);

        const toggleThinking = useCallback(() => {
            setIsThinkingExpanded((prev) => !prev);
        }, []);

        const handleCopy = useCallback(() => {
            copyToClipboard(message.text);
        }, [copyToClipboard, message.text]);

        const renderMessageContent = useCallback(() => {
            if (message.sender === 'ai') {
                const { thinking = '', text: response } = message;

                const renderMarkdown = (content: string) => {
                    return md.render(content || '');
                };

                if (thinking) {
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

            const aiMessageId = Date.now() + 100;

            try {
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

                const { message, blocks } = getUserMessage({
                    robot: defaultRobot,
                    topic: defaultRobot.topics[0],
                    content: inputText,
                });

                // Send the message
                await messageService.sendMessage(message, blocks, defaultRobot, 'default-topic');

                // For now, simulate a simple response
                setTimeout(() => {
                    setMessages((prevMessages) => {
                        return prevMessages.map((msg) => {
                            if (msg.id === aiMessageId) {
                                return {
                                    ...msg,
                                    text: "I'm a simple AI assistant. This is a placeholder response while the full integration is being completed.",
                                };
                            }
                            return msg;
                        });
                    });
                    setStreamingMessageId(null);
                    setIsLoading(false);
                }, 1000);

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

        const lastUserMessageIndex = messages.map((m) => m.sender).lastIndexOf('user');
        if (lastUserMessageIndex === -1) return;

        const lastUserMessage = messages[lastUserMessageIndex];
        setMessages((prev) => prev.slice(0, -1));
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

            if (e.key === 'Enter' && !e.shiftKey && !isLoading && inputMessage.trim()) {
                e.preventDefault();
                sendChatMessage(inputMessage);
                setInputMessage('');
            }
        },
        [
            showPrompts,
            filteredPrompts,
            selectedPromptIndex,
            isLoading,
            inputMessage,
            sendChatMessage,
        ],
    );

    const handleSend = useCallback(() => {
        if (!isLoading && inputMessage.trim()) {
            sendChatMessage(inputMessage);
            setInputMessage('');
        }
    }, [isLoading, inputMessage, sendChatMessage]);

    const handleExampleClick = useCallback((text: string) => {
        setInputMessage(text);
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

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
                            onCompositionStart={() => setIsComposing(true)}
                            onCompositionEnd={() => setIsComposing(false)}
                            placeholder={t('typeMessage')}
                            autoSize={{ minRows: 1, maxRows: 5 }}
                            disabled={isLoading}
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
                        disabled={isLoading || !inputMessage.trim() || isComposing}
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
