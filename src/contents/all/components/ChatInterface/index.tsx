import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Input, message, Typography } from 'antd';
import { CopyOutlined, SyncOutlined, SendOutlined, LinkOutlined } from '@ant-design/icons';
import { sendMessage, sendMessageWithWebpageContext } from '@/services/chatService';
import { md } from '@/utils/markdownRenderer';
import './index.scss';
import { useLanguage } from '@/contexts/LanguageContext';
import storage from '@/utils/storage';

interface ChatMessage {
    id: number;
    text: string;
    sender: 'user' | 'ai' | 'system';
    isThinking?: boolean;
}

interface ChatInterfaceProps {
    initialText?: string;
}

const ChatInterface = ({ initialText }: ChatInterfaceProps) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState(initialText || '');
    const [isLoading, setIsLoading] = useState(false);
    const [useWebpageContext, setUseWebpageContext] = useState(true);
    const [copiedCodeBlock, setCopiedCodeBlock] = useState<string | null>(null);
    const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);
    const [showThinking, setShowThinking] = useState(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { t, currentLanguage } = useLanguage();
    const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Scroll to bottom whenever messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, showThinking, streamingMessageId]);

    // Add a useEffect to reset the copied state after 2 seconds
    useEffect(() => {
        if (copiedCodeBlock) {
            const timer = setTimeout(() => {
                setCopiedCodeBlock(null);
            }, 2000);

            // Return cleanup function
            return () => clearTimeout(timer);
        }
        // Return empty function for when no timer is set
        return () => {};
    }, [copiedCodeBlock]);

    // Add a useEffect to respond to language changes
    useEffect(() => {
        // When language changes, force re-render of the chat messages
        if (messagesContainerRef.current) {
            // Clone messages to trigger a re-render
            setMessages((messages) => [...messages]);

            // Also update UI elements with translations
            setTimeout(() => {
                // Update copy buttons text
                const copyButtons = document.querySelectorAll('.copy-button');
                copyButtons.forEach((button) => {
                    const blockId = button.getAttribute('data-blockid');
                    const copyIcon = button.querySelector('.copy-icon');
                    if (copyIcon && blockId) {
                        copyIcon.textContent = copiedCodeBlock === blockId ? '✓' : t('copy');
                    }
                });
            }, 50);
        }
    }, [currentLanguage, copiedCodeBlock, t]);

    // Clean up thinking timeout on unmount
    useEffect(() => {
        return () => {
            if (thinkingTimeoutRef.current) {
                clearTimeout(thinkingTimeoutRef.current);
            }
        };
    }, []);

    // Add a useEffect to scroll to bottom when new messages are added
    useEffect(() => {
        // When a new message is added, scroll to the bottom
        if (messages.length > 0) {
            scrollToBottom();
        }
    }, [messages.length]);

    const scrollToBottom = () => {
        if (messagesEndRef.current && messagesContainerRef.current) {
            // Use requestAnimationFrame to ensure DOM updates have completed
            requestAnimationFrame(() => {
                messagesContainerRef.current?.scrollTo({
                    top: messagesContainerRef.current.scrollHeight,
                    behavior: 'smooth',
                });
            });
        }
    };

    // Function to copy code from pre blocks
    const copyCodeBlockToClipboard = useCallback(
        (codeContent: string, blockId: string) => {
            navigator.clipboard
                .writeText(codeContent)
                .then(() => {
                    setCopiedCodeBlock(blockId);
                    message.success(t('codeCopied'));
                })
                .catch(() => {
                    message.error(t('failedCodeCopy'));
                });
        },
        [t],
    );

    // Helper function to copy message text to clipboard
    const copyToClipboard = (text: string) => {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                message.success(t('copied'));
            })
            .catch(() => {
                message.error(t('failedCopy'));
            });
    };

    async function handleSendMessage(e?: React.KeyboardEvent | React.MouseEvent) {
        // Prevent default event behavior if present (like form submission)
        if (e) {
            e.preventDefault();
            e.stopPropagation();
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
        // This prevents flashing if the response comes back quickly
        if (thinkingTimeoutRef.current) {
            clearTimeout(thinkingTimeoutRef.current);
        }

        thinkingTimeoutRef.current = setTimeout(() => {
            if (isLoading && !streamingMessageId) {
                setShowThinking(true);
            }
        }, 300);

        // Get provider config to check if it's properly set up
        const { selectedProvider, selectedModel } = await storage.getConfig();
        console.log('Provider config:', { selectedProvider, selectedModel });

        if (!selectedProvider) {
            const errorMessage: ChatMessage = {
                id: Date.now() + 1,
                text: t('selectProvider'),
                sender: 'system',
            };
            setMessages((prev) => [...prev, errorMessage]);
            setIsLoading(false);
            setShowThinking(false);
            if (thinkingTimeoutRef.current) {
                clearTimeout(thinkingTimeoutRef.current);
            }
            return;
        }

        if (!selectedModel) {
            const errorMessage: ChatMessage = {
                id: Date.now() + 1,
                text: t('selectModel'),
                sender: 'system',
            };
            setMessages((prev) => [...prev, errorMessage]);
            setIsLoading(false);
            setShowThinking(false);
            if (thinkingTimeoutRef.current) {
                clearTimeout(thinkingTimeoutRef.current);
            }
            return;
        }

        try {
            console.log('Sending message with context:', useWebpageContext);

            // Create an empty AI message placeholder that will be updated incrementally
            const aiMessageId = Date.now() + 2; // Ensure unique ID

            // Define a callback for receiving stream updates
            const handleStreamUpdate = (partialResponse: string) => {
                // If this is the first chunk, set the streaming message ID and hide thinking indicator
                if (!streamingMessageId) {
                    setStreamingMessageId(aiMessageId);
                    setShowThinking(false);
                    if (thinkingTimeoutRef.current) {
                        clearTimeout(thinkingTimeoutRef.current);
                    }
                }

                setMessages((prevMessages) => {
                    // Filter out any thinking indicators
                    const filteredMessages = prevMessages.filter((msg) => !msg.isThinking);

                    const existingMessage = filteredMessages.find((msg) => msg.id === aiMessageId);
                    if (existingMessage) {
                        return filteredMessages.map((msg) =>
                            msg.id === aiMessageId
                                ? {
                                      ...msg,
                                      text: partialResponse ? msg.text + partialResponse : msg.text,
                                  }
                                : msg,
                        );
                    } else {
                        return [
                            ...filteredMessages,
                            { id: aiMessageId, text: partialResponse || '', sender: 'ai' },
                        ];
                    }
                });
            };

            // Call the appropriate service with streaming callback
            if (useWebpageContext) {
                await sendMessageWithWebpageContext(inputMessage, true, handleStreamUpdate);
            } else {
                await sendMessage(inputMessage, handleStreamUpdate);
            }

            // Clean up
            setStreamingMessageId(null);
            setIsLoading(false);
            setShowThinking(false);
            if (thinkingTimeoutRef.current) {
                clearTimeout(thinkingTimeoutRef.current);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage: ChatMessage = {
                id: Date.now() + 1,
                text: error instanceof Error ? error.message : t('errorProcessing'),
                sender: 'system',
            };
            setMessages((prev) => {
                // Filter out any thinking indicators
                const filteredMessages = prev.filter((msg) => !msg.isThinking);
                return [...filteredMessages, errorMessage];
            });
            setIsLoading(false);
            setStreamingMessageId(null);
            setShowThinking(false);
            if (thinkingTimeoutRef.current) {
                clearTimeout(thinkingTimeoutRef.current);
            }
        }
    }

    // Function to regenerate the last AI response
    const regenerateResponse = async () => {
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
        if (thinkingTimeoutRef.current) {
            clearTimeout(thinkingTimeoutRef.current);
        }

        thinkingTimeoutRef.current = setTimeout(() => {
            if (isLoading && !streamingMessageId) {
                setShowThinking(true);
            }
        }, 300);

        try {
            // Create an empty AI message placeholder that will be updated incrementally
            const aiMessageId = Date.now();

            // Define a callback for receiving stream updates
            const handleStreamUpdate = (partialResponse: string) => {
                // If this is the first chunk, set the streaming message ID and hide thinking indicator
                if (!streamingMessageId) {
                    setStreamingMessageId(aiMessageId);
                    setShowThinking(false);
                    if (thinkingTimeoutRef.current) {
                        clearTimeout(thinkingTimeoutRef.current);
                    }
                }

                setMessages((prevMessages) => {
                    // Filter out any thinking indicators
                    const filteredMessages = prevMessages.filter((msg) => !msg.isThinking);

                    const existingMessage = filteredMessages.find((msg) => msg.id === aiMessageId);
                    if (existingMessage) {
                        return filteredMessages.map((msg) =>
                            msg.id === aiMessageId
                                ? {
                                      ...msg,
                                      text: partialResponse ? msg.text + partialResponse : msg.text,
                                  }
                                : msg,
                        );
                    } else {
                        return [
                            ...filteredMessages,
                            { id: aiMessageId, text: partialResponse || '', sender: 'ai' },
                        ];
                    }
                });
            };

            // Call the appropriate service with streaming callback
            if (useWebpageContext) {
                await sendMessageWithWebpageContext(lastUserMessage.text, true, handleStreamUpdate);
            } else {
                await sendMessage(lastUserMessage.text, handleStreamUpdate);
            }

            // Mark streaming as complete
            setStreamingMessageId(null);
            setIsLoading(false);
            setShowThinking(false);
            if (thinkingTimeoutRef.current) {
                clearTimeout(thinkingTimeoutRef.current);
            }
        } catch (error) {
            console.error('Error regenerating response:', error);
            const errorMessage: ChatMessage = {
                id: Date.now(),
                text: t('errorRegenerating'),
                sender: 'system',
            };
            setMessages((prevMessages) => {
                // Filter out any thinking indicators
                const filteredMessages = prevMessages.filter((msg) => !msg.isThinking);
                return [...filteredMessages, errorMessage];
            });
            setIsLoading(false);
            setStreamingMessageId(null);
            setShowThinking(false);
            if (thinkingTimeoutRef.current) {
                clearTimeout(thinkingTimeoutRef.current);
            }
        }
    };

    const handleExampleClick = (exampleText: string) => {
        setInputMessage(exampleText);
        // Auto-send the example
        setTimeout(() => {
            handleSendMessage();
        }, 100);
    };

    // Helper function to render message content
    const renderMessageContent = useCallback(
        (message: ChatMessage) => {
            if (message.sender === 'ai') {
                // Check if this message is currently streaming
                const isStreaming = streamingMessageId === message.id;

                // 创建一个临时 div 来解析和修改 HTML 内容
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = md.render(message.text || '');

                // 查找所有 pre 元素并添加复制按钮
                const preElements = tempDiv.querySelectorAll('pre');
                preElements.forEach((pre, index) => {
                    // 创建一个唯一的 ID 给这个代码块
                    const blockId = `code-block-${message.id}-${index}`;
                    pre.id = blockId;

                    // 添加一个样式类
                    pre.classList.add('code-block-wrapper');

                    // 获取代码内容
                    const codeContent = pre.textContent || '';

                    // 创建复制按钮容器
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'code-copy-button';
                    buttonContainer.innerHTML = `
                    <button class="copy-button" data-content="${encodeURIComponent(
                        codeContent,
                    )}" data-blockid="${blockId}">
                        <span class="copy-icon">${
                            copiedCodeBlock === blockId ? '✓' : t('copy')
                        }</span>
                    </button>
                `;

                    // 将按钮容器插入到 pre 元素的右上角
                    pre.style.position = 'relative';
                    pre.insertBefore(buttonContainer, pre.firstChild);
                });

                // 添加事件监听器
                setTimeout(() => {
                    const copyButtons = document.querySelectorAll('.copy-button');
                    copyButtons.forEach((button) => {
                        button.addEventListener('click', (e) => {
                            const target = e.currentTarget as HTMLElement;
                            const content = target.getAttribute('data-content');
                            const blockId = target.getAttribute('data-blockid');

                            if (content && blockId) {
                                copyCodeBlockToClipboard(decodeURIComponent(content), blockId);
                            }
                        });
                    });
                }, 0);

                return (
                    <div
                        className={`markdown-content ${isStreaming ? 'streaming' : ''}`}
                        dangerouslySetInnerHTML={{ __html: tempDiv.innerHTML }}
                    />
                );
            } else {
                return (
                    <Typography.Paragraph className="message-content">
                        {message.text}
                    </Typography.Paragraph>
                );
            }
        },
        [copiedCodeBlock, t, copyCodeBlockToClipboard, streamingMessageId],
    );

    return (
        <div className="chat-interface-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="chat-controls">
                <label className="context-label">
                    <input
                        type="checkbox"
                        checked={useWebpageContext}
                        onChange={() => setUseWebpageContext(!useWebpageContext)}
                    />
                    <span>
                        <LinkOutlined
                            style={{ marginRight: '4px' }}
                            className={useWebpageContext ? 'enabled' : 'disabled'}
                        />
                        {t('includeWebpageContent')}
                    </span>
                </label>
            </div>
            <div className="messages-wrapper" style={{ flex: 1, overflow: 'hidden' }}>
                <div ref={messagesContainerRef} className="messages-container" style={{ overflowY: 'auto', height: '100%' }}>
                    {messages.length === 0 ? (
                        <div className="empty-chat">
                            <div className="emoji">💬</div>
                            <Typography.Text className="title">{t('aiAssistant')}</Typography.Text>
                            <Typography.Text className="message">{t('askAnything')}</Typography.Text>

                            <div className="examples">
                                <div
                                    className="example"
                                    onClick={() => handleExampleClick(t('exampleSummarize'))}
                                >
                                    {t('exampleSummarize')}
                                </div>
                                <div
                                    className="example"
                                    onClick={() => handleExampleClick(t('exampleMainPoints'))}
                                >
                                    {t('exampleMainPoints')}
                                </div>
                                <div
                                    className="example"
                                    onClick={() => handleExampleClick(t('exampleHowToUse'))}
                                >
                                    {t('exampleHowToUse')}
                                </div>
                            </div>
                        </div>
                    ) : (
                        messages.map((message) => (
                            <div
                                key={message.id}
                                className={`message-bubble message-${message.sender} ${
                                    message.id === streamingMessageId ? 'streaming-message' : ''
                                }`}
                            >
                                <Typography.Text
                                    strong
                                    className={`message-sender ${message.sender}`}
                                >
                                    {message.sender === 'user' ? t('you') : t('aiAssistant')}
                                </Typography.Text>
                                {renderMessageContent(message)}

                                {message.sender === 'ai' &&
                                    message.id !== streamingMessageId && (
                                        <div className="message-actions">
                                            <button
                                                className="action-button"
                                                onClick={() => copyToClipboard(message.text)}
                                            >
                                                <CopyOutlined /> {t('copy')}
                                            </button>
                                            <button
                                                className="action-button"
                                                onClick={regenerateResponse}
                                            >
                                                <SyncOutlined /> {t('regenerate')}
                                            </button>
                                        </div>
                                    )}
                            </div>
                        ))
                    )}

                    {isLoading && !streamingMessageId && showThinking && (
                        <div className="message-bubble message-ai thinking">
                            <Typography.Text strong className="message-sender ai">
                                {t('aiAssistant')}
                            </Typography.Text>
                            <div className="thinking-indicator">
                                <Typography.Text>{t('thinking')}</Typography.Text>
                                <span className="dot-animation">
                                    <span className="dot">.</span>
                                    <span className="dot">.</span>
                                    <span className="dot">.</span>
                                </span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} style={{ height: '1px', width: '100%' }} />
                </div>
            </div>

            <div className="input-container">
                <Input.TextArea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                    }}
                    placeholder={t('typeMessage')}
                    autoSize={{ minRows: 1, maxRows: 6 }}
                    className="message-input"
                />
                <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSendMessage}
                    loading={isLoading}
                    className={`send-button ${
                        isLoading || inputMessage.trim() === '' ? 'disabled' : 'enabled'
                    }`}
                    disabled={isLoading || inputMessage.trim() === ''}
                />
            </div>
        </div>
    );
};

export default ChatInterface;
