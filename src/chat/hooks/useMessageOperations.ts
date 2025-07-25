import { useCallback } from 'react';
import { Message } from '@/types/message';
import { MessageBlockType, MessageBlockStatus } from '@/types/messageBlock';
import rootStore from '@/store';
import robotStore from '@/store/robot';
import { getMessageService } from '@/services/MessageService';
import { message as AntdMessage } from 'antd';
import { t } from '@/locales/i18n';
import { Logger } from '@/utils/logger';
import { Robot } from '@/types';

export const useMessageOperations = (streamingMessageId: string | null, selectedRobot?: Robot) => {
    const logger = new Logger('useMessageOperations');

    // 获取机器人实例，优先使用传入的参数
    const currentRobot = selectedRobot || robotStore.selectedRobot;

    // 获取消息的正文内容（不包含思考内容）
    const getMessageContent = useCallback((message: Message): string => {
        if (!message.blocks || message.blocks.length === 0) {
            return '';
        }

        const blocks = message.blocks
            .map((blockId) => {
                const block = rootStore.messageBlockStore.getBlockById(blockId);
                if (!block) {
                    logger.warn(`Block ${blockId} not found in store`);
                }
                return block;
            })
            .filter(Boolean);

        if (blocks.length === 0) {
            logger.warn(`No valid blocks found for message ${message.id}`);
            return '';
        }

        // 只获取正文内容，不包含思考内容
        const content = blocks
            .filter((block): block is NonNullable<typeof block> => {
                if (!block) return false;

                // 只包含正文内容类型的块，明确排除 THINKING 类型，包含中断块
                const hasContent =
                    block.type === MessageBlockType.MAIN_TEXT ||
                    block.type === MessageBlockType.CODE ||
                    block.type === MessageBlockType.INTERRUPTED;
                const hasContentProperty = 'content' in block;

                return hasContent && hasContentProperty;
            })
            .map((block) => {
                const content = (block as any).content || '';
                return content;
            })
            .join('');

        return content;
    }, []);

    // 获取消息的思考内容
    const getMessageThinking = useCallback((message: Message): string => {
        if (!message.blocks || message.blocks.length === 0) {
            return '';
        }

        const blocks = message.blocks
            .map((blockId) => {
                const block = rootStore.messageBlockStore.getBlockById(blockId);
                return block;
            })
            .filter(Boolean);

        // 只获取思考内容
        const thinkingContent = blocks
            .filter((block): block is NonNullable<typeof block> => {
                if (!block) return false;
                return block.type === MessageBlockType.THINKING && 'content' in block;
            })
            .map((block) => {
                const content = (block as any).content || '';
                return content;
            })
            .join('');

        return thinkingContent;
    }, []);

    const getMessageError = useCallback((message: Message): string => {
        if (!message.blocks || message.blocks.length === 0) {
            return '';
        }

        const blocks = message.blocks
            .map((blockId) => {
                const block = rootStore.messageBlockStore.getBlockById(blockId);
                return block;
            })
            .filter(Boolean);

        const errorContent = blocks
            .filter((block): block is NonNullable<typeof block> => {
                if (!block) return false;
                return block.type === MessageBlockType.ERROR && 'error' in block;
            })
            .map((block) => {
                const error = (block as any).error.message || '未知错误';
                return error;
            })
            .join('');

        return errorContent;
    }, []);

    // 检查消息是否正在流式显示
    const isMessageStreaming = useCallback(
        (message: Message): boolean => {
            // 首先检查是否是当前流式消息
            if (streamingMessageId && streamingMessageId === message.id) {
                return true;
            }

            // 其次检查消息的块是否有流式状态
            if (message.blocks && message.blocks.length > 0) {
                // 直接从 store 获取最新的块状态
                const hasStreamingBlock = message.blocks.some((blockId) => {
                    const block = rootStore.messageBlockStore.getBlockById(blockId);
                    if (!block) {
                        logger.warn(`Block ${blockId} not found in store`);
                        return false;
                    }
                    // 检查块是否处于流式状态
                    const isStreaming =
                        block.status === MessageBlockStatus.STREAMING ||
                        block.status === MessageBlockStatus.PROCESSING;

                    return isStreaming;
                });

                return hasStreamingBlock;
            }

            return false;
        },
        [streamingMessageId],
    );

    // 复制消息内容
    const handleCopyMessage = useCallback((text: string) => {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                AntdMessage.success(t('copied') || '已复制', 2);
            })
            .catch(() => {
                AntdMessage.error(t('failedCopy') || '复制失败');
            });
    }, []);

    // 重新生成响应
    const handleRegenerateResponse = useCallback(
        (assistantMessage: Message) => {
            try {
                // 使用当前机器人获取话题ID
                const selectedTopicId = currentRobot?.selectedTopicId;
                if (!selectedTopicId) {
                    logger.error('No selected topic');
                    AntdMessage.error(t('errorRegenerating') || '重新生成失败：未选择话题');
                    return;
                }

                // 使用当前机器人配置
                const robot = currentRobot;
                if (!robot) {
                    logger.error('No selected robot');
                    AntdMessage.error(t('errorRegenerating') || '重新生成失败：未选择机器人');
                    return;
                }

                // 检查是否是助手消息
                if (assistantMessage.role !== 'assistant') {
                    logger.error('Message is not from assistant');
                    AntdMessage.error(
                        t('errorRegenerating') || '重新生成失败：只能重新生成助手消息',
                    );
                    return;
                }

                // 使用独立的 MessageService 调用重新生成
                const messageService = getMessageService(rootStore);
                messageService.regenerateAssistantResponse(
                    selectedTopicId,
                    assistantMessage,
                    robot,
                );

                AntdMessage.info(t('regenerating') || '正在重新生成...', 2);
            } catch (error) {
                logger.error('Error during regeneration:', error);
                AntdMessage.error(t('errorRegenerating') || '重新生成失败');
            }
        },
        [currentRobot],
    );

    // 删除单条消息
    const handleDeleteMessage = useCallback(
        (message: Message) => {
            try {
                // 使用当前机器人获取话题ID
                const selectedTopicId = currentRobot?.selectedTopicId;
                if (!selectedTopicId) {
                    logger.error('No selected topic');
                    AntdMessage.error('删除失败：未选择话题');
                    return;
                }

                // 使用MessageService删除消息
                const messageService = getMessageService(rootStore);
                messageService.deleteSingleMessage(selectedTopicId, message.id);

                AntdMessage.success('消息已删除', 2);
            } catch (error) {
                logger.error('Error during message deletion:', error);
                AntdMessage.error('删除消息失败');
            }
        },
        [currentRobot],
    );

    return {
        getMessageContent,
        getMessageThinking,
        isMessageStreaming,
        handleCopyMessage,
        handleRegenerateResponse,
        handleDeleteMessage,
        getMessageError,
    };
};
