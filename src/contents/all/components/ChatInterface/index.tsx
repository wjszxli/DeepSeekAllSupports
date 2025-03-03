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
import storage from '@/utils/storage';
import { useStableCallback, useThrottledCallback } from '@/utils/reactOptimizations';
import { LRUCache } from '@/utils/memoryOptimization';

// Extend the Window interface to include the abort controller
declare global {
    interface Window {
        currentAbortController?: AbortController;
    }
}

interface ChatMessage {
    id: number;
    text: string;
    sender: 'user' | 'ai' | 'system';
    isThinking?: boolean;
}

// Define the Prompt interface
interface Prompt {
    key: string;
    name: string;
    content: string;
}

interface ChatInterfaceProps {
    initialText?: string;
}

// Define props interfaces for memoized components
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

// Create a markdown cache to avoid re-rendering the same content
const markdownCache = new LRUCache<string, string>(50);

// Memoized message component for better performance
const MessageBubble = memo(
    ({ message, isStreaming, t, copyToClipboard, regenerateResponse }: MessageBubbleProps) => {
        const handleCopy = useCallback(() => {
            copyToClipboard(message.text);
        }, [copyToClipboard, message.text]);

        const renderMessageContent = useCallback(() => {
            if (message.sender === 'ai') {
                // Check if we have this markdown in the cache
                const cacheKey = `${message.id}-${message.text}`;
                let renderedHtml = markdownCache.get(cacheKey);

                if (!renderedHtml) {
                    // 创建一个临时 div 来解析和修改 HTML 内容
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = md.render(message.text || '');
                    
                    // We don't need to add additional classes to pre elements
                    // as they are already styled correctly by the markdown renderer
                    
                    renderedHtml = tempDiv.innerHTML;
                    // Store in cache
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
        }, [message, isStreaming, t]);

        return (
            <div className={`message-bubble ${message.sender}`}>
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

// Memoized empty chat component
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

// Memoized ThinkingIndicator component for better performance
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

    // Memoize expensive operations
    const isInputEmpty = useMemo(() => inputMessage.trim() === '', [inputMessage]);
    const shouldDisableButton = useMemo(
        () => isLoading || isInputEmpty || isComposing,
        [isLoading, isInputEmpty, isComposing],
    );

    // Define common prompts
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

    // Handle prompt selection
    const handlePromptSelect = useCallback((prompt: Prompt) => {
        setInputMessage(prompt.content);
        setShowPrompts(false);
        setSelectedPromptIndex(-1);
    }, []);

    // Add a thinking message when AI is processing
    useEffect(() => {
        if (isLoading && showThinking) {
            // Add the thinking message immediately
            const thinkingMessage: ChatMessage = {
                id: messageIdCounter.current++,
                text: '',
                sender: 'ai',
                isThinking: true,
            };
            setMessages((prevMessages) => [...prevMessages, thinkingMessage]);
        }
    }, [isLoading, showThinking]);

    // Remove thinking message when response arrives or on error
    useEffect(() => {
        if (!isLoading) {
            // Remove any thinking messages when loading is complete
            setMessages((prevMessages) => prevMessages.filter((msg) => !msg.isThinking));
        }
    }, [isLoading]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (messages.length !== previousMessagesLengthRef.current) {
            scrollToBottom();
            previousMessagesLengthRef.current = messages.length;
        }
    }, [messages.length]);

    // Scroll on streaming updates
    useEffect(() => {
        if (streamingMessageId) {
            scrollToBottom();
        }
    }, [streamingMessageId]);

    // Reset copied state after 2 seconds
    // useEffect(() => {
    //     if (messagesContainerRef.current) {
    //         // Force re-render of the chat messages
    //         setMessages((prevMessages) => [...prevMessages]);

    //         // Update UI elements with translations
    //         setTimeout(() => {
    //             // Update copy buttons text
    //             const copyButtons = document.querySelectorAll('.copy-button');
    //             copyButtons.forEach((button) => {
    //                 const blockId = button.dataset.blockid;
    //                 const copyIcon = button.querySelector('.copy-icon');
    //                 if (copyIcon && blockId) {
    //                     copyIcon.textContent = blockId === 'code-block-0-0' ? '✓' : t('copy');
    //                 }
    //             });
    //         }, 50);
    //     }
    // }, [t, messages]);

    // Clean up thinking timeout on unmount
    useEffect(() => {
        return () => {
            if (thinkingTimeoutRef.current) {
                clearTimeout(thinkingTimeoutRef.current);
            }
        };
    }, []);

    // Throttled scroll to bottom function for better performance
    const scrollToBottom = useThrottledCallback(
        () => {
            if (messagesWrapperRef.current) {
                // Scroll the wrapper to the bottom
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

    // Clear thinking timeout helper
    const clearThinkingTimeout = useCallback(() => {
        if (thinkingTimeoutRef.current) {
            clearTimeout(thinkingTimeoutRef.current);
            thinkingTimeoutRef.current = null;
        }
    }, []);

    // Create stream update handler factory
    const createStreamUpdateHandler = useCallback(
        (aiMessageId: number) => {
            return (partialResponse: string) => {
                // If this is the first chunk, set the streaming message ID and hide thinking indicator
                if (!streamingMessageId) {
                    setStreamingMessageId(aiMessageId);
                    setShowThinking(false);
                    clearThinkingTimeout();
                }

                setMessages((prevMessages) => {
                    // Filter out any thinking indicators
                    const filteredMessages = prevMessages.filter((msg) => !msg.isThinking);

                    const existingMessage = filteredMessages.find((msg) => msg.id === aiMessageId);
                    return existingMessage
                        ? filteredMessages.map((msg) =>
                              msg.id === aiMessageId
                                  ? {
                                        ...msg,
                                        text: partialResponse
                                            ? msg.text + partialResponse
                                            : msg.text,
                                    }
                                  : msg,
                          )
                        : [
                              ...filteredMessages,
                              { id: aiMessageId, text: partialResponse || '', sender: 'ai' },
                          ];
                });
            };
        },
        [streamingMessageId, clearThinkingTimeout],
    );

    // Create a function to cancel ongoing streaming
    const cancelStreamingResponse = useCallback(() => {
        // Cancel the API request using the global abort controller
        if (window.currentAbortController) {
            window.currentAbortController.abort();
        }

        // Update the UI state
        setStreamingMessageId(null);
        setIsLoading(false);
        setShowThinking(false);
        clearThinkingTimeout();
    }, [clearThinkingTimeout]);

    // Handle sending a message or stopping a streaming response
    const handleSendMessage = useCallback(
        async (e?: React.KeyboardEvent | React.MouseEvent) => {
            // Prevent default event behavior if present
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }

            // If there's an active streaming response, stop it
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

            // Set a timeout to show the thinking indicator after a short delay
            clearThinkingTimeout();
            thinkingTimeoutRef.current = setTimeout(() => {
                if (isLoading && !streamingMessageId) {
                    setShowThinking(true);
                }
            }, 300);

            try {
                // Get provider config to check if it's properly set up
                const { selectedProvider, selectedModel } = await storage.getConfig();

                if (!selectedProvider) {
                    setMessages((prev) => [
                        ...prev.filter((msg) => !msg.isThinking),
                        {
                            id: Date.now() + 1,
                            text: t('selectProvider'),
                            sender: 'system',
                        },
                    ]);
                    setIsLoading(false);
                    setShowThinking(false);
                    clearThinkingTimeout();
                    return;
                }

                if (!selectedModel) {
                    setMessages((prev) => [
                        ...prev.filter((msg) => !msg.isThinking),
                        {
                            id: Date.now() + 1,
                            text: t('selectModel'),
                            sender: 'system',
                        },
                    ]);
                    setIsLoading(false);
                    setShowThinking(false);
                    clearThinkingTimeout();
                    return;
                }

                // Create an empty AI message placeholder that will be updated incrementally
                const aiMessageId = Date.now() + 2; // Ensure unique ID
                const handleStreamUpdate = createStreamUpdateHandler(aiMessageId);

                // Call the appropriate service with streaming callback
                await (useWebpageContext
                    ? sendMessageWithWebpageContext(inputMessage, true, handleStreamUpdate)
                    : sendMessage(inputMessage, handleStreamUpdate));

                // Clean up
                setStreamingMessageId(null);
                setIsLoading(false);
                setShowThinking(false);
                clearThinkingTimeout();
            } catch (error) {
                console.error('Error sending message:', error);
                setMessages((prev) => {
                    // Filter out any thinking indicators
                    const filteredMessages = prev.filter((msg) => !msg.isThinking);
                    return [
                        ...filteredMessages,
                        {
                            id: Date.now() + 1,
                            text: error instanceof Error ? error.message : t('errorProcessing'),
                            sender: 'system',
                        },
                    ];
                });
                setIsLoading(false);
                setStreamingMessageId(null);
                setShowThinking(false);
                clearThinkingTimeout();
            }
        },
        [
            inputMessage,
            isLoading,
            streamingMessageId,
            t,
            useWebpageContext,
            clearThinkingTimeout,
            createStreamUpdateHandler,
            cancelStreamingResponse,
        ],
    );

    // Function to regenerate the last AI response
    const regenerateResponse = useCallback(async () => {
        if (messages.length < 2) return;

        const lastUserMessageIndex = messages.map((m) => m.sender).lastIndexOf('user');
        if (lastUserMessageIndex === -1) return;

        const lastUserMessage = messages[lastUserMessageIndex];

        // Filter out any thinking indicators and messages after the last user message
        setMessages(
            messages.filter((msg, index) => !msg.isThinking && index <= lastUserMessageIndex),
        );

        setIsLoading(true);

        // Set a timeout to show the thinking indicator after a short delay
        clearThinkingTimeout();
        thinkingTimeoutRef.current = setTimeout(() => {
            if (isLoading && !streamingMessageId) {
                setShowThinking(true);
            }
        }, 300);

        try {
            // Create an empty AI message placeholder that will be updated incrementally
            const aiMessageId = Date.now();
            const handleStreamUpdate = createStreamUpdateHandler(aiMessageId);

            // Call the appropriate service with streaming callback
            await (useWebpageContext
                ? sendMessageWithWebpageContext(lastUserMessage.text, true, handleStreamUpdate)
                : sendMessage(lastUserMessage.text, handleStreamUpdate));

            // Mark streaming as complete
            setStreamingMessageId(null);
            setIsLoading(false);
            setShowThinking(false);
            clearThinkingTimeout();
        } catch (error) {
            console.error('Error regenerating response:', error);
            setMessages((prevMessages) => {
                // Filter out any thinking indicators
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
            setInputMessage(exampleText);
            // Auto-send the example
            setTimeout(() => {
                handleSendMessage();
            }, 100);
        },
        [handleSendMessage],
    );

    // Memoize the context toggle handler
    const toggleWebpageContext = useCallback(() => {
        setUseWebpageContext((prev) => !prev);
    }, []);

    // Modified to handle prompt placement
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setInputMessage(newValue);

        // Check if the input starts with '/' and it's the first character or follows a newline
        if (newValue === '/' || /(?:^|\n)\/$/.test(newValue)) {
            setShowPrompts(true);
            setFilteredPrompts(commonPrompts);
        }
        // If input starts with '/' followed by some text, filter prompts
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
        // Hide prompts if input doesn't start with '/' or a space is found after '/'
        else {
            setShowPrompts(false);
        }
    };

    const handleCompositionStart = () => {
        setIsComposing(true);
    };

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
        setIsComposing(false);
        // Ensure the input value is updated after composition ends
        setInputMessage((e.target as HTMLTextAreaElement).value);
    };

    // Replace the keydown handler with a stable callback
    const handleKeyDown = useStableCallback((e: React.KeyboardEvent) => {
        // Navigation for prompt suggestions
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

    // Add an effect to scroll to bottom when messages change
    useEffect(() => {
        // Scroll to bottom whenever messages change or streaming status changes
        scrollToBottom();
    }, [messages, streamingMessageId, scrollToBottom]);

    // Add a resize observer to handle window resizing
    useEffect(() => {
        // Create a resize observer to handle window resizing
        const resizeObserver = new ResizeObserver(() => {
            scrollToBottom();
        });

        // Observe the messages wrapper element
        if (messagesWrapperRef.current) {
            resizeObserver.observe(messagesWrapperRef.current);
        }

        // Clean up the observer on unmount
        return () => {
            resizeObserver.disconnect();
        };
    }, [scrollToBottom]);

    // Add copy button click handler with proper cleanup
    useEffect(() => {
        const handleCopyButtonClick = async (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const copyButton = target.closest('.copy-button') as HTMLElement | null;
            if (!copyButton) return;

            event.preventDefault();
            event.stopPropagation();

            // Get the code data attribute
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

        // Add the event listener
        document.addEventListener('click', handleCopyButtonClick, true);

        // Clean up the event listener when component unmounts
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
