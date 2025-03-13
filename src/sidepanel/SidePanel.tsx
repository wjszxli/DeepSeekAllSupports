import React, { useState, useRef, FormEvent } from 'react';
import { Button, Input, Spin, Typography, Tooltip } from 'antd';
import {
    SendOutlined,
    ClearOutlined,
    ReloadOutlined,
    StopOutlined,
    CopyOutlined,
} from '@ant-design/icons';
import { useChatMessages } from '../hooks/useChatMessages';
import { useLanguage } from '../contexts/LanguageContext';
import MarkdownIt from 'markdown-it';
import mathjax3 from 'markdown-it-mathjax3';
import './SidePanel.scss';

const { TextArea } = Input;
const { Text } = Typography;

// Initialize markdown-it instance
const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
});

// Add mathjax support
md.use(mathjax3);

const SidePanel: React.FC = () => {
    const { t } = useLanguage();
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const {
        messages,
        isLoading,
        streamingMessageId,
        messagesWrapperRef,
        copyToClipboard,
        cancelStreamingResponse,
        sendChatMessage,
        regenerateResponse,
        clearMessages,
    } = useChatMessages({
        t,
        storeType: 'interface',
        conversationId: 'sidepanel',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isLoading) {
            sendChatMessage(inputValue);
            setInputValue('');
        }
    };

    // Function to render markdown content
    const renderMarkdown = (content: string) => {
        return md.render(content);
    };

    return (
        <div className="side-panel">
            <div className="chat-header">
                <Text strong>{t('chatWithAI')}</Text>
                <Tooltip title={t('clearChat')}>
                    <Button
                        type="text"
                        size="small"
                        icon={<ClearOutlined />}
                        onClick={clearMessages}
                    />
                </Tooltip>
            </div>

            <div className="chat-messages" ref={messagesWrapperRef}>
                {messages.length === 0 ? (
                    <div className="empty-chat-message">
                        <Text type="secondary">{t('startChat')}</Text>
                    </div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={`message ${
                                message.sender === 'user' ? 'user-message' : 'ai-message'
                            }`}
                        >
                            <div className="message-header">
                                <Text strong>{message.sender === 'user' ? t('you') : t('ai')}</Text>
                                {message.sender === 'ai' && (
                                    <div className="message-actions">
                                        <Tooltip title={t('copy')}>
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<CopyOutlined />}
                                                onClick={() => copyToClipboard(message.text)}
                                            />
                                        </Tooltip>
                                    </div>
                                )}
                            </div>
                            <div className="message-content">
                                {message.sender === 'user' ? (
                                    <Text>{message.text}</Text>
                                ) : (
                                    <div
                                        className="markdown-content"
                                        dangerouslySetInnerHTML={{
                                            __html: renderMarkdown(message.text),
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    ))
                )}
                {isLoading && streamingMessageId === null && (
                    <div className="loading-indicator">
                        <Spin size="small" />
                        <Text type="secondary">{t('thinking')}</Text>
                    </div>
                )}
            </div>

            <div className="chat-input-container">
                {streamingMessageId !== null && (
                    <Button
                        className="stop-button"
                        type="default"
                        icon={<StopOutlined />}
                        onClick={cancelStreamingResponse}
                    >
                        {t('stop')}
                    </Button>
                )}

                {!isLoading && messages.length > 0 && (
                    <Button
                        className="regenerate-button"
                        type="default"
                        icon={<ReloadOutlined />}
                        onClick={regenerateResponse}
                    >
                        {t('regenerate')}
                    </Button>
                )}

                <form onSubmit={handleSubmit} className="chat-form">
                    <TextArea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={t('typeMessage')}
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        disabled={isLoading}
                        onPressEnter={(e) => {
                            if (!e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                    />
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SendOutlined />}
                        disabled={!inputValue.trim() || isLoading}
                    />
                </form>
            </div>
        </div>
    );
};

export default SidePanel;
