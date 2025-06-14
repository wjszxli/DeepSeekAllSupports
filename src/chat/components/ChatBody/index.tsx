import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Tooltip } from 'antd';
import { SendOutlined, CloseCircleOutlined } from '@ant-design/icons';

import { t } from '@/locales/i18n';

import './index.scss';
import { Message } from '@/types/message';
import robotStore from '@/store/robot';

import rootStore from '@/store';
import { observer } from 'mobx-react-lite';
import MessageList from '../MessageList';
import { useMessageSender } from '@/chat/hooks/useMessageSender';
import { getMessageService } from '@/services/MessageService';

const { TextArea } = Input;

interface ChatBodyProps {
    selectedProvider: string;
    userInput: string;
    setUserInput: (value: string) => void;
}

const ChatBody: React.FC<ChatBodyProps> = observer(
    ({ selectedProvider, userInput, setUserInput }) => {
        const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
        const [isLoading, setIsLoading] = useState(false);
        const inputRef = useRef<any>(null);

        // 使用 robotStore 的 selectedRobot 的 selectedTopicId（现在是从 robotDB 中获取的）
        const selectedTopicId = useMemo(
            () => robotStore.selectedRobot?.selectedTopicId || '',
            [robotStore.selectedRobot?.selectedTopicId],
        );

        const messages = useMemo(() => {
            const data = rootStore.messageStore.getMessagesForTopic(selectedTopicId || '');
            return data;
        }, [
            selectedTopicId,
            rootStore.messageStore.messages.size,
            rootStore.messageBlockStore.blocks.size,
        ]);

        const streamingMessageId = rootStore.messageStore.streamingMessageId;

        // 使用消息发送 hook
        const { handleSendMessage: sendMessage } = useMessageSender();

        // 获取 MessageService 实例
        const messageService = useMemo(() => getMessageService(rootStore), []);

        const computeDisplayMessages = useCallback((messages: Message[], displayCount: number) => {
            const orderedMessages = [...messages];
            if (orderedMessages.length <= displayCount) {
                return orderedMessages;
            }
            const startIdx = Math.max(0, orderedMessages.length - displayCount);
            return orderedMessages.slice(startIdx);
        }, []);

        useEffect(() => {
            const newDisplayMessages = computeDisplayMessages(messages, 100);
            setDisplayMessages(newDisplayMessages);
        }, [messages, computeDisplayMessages]);

        const cancelStreamingResponse = useCallback(() => {
            console.log(
                '[ChatBody] Cancel streaming response called, streamingMessageId:',
                streamingMessageId,
            );

            // 使用独立的 MessageService 来正确取消流式响应
            messageService.cancelCurrentStream(selectedTopicId);

            // cancelCurrentStream 已经设置了 streamingMessageId 为 null，不需要重复设置
            setIsLoading(false);

            console.log('[ChatBody] Cancel streaming response completed');
        }, [streamingMessageId, messageService]);

        // 当话题变化时加载消息
        useEffect(() => {
            if (selectedTopicId) {
                // 只有在没有正在流式处理的消息时才重新加载
                // 避免在流式过程中清理当前的流式块
                if (!streamingMessageId) {
                    messageService.loadTopicMessages(selectedTopicId);
                }
            }
        }, [selectedTopicId, streamingMessageId, messageService]);

        const handleSendMessage = () => {
            if (!userInput.trim() || isLoading) return;

            sendMessage(userInput, () => {
                setUserInput('');
            });
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        };

        // 编辑消息
        const handleEditMessage = useCallback(
            (text: string) => {
                setUserInput(text);
                if (inputRef.current) {
                    inputRef.current.focus();
                }
            },
            [setUserInput],
        );

        return (
            <div className="chat-body">
                <MessageList
                    messages={displayMessages}
                    selectedProvider={selectedProvider}
                    onEditMessage={handleEditMessage}
                />
                <div className="chat-footer">
                    <div className="input-container">
                        <TextArea
                            ref={inputRef}
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('typeMessage') || '输入您的问题...'}
                            autoSize={{ minRows: 1, maxRows: 5 }}
                            disabled={isLoading && streamingMessageId === null}
                        />
                        <div className="input-actions">
                            <Tooltip
                                title={
                                    streamingMessageId !== null
                                        ? t('stop') || '停止'
                                        : userInput.trim()
                                        ? t('sendMessage') || '发送'
                                        : t('enterQuestion') || '请输入问题'
                                }
                            >
                                <Button
                                    className={
                                        streamingMessageId !== null ? 'stop-button' : 'send-button'
                                    }
                                    type={streamingMessageId !== null ? 'default' : 'primary'}
                                    icon={
                                        streamingMessageId !== null ? (
                                            <CloseCircleOutlined />
                                        ) : (
                                            <SendOutlined />
                                        )
                                    }
                                    onClick={
                                        streamingMessageId !== null
                                            ? cancelStreamingResponse
                                            : handleSendMessage
                                    }
                                    disabled={
                                        !streamingMessageId && (!userInput.trim() || isLoading)
                                    }
                                >
                                    {streamingMessageId !== null
                                        ? t('stop') || '停止'
                                        : t('send') || '发送'}
                                </Button>
                            </Tooltip>
                        </div>
                    </div>
                </div>
            </div>
        );
    },
);

export default ChatBody;
