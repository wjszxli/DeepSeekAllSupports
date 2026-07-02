import { db } from '@/db';
// import { autoRenameTopic } from '@renderer/hooks/useTopic';
import LangChainService from '@/langchain/services/LangChainService';
// import { EVENT_NAMES, EventEmitter } from '@/services/EventService';
import {
    createStreamProcessor,
    type StreamProcessorCallbacks,
} from '@/services/StreamProcessingService';
import { RobotMessageStatus, type Model, type Robot, type Topic } from '@/types';
import type { Message } from '@/types/message';
import type { MessageBlock } from '@/types/messageBlock';
import { MessageBlockStatus, MessageBlockType } from '@/types/messageBlock';
import { isAbortError } from '@/utils/error';
import {
    createRobotMessage,
    createBaseMessageBlock,
    createErrorBlock,
    createInterruptedBlock,
    resetRobotMessage,
    createMainTextBlock,
    createThinkingBlock,
    createSearchResultsBlock,
    createSearchStatusBlock,
} from '@/utils/message/create';
// import { getTopicQueue, waitForTopicQueue } from '@/utils/queue';
import { getTopicQueue, waitForTopicQueue } from '@/utils/queue';
import { throttle } from 'lodash';
import { runInAction, toJS } from 'mobx';

import type { RootStore } from '@/store';
import { abortCompletion } from '@/utils/abortController';
import { Logger } from '@/utils/logger';

const logger = new Logger('MessageService');

export class MessageService {
    private rootStore: RootStore;
    private currentAbortController: AbortController | null = null;

    constructor(rootStore: RootStore) {
        this.rootStore = rootStore;
    }

    // 取消当前流式响应
    public cancelCurrentStream(currentTopicId: string) {
        const topicMessages = this.rootStore.messageStore.getMessagesForTopic(currentTopicId);
        if (!topicMessages) return;

        const streamingMessages = topicMessages.filter(
            (message) =>
                message.status === RobotMessageStatus.PROCESSING ||
                message.status === RobotMessageStatus.PENDING,
        );

        logger.info('[MessageService] Streaming message:', streamingMessages);

        if (!streamingMessages) return;

        const askIds = [
            ...new Set(streamingMessages?.map((m) => m.askId).filter((id) => !!id) as string[]),
        ];

        for (const askId of askIds) {
            abortCompletion(askId);
        }

        runInAction(() => {
            this.rootStore.messageStore.setStreamingMessageId(null);
            this.rootStore.messageStore.setTopicLoading(currentTopicId, false);
        });
    }

    // 节流更新函数
    private throttledBlockUpdate = throttle((blockId: string, changes: Partial<MessageBlock>) => {
        runInAction(() => {
            this.rootStore.messageBlockStore.updateBlock(blockId, changes);
        });
        // 同时更新数据库
        this.saveBlockToDB(blockId);
    }, 150);

    private cancelThrottledBlockUpdate = this.throttledBlockUpdate.cancel;

    // 新增：仅保存到数据库的节流函数，不更新store
    private throttledSaveBlockToDB = throttle((blockId: string) => {
        this.saveBlockToDB(blockId);
    }, 150);

    // 保存消息和块到数据库
    private async saveMessageAndBlocksToDB(
        message: Message,
        blocks: MessageBlock[],
        messageIndex = -1,
    ) {
        try {
            if (blocks.length > 0) {
                // 序列化 MobX 对象
                const serializedBlocks = blocks.map((block) => toJS(block));
                await db.message_blocks.bulkPut(serializedBlocks);
            }

            const topic = await db.topics.get(message.topicId);
            if (topic) {
                const _messageIndex = topic.messages.findIndex((m) => m.id === message.id);
                const updatedMessages = [...topic.messages];

                const serializedMessage = toJS(message);

                if (_messageIndex !== -1) {
                    updatedMessages[_messageIndex] = serializedMessage;
                } else {
                    if (messageIndex !== -1) {
                        updatedMessages.splice(messageIndex, 0, serializedMessage);
                    } else {
                        updatedMessages.push(serializedMessage);
                    }
                }
                await db.topics.update(message.topicId, { messages: updatedMessages });
            }
        } catch (error) {
            console.error(
                `[saveMessageAndBlocksToDB] Failed to save message ${message.id}:`,
                error,
            );
        }
    }

    // 保存单个块到数据库
    private async saveBlockToDB(blockId: string) {
        const block = this.rootStore.messageBlockStore.getBlockById(blockId);
        if (block) {
            try {
                // 将 MobX 对象转换为纯 JavaScript 对象
                const serializedBlock = toJS(block);

                await db.message_blocks.put(serializedBlock);
                logger.debug(`[saveBlockToDB] Successfully saved block ${blockId} to database`);
            } catch (error) {
                logger.error(`[saveBlockToDB] Failed to save block ${blockId}:`, error);
            }
        } else {
            logger.warn(`[saveBlockToDB] Block ${blockId} not found in store`);
        }
    }

    // 保存更新到数据库
    private async saveUpdatesToDB(
        messageId: string,
        topicId: string,
        messageUpdates: Partial<Message>,
        blocksToUpdate: MessageBlock[],
    ) {
        try {
            logger.info(`[saveUpdatesToDB] Saving updates for message ${messageId}:`, {
                messageId,
                topicId,
                blocksCount: blocksToUpdate.length,
                messageUpdatesKeys: Object.keys(messageUpdates),
            });

            await db.transaction('rw', db.topics, db.message_blocks, async () => {
                if (blocksToUpdate.length > 0) {
                    // 序列化 MobX 对象
                    const serializedBlocks = blocksToUpdate.map((block) =>
                        toJS(block),
                    );

                    await db.message_blocks.bulkPut(serializedBlocks);
                    logger.info(
                        `[saveUpdatesToDB] Successfully saved ${serializedBlocks.length} blocks to database`,
                    );
                }

                if (Object.keys(messageUpdates).length > 0) {
                    await db.topics
                        .where('id')
                        .equals(topicId)
                        .modify((topic) => {
                            if (!topic) return;
                            const messageIndex = topic.messages.findIndex(
                                (m) => m.id === messageId,
                            );
                            if (messageIndex !== -1) {
                                Object.assign(topic.messages[messageIndex], messageUpdates);
                                logger.info(
                                    `[saveUpdatesToDB] Updated message ${messageId} in topic ${topicId}`,
                                );
                            }
                        });
                }
            });
        } catch (error) {
            logger.error(`[saveUpdatesToDB] Failed for message ${messageId}:`, error);
        }
    }

    async fetchAndProcessAssistantResponse(
        topicId: string,
        robot: Robot,
        assistantMessage: Message,
    ) {
        const assistantMsgId = assistantMessage.id;
        let callbacks: StreamProcessorCallbacks = {};

        // 创建新的 AbortController
        this.currentAbortController = new AbortController();
        const abortController = this.currentAbortController;

        try {
            // 1. 设置加载状态
            runInAction(() => {
                this.rootStore.messageStore.setTopicLoading(topicId, true);
            });

            // 2. 核心状态变量
            let currentBlockId: string | null = null;
            let currentBlockType: MessageBlockType | null = null;
            let accumulatedContent = '';
            let accumulatedThinkingContent = '';
            let isThinkingComplete = false; // 添加标志防止思考完成后继续处理thinking chunks

            // 3. 准备上下文消息
            const allMessages = this.rootStore.messageStore.getMessagesForTopic(topicId);
            const userMessageIndex = allMessages.findIndex(
                (m: { id: string }) => m?.id === assistantMessage.askId,
            );
            const messagesForContext =
                userMessageIndex !== -1
                    ? allMessages
                          .slice(0, userMessageIndex + 1)
                          .filter((m: { status: string }) => m && !m.status?.includes('ing'))
                    : allMessages.filter(
                          (m: { status: string }) => m && !m.status?.includes('ing'),
                      );

            // 4. 块转换处理函数
            const handleBlockTransition = async (
                newBlock: MessageBlock,
                blockType: MessageBlockType,
            ) => {
                logger.info(`[handleBlockTransition] Processing block transition:`, {
                    blockId: newBlock.id,
                    blockType,
                    messageId: newBlock.messageId,
                    status: newBlock.status,
                });

                currentBlockId = newBlock.id;
                currentBlockType = blockType;

                if (currentBlockType !== MessageBlockType.MAIN_TEXT) {
                    accumulatedContent = '';
                }

                if (currentBlockType !== MessageBlockType.THINKING) {
                    accumulatedThinkingContent = '';
                }

                // MobX 状态更新
                runInAction(() => {
                    this.rootStore.messageBlockStore.upsertBlock(newBlock);
                    this.rootStore.messageStore.upsertBlockReference(
                        assistantMsgId,
                        newBlock.id,
                        newBlock.status,
                    );
                });

                // 保存到数据库
                const updatedMessage = this.rootStore.messageStore.getMessageById(assistantMsgId);
                if (updatedMessage) {
                    logger.info(`[handleBlockTransition] Saving block and message to database:`, {
                        blockId: newBlock.id,
                        messageId: assistantMsgId,
                        blocksCount: updatedMessage.blocks.length,
                    });

                    await this.saveUpdatesToDB(
                        assistantMsgId,
                        topicId,
                        { blocks: updatedMessage.blocks },
                        [newBlock],
                    );
                } else {
                    logger.warn(
                        `[handleBlockTransition] Message ${assistantMsgId} not found in store`,
                    );
                }
            };

            // 5. 更新块内容的通用函数
            const updateBlockContent = async (content: string, status: MessageBlockStatus) => {
                if (!currentBlockId) return;

                runInAction(() => {
                    this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                        content,
                        status,
                    });
                });

                // 总是保存到数据库，不仅仅是 SUCCESS 状态
                await this.saveBlockToDB(currentBlockId);
            };

            // 6. 核心回调函数
            callbacks = {
                // 开始响应
                onLLMResponseCreated: () => {
                    runInAction(() => {
                        this.rootStore.messageStore.setStreamingMessageId(assistantMsgId);
                    });

                    const baseBlock = createBaseMessageBlock(
                        assistantMsgId,
                        MessageBlockType.UNKNOWN,
                        {
                            status: MessageBlockStatus.PROCESSING,
                        },
                    );
                    handleBlockTransition(baseBlock, MessageBlockType.UNKNOWN);
                },

                // 思考内容流处理
                onThinkingChunk: (text: string, thinking_millsec?: number) => {
                    // 如果思考已完成，跳过后续的思考块处理
                    if (isThinkingComplete) {
                        return;
                    }

                    accumulatedThinkingContent += text;

                    if (currentBlockId) {
                        if (currentBlockType === MessageBlockType.UNKNOWN) {
                            runInAction(() => {
                                this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                                    type: MessageBlockType.THINKING,
                                    content: accumulatedThinkingContent,
                                    status: MessageBlockStatus.STREAMING,
                                    thinking_millsec: thinking_millsec,
                                });
                            });
                            currentBlockType = MessageBlockType.THINKING;

                            const newBlock = createThinkingBlock(
                                assistantMsgId,
                                accumulatedThinkingContent,
                                {
                                    status: MessageBlockStatus.STREAMING,
                                    thinking_millsec: thinking_millsec,
                                },
                            );

                            this.saveUpdatesToDB(
                                assistantMsgId,
                                topicId,
                                {
                                    blocks: [],
                                },
                                [newBlock],
                            );
                        } else if (currentBlockType === MessageBlockType.THINKING) {
                            runInAction(() => {
                                this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                                    content: accumulatedThinkingContent,
                                    status: MessageBlockStatus.STREAMING,
                                    thinking_millsec: thinking_millsec,
                                });
                            });
                            this.throttledSaveBlockToDB(currentBlockId);
                        } else {
                            const newBlock = createThinkingBlock(
                                assistantMsgId,
                                accumulatedThinkingContent,
                                {
                                    status: MessageBlockStatus.STREAMING,
                                    thinking_millsec: thinking_millsec,
                                },
                            );
                            handleBlockTransition(newBlock, MessageBlockType.THINKING);
                        }
                    }
                },

                // 思考完成
                onThinkingComplete: async (finalText: string, thinking_millsec?: number) => {
                    this.cancelThrottledBlockUpdate();

                    // 设置思考完成标志，防止后续的thinking chunk覆盖状态
                    isThinkingComplete = true;

                    if (currentBlockType === MessageBlockType.THINKING && currentBlockId) {
                        runInAction(() => {
                            this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                                type: MessageBlockType.THINKING,
                                content: finalText,
                                status: MessageBlockStatus.SUCCESS,
                                thinking_millsec: thinking_millsec,
                            });
                        });

                        // 确保保存到数据库
                        await this.saveBlockToDB(currentBlockId);
                    } else {
                        console.warn(
                            `[onThinkingComplete] Received thinking.complete but last block was not THINKING (was ${currentBlockType}) or lastBlockId is null.`,
                        );
                    }
                },

                // 文本流处理
                onTextChunk: (text: string) => {
                    accumulatedContent += text;
                    if (currentBlockId) {
                        // 如果当前块是思考块，需要先完成它
                        if (currentBlockType === MessageBlockType.UNKNOWN) {
                            runInAction(() => {
                                this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                                    type: MessageBlockType.MAIN_TEXT,
                                    content: accumulatedContent,
                                    status: MessageBlockStatus.STREAMING,
                                });
                            });
                            currentBlockType = MessageBlockType.MAIN_TEXT;
                            this.throttledSaveBlockToDB(currentBlockId);
                        } else if (currentBlockType === MessageBlockType.MAIN_TEXT) {
                            runInAction(() => {
                                this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                                    content: accumulatedContent,
                                    status: MessageBlockStatus.STREAMING,
                                });
                            });
                            this.throttledSaveBlockToDB(currentBlockId);
                        } else {
                            const newBlock = createMainTextBlock(
                                assistantMsgId,
                                accumulatedContent,
                                {
                                    status: MessageBlockStatus.STREAMING,
                                },
                            );
                            handleBlockTransition(newBlock, MessageBlockType.MAIN_TEXT);
                        }
                    }
                },

                // 文本完成
                onTextComplete: async (finalText: string) => {
                    this.cancelThrottledBlockUpdate();
                    if (currentBlockType === MessageBlockType.MAIN_TEXT && currentBlockId) {
                        await updateBlockContent(finalText, MessageBlockStatus.SUCCESS);
                    }
                },

                // 搜索进行中
                onSearchInProgress: async (query: string, engine?: string) => {
                    const searchStatusBlock = createSearchStatusBlock(
                        assistantMsgId,
                        query,
                        engine,
                        {
                            status: MessageBlockStatus.STREAMING,
                        },
                    );
                    await handleBlockTransition(searchStatusBlock, MessageBlockType.SEARCH_STATUS);
                },

                // 搜索结果完成
                onSearchResultsComplete: async (
                    query: string,
                    results: Array<{
                        title: string;
                        url: string;
                        snippet: string;
                        domain: string;
                    }>,
                    engine: string,
                    contentFetched?: boolean,
                ) => {
                    logger.info(
                        `[onSearchResultsComplete] Processing search results for query: ${query}`,
                        {
                            resultsCount: results.length,
                            engine,
                            contentFetched,
                        },
                    );

                    // 移除搜索状态块
                    if (currentBlockType === MessageBlockType.SEARCH_STATUS && currentBlockId) {
                        logger.info(
                            `[onSearchResultsComplete] Removing search status block: ${currentBlockId}`,
                        );

                        // 从 store 中移除搜索状态块
                        runInAction(() => {
                            this.rootStore.messageBlockStore.removeBlock(currentBlockId!);
                            // 手动从消息的 blocks 数组中移除块引用
                            const message =
                                this.rootStore.messageStore.getMessageById(assistantMsgId);
                            if (message && message.blocks) {
                                message.blocks = message.blocks.filter(
                                    (blockId) => blockId !== currentBlockId,
                                );
                            }
                        });

                        // 从数据库中删除搜索状态块
                        await db.message_blocks.delete(currentBlockId);

                        // 更新消息的 blocks 数组
                        const updatedMessage =
                            this.rootStore.messageStore.getMessageById(assistantMsgId);
                        if (updatedMessage) {
                            await this.saveUpdatesToDB(
                                assistantMsgId,
                                topicId,
                                { blocks: updatedMessage.blocks },
                                [],
                            );
                        }
                    }

                    // 创建搜索结果块
                    const searchResultsBlock = createSearchResultsBlock(
                        assistantMsgId,
                        query,
                        results,
                        engine,
                        {
                            status: MessageBlockStatus.SUCCESS,
                            contentFetched,
                        },
                    );

                    logger.info(`[onSearchResultsComplete] Created search results block:`, {
                        blockId: searchResultsBlock.id,
                        messageId: searchResultsBlock.messageId,
                        query: searchResultsBlock.query,
                        resultsCount: searchResultsBlock.results.length,
                        engine: searchResultsBlock.engine,
                        status: searchResultsBlock.status,
                    });

                    await handleBlockTransition(
                        searchResultsBlock,
                        MessageBlockType.SEARCH_RESULTS,
                    );

                    // 确保搜索结果块立即保存到数据库
                    logger.info(
                        `[onSearchResultsComplete] Ensuring search results block is saved to database`,
                    );
                    await this.saveBlockToDB(searchResultsBlock.id);
                },

                // 错误处理
                onError: async (error: {
                    name: string;
                    message: string;
                    stack: any;
                    status?: number;
                    code?: number;
                }) => {
                    this.cancelThrottledBlockUpdate();
                    runInAction(() => {
                        this.rootStore.messageStore.setStreamingMessageId(null);
                    });
                    const isAbort = isAbortError(error);
                    if (currentBlockId) {
                        runInAction(() => {
                            this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                                status: isAbort
                                    ? MessageBlockStatus.PAUSED
                                    : MessageBlockStatus.ERROR,
                            });
                        });
                        await this.saveBlockToDB(currentBlockId);
                    }

                    if (isAbort) {
                        // 用户主动取消，创建中断状态块
                        let interruptedContent: string | undefined;

                        if (currentBlockId && currentBlockType === MessageBlockType.MAIN_TEXT) {
                            // 如果当前有正在处理的主文本块，获取已有内容
                            const currentBlock =
                                this.rootStore.messageBlockStore.getBlockById(currentBlockId);
                            if (currentBlock && 'content' in currentBlock) {
                                interruptedContent = currentBlock.content || undefined;
                            }
                        }

                        // 创建中断状态块
                        const interruptedBlock = createInterruptedBlock(
                            assistantMsgId,
                            interruptedContent,
                            {
                                status: MessageBlockStatus.SUCCESS,
                            },
                        );

                        // 先保存新的中断块到BlockStore
                        runInAction(() => {
                            this.rootStore.messageBlockStore.upsertBlock(interruptedBlock);
                        });

                        // 先同步将块保存到数据库
                        await db.message_blocks.put(toJS(interruptedBlock));

                        // 然后添加到消息的blocks引用中
                        await handleBlockTransition(interruptedBlock, MessageBlockType.INTERRUPTED);

                        // 同步更新消息状态到数据库，确保刷新后能恢复
                        const updatedMessage =
                            this.rootStore.messageStore.getMessageById(assistantMsgId);
                        if (updatedMessage) {
                            await db.transaction('rw', db.topics, async () => {
                                await db.topics
                                    .where('id')
                                    .equals(topicId)
                                    .modify((topic) => {
                                        if (!topic) return;
                                        const messageIndex = topic.messages.findIndex(
                                            (m) => m.id === assistantMsgId,
                                        );
                                        if (messageIndex !== -1) {
                                            // 深度克隆确保所有属性都被正确序列化
                                            const deepClonedMessage = toJS(updatedMessage);
                                            topic.messages[messageIndex] = deepClonedMessage;
                                        }
                                    });
                            });
                        }
                    } else {
                        // 真正的错误，创建错误块
                        const errorBlock = createErrorBlock(
                            assistantMsgId,
                            {
                                name: error.name,
                                message: error.message || 'Stream processing error',
                                stack: error.stack,
                                status: error.status || error.code,
                            },
                            { status: MessageBlockStatus.SUCCESS },
                        );
                        await handleBlockTransition(errorBlock, MessageBlockType.ERROR);
                    }

                    const messageUpdate = {
                        status: isAbort ? RobotMessageStatus.SUCCESS : RobotMessageStatus.ERROR,
                    };
                    runInAction(() => {
                        this.rootStore.messageStore.updateMessage(assistantMsgId, messageUpdate);
                    });
                    await this.saveUpdatesToDB(assistantMsgId, topicId, messageUpdate, []);
                },

                // 完成处理
                onComplete: async (status: RobotMessageStatus, response?: any) => {
                    this.cancelThrottledBlockUpdate();
                    runInAction(() => {
                        this.rootStore.messageStore.setStreamingMessageId(null);
                    });
                    if (currentBlockId && status === 'success') {
                        const currentBlock =
                            this.rootStore.messageBlockStore.getBlockById(currentBlockId);
                        if (currentBlock && currentBlock.status !== MessageBlockStatus.SUCCESS) {
                            runInAction(() => {
                                this.rootStore.messageBlockStore.updateBlock(currentBlockId!, {
                                    status: MessageBlockStatus.SUCCESS,
                                });
                            });
                            await this.saveBlockToDB(currentBlockId);
                        }
                    }
                    const messageUpdates: Partial<Message> = {
                        status,
                        metrics: response?.metrics,
                        usage: response?.usage,
                    };
                    runInAction(() => {
                        this.rootStore.messageStore.updateMessage(assistantMsgId, messageUpdates);
                    });
                    await this.saveUpdatesToDB(assistantMsgId, topicId, messageUpdates, []);
                    if (status === 'success') {
                        // autoRenameTopic(assistant, topicId);
                    }
                },
            };

            // 7. 创建流处理器并发起请求
            const streamProcessorCallbacks = createStreamProcessor(callbacks);
            await LangChainService.fetchChatCompletion({
                messages: messagesForContext,
                robot: robot,
                onChunkReceived: streamProcessorCallbacks,
                rootStore: this.rootStore,
            });
        } catch (error: any) {
            console.error('Error fetching chat completion:', error);
            if (callbacks.onError) {
                await callbacks.onError(error);
            }
        } finally {
            // Clean up any remaining blocks in PROCESSING/STREAMING state
            const message = this.rootStore.messageStore.getMessageById(assistantMsgId);
            if (message && message.blocks) {
                const blocksToCleanup: string[] = [];
                message.blocks.forEach((blockId: string) => {
                    const block = this.rootStore.messageBlockStore.getBlockById(blockId);
                    if (
                        block &&
                        (block.status === MessageBlockStatus.PROCESSING ||
                            block.status === MessageBlockStatus.STREAMING)
                    ) {
                        blocksToCleanup.push(blockId);
                    }
                });
                if (blocksToCleanup.length > 0) {
                    logger.info('[finally cleanup] Cleaning up blocks:', blocksToCleanup);
                    runInAction(() => {
                        blocksToCleanup.forEach((blockId) => {
                            this.rootStore.messageBlockStore.updateBlock(blockId, {
                                status: MessageBlockStatus.SUCCESS,
                            });
                        });
                    });
                    // Save the cleaned up blocks to database
                    for (const blockId of blocksToCleanup) {
                        await this.saveBlockToDB(blockId);
                    }
                }
            }

            // 确保更新消息状态为成功
            if (
                message &&
                (message.status === RobotMessageStatus.PROCESSING ||
                    message.status === RobotMessageStatus.PENDING)
            ) {
                const messageUpdate = {
                    status: RobotMessageStatus.SUCCESS,
                };
                runInAction(() => {
                    this.rootStore.messageStore.updateMessage(assistantMsgId, messageUpdate);
                });
                await this.saveUpdatesToDB(assistantMsgId, topicId, messageUpdate, []);
            }

            runInAction(() => {
                this.rootStore.messageStore.setTopicLoading(topicId, false);
                this.rootStore.messageStore.setStreamingMessageId(null);
            });

            // 清理 AbortController
            if (this.currentAbortController === abortController) {
                this.currentAbortController = null;
            }
        }
    }

    // 发送消息
    async sendMessage(
        userMessage: Message,
        userMessageBlocks: MessageBlock[],
        robot: Robot,
        topicId: Topic['id'],
    ) {
        try {
            if (userMessage.blocks.length === 0) {
                console.warn('sendMessage: No blocks in the provided message.');
                return;
            }

            await this.saveMessageAndBlocksToDB(userMessage, userMessageBlocks);

            runInAction(() => {
                this.rootStore.messageStore.addMessage(topicId, userMessage);
                if (userMessageBlocks.length > 0) {
                    this.rootStore.messageBlockStore.upsertManyBlocks(userMessageBlocks);
                }
            });

            const mentionedModels = userMessage.mentions;
            const queue = getTopicQueue(topicId);

            if (mentionedModels && mentionedModels.length > 0) {
                await this.dispatchMultiModelResponses(
                    topicId,
                    userMessage,
                    robot,
                    mentionedModels,
                );
            } else {
                const assistantMessage = createRobotMessage(robot.id, topicId, {
                    askId: userMessage.id,
                    model: robot.model,
                });
                await this.saveMessageAndBlocksToDB(assistantMessage, []);

                runInAction(() => {
                    this.rootStore.messageStore.addMessage(topicId, assistantMessage);
                });

                queue.add(async () => {
                    await this.fetchAndProcessAssistantResponse(topicId, robot, assistantMessage);
                });
            }
        } catch (error) {
            console.error('Error in sendMessage:', error);
        } finally {
            await this.handleChangeLoadingOfTopic(topicId);
        }
    }

    // 加载主题消息
    async loadTopicMessages(topicId: string, forceReload = false) {
        const topicMessagesExist = this.rootStore.messageStore.messageIdsByTopic.has(topicId);

        runInAction(() => {
            this.rootStore.messageStore.setCurrentTopicId(topicId);
        });

        if (topicMessagesExist && !forceReload) {
            logger.info(
                `[loadTopicMessages] Messages already loaded for topic ${topicId}, skipping`,
            );
            return;
        }

        try {
            logger.info(`[loadTopicMessages] Loading messages for topic ${topicId}`);
            const topic = await db.topics.get(topicId);
            if (!topic) {
                logger.info(`[loadTopicMessages] Topic ${topicId} not found, creating new topic`);
                await db.topics.add({ id: topicId, messages: [] });
            }

            const messagesFromDB = topic?.messages || [];
            logger.info(`[loadTopicMessages] Found ${messagesFromDB.length} messages in database`);

            if (messagesFromDB.length > 0) {
                const messageIds = messagesFromDB.map((m) => m.id);
                let blocks = await db.message_blocks.where('messageId').anyOf(messageIds).toArray();

                logger.info(
                    `[loadTopicMessages] Found ${blocks.length} blocks for ${messageIds.length} messages`,
                );

                const blocksByMessageId = new Map<string, string[]>();
                blocks.forEach((block) => {
                    if (!blocksByMessageId.has(block.messageId)) {
                        blocksByMessageId.set(block.messageId, []);
                    }
                    blocksByMessageId.get(block.messageId)!.push(block.id);
                });

                const correctedMessages = messagesFromDB.map((message) => {
                    const messageBlocks = blocksByMessageId.get(message.id) || [];
                    return {
                        ...message,
                        blocks: messageBlocks,
                    };
                });

                logger.info(
                    `[loadTopicMessages] Corrected messages with blocks:`,
                    correctedMessages.map((m) => ({
                        id: m.id,
                        role: m.role,
                        blocksCount: m.blocks?.length || 0,
                        blocks: m.blocks,
                    })),
                );

                runInAction(() => {
                    if (blocks && blocks.length > 0) {
                        // 处理重复的思考块: 为每个消息只保留一个最新/最完整的思考块
                        const messageIdToThinkingBlocks = new Map<string, MessageBlock[]>();
                        const blocksToDelete: string[] = [];

                        // 按消息ID分组收集所有思考块
                        blocks.forEach((block) => {
                            if (block.type === MessageBlockType.THINKING) {
                                if (!messageIdToThinkingBlocks.has(block.messageId)) {
                                    messageIdToThinkingBlocks.set(block.messageId, []);
                                }
                                messageIdToThinkingBlocks.get(block.messageId)!.push(block);
                            }
                        });

                        // 处理每个消息的思考块
                        messageIdToThinkingBlocks.forEach((thinkingBlocks, messageId) => {
                            if (thinkingBlocks.length > 1) {
                                logger.info(
                                    `[loadTopicMessages] Found ${thinkingBlocks.length} thinking blocks for message ${messageId}`,
                                );

                                // 根据以下条件选择最佳思考块:
                                // 1. 优先选择状态为 SUCCESS 的块
                                // 2. 如果都是 SUCCESS 或都不是，选择内容最长的
                                // 3. 如果内容长度相同，选择最新创建的
                                let bestBlock = thinkingBlocks[0];

                                for (const block of thinkingBlocks) {
                                    const bestBlockContent =
                                        'content' in bestBlock ? bestBlock.content || '' : '';
                                    const currentBlockContent =
                                        'content' in block ? block.content || '' : '';

                                    // 优先选择 SUCCESS 状态的块
                                    if (
                                        block.status === MessageBlockStatus.SUCCESS &&
                                        bestBlock.status !== MessageBlockStatus.SUCCESS
                                    ) {
                                        bestBlock = block;
                                        continue;
                                    }

                                    // 如果都是 SUCCESS 或都不是，选择内容最长的
                                    if (block.status === bestBlock.status) {
                                        if (currentBlockContent.length > bestBlockContent.length) {
                                            bestBlock = block;
                                        } else if (
                                            currentBlockContent.length === bestBlockContent.length
                                        ) {
                                            // 内容长度相同，选择最新创建的
                                            if (
                                                new Date(block.createdAt) >
                                                new Date(bestBlock.createdAt)
                                            ) {
                                                bestBlock = block;
                                            }
                                        }
                                    }
                                }

                                logger.info(
                                    `[loadTopicMessages] Selected best thinking block ${bestBlock.id} for message ${messageId}`,
                                );

                                // 将非最佳块添加到待删除列表
                                thinkingBlocks.forEach((block) => {
                                    if (block.id !== bestBlock.id) {
                                        blocksToDelete.push(block.id);
                                    }
                                });
                            }
                        });

                        // 如果有需要删除的块，从数据库中删除它们
                        if (blocksToDelete.length > 0) {
                            logger.info(
                                `[loadTopicMessages] Removing ${blocksToDelete.length} duplicate thinking blocks`,
                            );
                            // 从存储中移除多余的块
                            this.rootStore.messageBlockStore.removeManyBlocks(blocksToDelete);
                            // 从数据库中删除多余的块
                            db.message_blocks.bulkDelete(blocksToDelete).catch((error) => {
                                console.error(
                                    '[loadTopicMessages] Failed to delete duplicate thinking blocks:',
                                    error,
                                );
                            });

                            // 更新受影响消息的块列表
                            correctedMessages.forEach((message) => {
                                message.blocks = message.blocks.filter(
                                    (blockId) => !blocksToDelete.includes(blockId),
                                );
                            });

                            // 从 blocks 数组中移除已删除的块，防止后续处理重新添加它们
                            blocks = blocks.filter((block) => !blocksToDelete.includes(block.id));
                        }

                        // Clean up any stale PROCESSING/STREAMING blocks from previous sessions
                        // 但要避免清理当前正在流式处理的块
                        const currentStreamingMessageId =
                            this.rootStore.messageStore.streamingMessageId;

                        const cleanedBlocks = blocks.map((block) => {
                            // 如果当前有正在流式的消息，且这个块属于该消息，则保持其原状态
                            if (
                                currentStreamingMessageId &&
                                block.messageId === currentStreamingMessageId
                            ) {
                                return block;
                            }

                            // 否则清理过期的流式块
                            if (
                                block.status === MessageBlockStatus.PROCESSING ||
                                block.status === MessageBlockStatus.STREAMING
                            ) {
                                return {
                                    ...block,
                                    status: MessageBlockStatus.SUCCESS,
                                };
                            }
                            return block;
                        });

                        logger.info(
                            `[loadTopicMessages] Upserting ${cleanedBlocks.length} blocks to store`,
                        );
                        this.rootStore.messageBlockStore.upsertManyBlocks(cleanedBlocks);

                        // Update database with cleaned blocks if any were modified
                        const modifiedBlocks = cleanedBlocks.filter(
                            (cleanedBlock, index) => cleanedBlock.status !== blocks[index].status,
                        );
                        if (modifiedBlocks.length > 0) {
                            // Save modified blocks to database asynchronously
                            Promise.all(
                                modifiedBlocks.map((block) =>
                                    db.message_blocks.put(toJS(block)),
                                ),
                            ).catch((error) => {
                                logger.error(
                                    '[loadTopicMessages] Failed to save cleaned blocks:',
                                    error,
                                );
                            });
                        }
                    }
                    logger.info('[loadTopicMessages] Final corrected messages:', correctedMessages);
                    this.rootStore.messageStore.messagesReceived(topicId, correctedMessages);
                });
            } else {
                logger.info(`[loadTopicMessages] No messages found for topic ${topicId}`);
                runInAction(() => {
                    this.rootStore.messageStore.messagesReceived(topicId, []);
                });
            }
        } catch (error: any) {
            logger.error(
                `[loadTopicMessages] Failed to load messages for topic ${topicId}:`,
                error,
            );
        }
    }

    // 删除单个消息
    async deleteSingleMessage(topicId: string, messageId: string) {
        const messageToDelete = this.rootStore.messageStore.getMessageById(messageId);
        if (!messageToDelete || messageToDelete.topicId !== topicId) {
            logger.error(
                `[deleteSingleMessage] Message ${messageId} not found in topic ${topicId}.`,
            );
            return;
        }

        const blockIdsToDelete = messageToDelete.blocks || [];

        try {
            runInAction(() => {
                this.rootStore.messageStore.removeMessage(topicId, messageId);
                this.rootStore.messageBlockStore.removeManyBlocks(blockIdsToDelete);
            });

            await db.message_blocks.bulkDelete(blockIdsToDelete);
            const topic = await db.topics.get(topicId);
            if (topic) {
                const finalMessages = this.rootStore.messageStore.getMessagesForTopic(topicId);
                await db.topics.update(topicId, { messages: finalMessages });
            }
        } catch (error) {
            console.error(`[deleteSingleMessage] Failed to delete message ${messageId}:`, error);
        }
    }

    // 清空主题消息
    async clearTopicMessages(topicId: string) {
        try {
            const messageIds = this.rootStore.messageStore.messageIdsByTopic.get(topicId) || [];
            const blockIdsToDeleteSet = new Set<string>();

            messageIds.forEach((messageId: string) => {
                const message = this.rootStore.messageStore.getMessageById(messageId);
                message?.blocks?.forEach((blockId: string) => blockIdsToDeleteSet.add(blockId));
            });

            const blockIdsToDelete = [...blockIdsToDeleteSet];

            runInAction(() => {
                this.rootStore.messageStore.clearTopicMessages(topicId);
                if (blockIdsToDelete.length > 0) {
                    this.rootStore.messageBlockStore.removeManyBlocks(blockIdsToDelete);
                }
            });

            await db.topics.update(topicId, { messages: [] });
            if (blockIdsToDelete.length > 0) {
                await db.message_blocks.bulkDelete(blockIdsToDelete);
            }
        } catch (error) {
            console.error(
                `[clearTopicMessages] Failed to clear messages for topic ${topicId}:`,
                error,
            );
        }
    }

    // 重新生成助手响应
    async regenerateAssistantResponse(
        topicId: Topic['id'],
        assistantMessageToRegenerate: Message,
        robot: Robot,
    ) {
        try {
            const allMessages = this.rootStore.messageStore.getMessagesForTopic(topicId);
            const originalUserQuery = allMessages.find(
                (m: { id: string }) => m.id === assistantMessageToRegenerate.askId,
            );

            if (!originalUserQuery) {
                console.error(`[regenerateAssistantResponse] Original user query not found.`);
                return;
            }

            const messageToReset = this.rootStore.messageStore.getMessageById(
                assistantMessageToRegenerate.id,
            );
            if (!messageToReset) {
                console.error(`[regenerateAssistantResponse] Robot message not found.`);
                return;
            }

            const blockIdsToDelete = [...(messageToReset.blocks || [])];

            // 重置消息
            const resetAssistantMsg = resetRobotMessage(messageToReset, {
                status: RobotMessageStatus.PENDING,
                updatedAt: new Date().toISOString(),
                ...(assistantMessageToRegenerate.modelId ? {} : { model: robot.model }),
            });

            runInAction(() => {
                this.rootStore.messageStore.updateMessage(resetAssistantMsg.id, resetAssistantMsg);
                if (blockIdsToDelete.length > 0) {
                    this.rootStore.messageBlockStore.removeManyBlocks(blockIdsToDelete);
                }
            });

            // 更新数据库
            const finalMessages = this.rootStore.messageStore.getMessagesForTopic(topicId);
            const deepCleanedMessages = toJS(finalMessages);

            await db.transaction('rw', db.topics, db.message_blocks, async () => {
                await db.topics.update(topicId, { messages: deepCleanedMessages });
                if (blockIdsToDelete.length > 0) {
                    await db.message_blocks.bulkDelete(blockIdsToDelete);
                }
            });

            // 添加到队列重新生成 - 创建完全可序列化的robot配置
            const queue = getTopicQueue(topicId);

            // 深度清理robot对象，移除所有可能的循环引用和不可序列化属性
            const cleanRobot = {
                    id: robot.id,
                    name: robot.name,
                    prompt: robot.prompt,
                    type: robot.type,
                    ...(robot.icon && { icon: robot.icon }),
                    ...(robot.description && { description: robot.description }),
                    topics: [],
                    ...(robot.selectedTopicId && { selectedTopicId: robot.selectedTopicId }),
                    ...(resetAssistantMsg.model && {
                        model: {
                            id: resetAssistantMsg.model.id,
                            provider: resetAssistantMsg.model.provider,
                            name: resetAssistantMsg.model.name,
                            group: resetAssistantMsg.model.group,
                        },
                    }),
                };

            // 也要深度清理resetAssistantMsg
            const cleanResetMessage = toJS(resetAssistantMsg);

            queue.add(async () => {
                await this.fetchAndProcessAssistantResponse(topicId, cleanRobot, cleanResetMessage);
            });
        } catch (error) {
            console.error(`[regenerateAssistantResponse] Error:`, error);
        } finally {
            await this.handleChangeLoadingOfTopic(topicId);
        }
    }

    // 辅助方法
    private async handleChangeLoadingOfTopic(topicId: string) {
        await waitForTopicQueue(topicId);
        runInAction(() => {
            this.rootStore.messageStore.setTopicLoading(topicId, false);
        });
    }

    private async dispatchMultiModelResponses(
        topicId: string,
        triggeringMessage: Message,
        robot: Robot,
        mentionedModels: Model[],
    ) {
        const assistantMessageStubs: Message[] = [];

        for (const mentionedModel of mentionedModels) {
            const assistantMessage = createRobotMessage(robot.id, topicId, {
                askId: triggeringMessage.id,
                model: mentionedModel,
                modelId: mentionedModel.id,
            });
            assistantMessageStubs.push(assistantMessage);
        }

        runInAction(() => {
            assistantMessageStubs.forEach((message) => {
                this.rootStore.messageStore.addMessage(topicId, message);
            });
        });

        const topicFromDB = await db.topics.get(topicId);
        if (topicFromDB) {
            const messagesToSaveInDB = this.rootStore.messageStore.getMessagesForTopic(topicId);
            // 使用深度序列化确保对象完全可序列化
            const deepCleanedMessages = toJS(messagesToSaveInDB);
            await db.topics.update(topicId, { messages: deepCleanedMessages });
        }

        const queue = getTopicQueue(topicId);
        for (const assistantMessage of assistantMessageStubs) {
            // 创建清理的robot对象以避免序列化问题
            const cleanRobotForMention = {
                    id: robot.id,
                    name: robot.name,
                    prompt: robot.prompt,
                    type: robot.type,
                    ...(robot.icon && { icon: robot.icon }),
                    ...(robot.description && { description: robot.description }),
                    topics: [],
                    ...(robot.selectedTopicId && { selectedTopicId: robot.selectedTopicId }),
                    ...(assistantMessage.model && {
                        model: {
                            id: assistantMessage.model.id,
                            provider: assistantMessage.model.provider,
                            name: assistantMessage.model.name,
                            group: assistantMessage.model.group,
                        },
                    }),
                };

            // 清理assistant消息对象
            const cleanAssistantMessage = toJS(assistantMessage);

            queue.add(async () => {
                await this.fetchAndProcessAssistantResponse(
                    topicId,
                    cleanRobotForMention,
                    cleanAssistantMessage,
                );
            });
        }
    }
}

// 创建单例实例
let messageService: MessageService | null = null;

export const getMessageService = (rootStore: RootStore): MessageService => {
    if (!messageService) {
        messageService = new MessageService(rootStore);
    }
    return messageService;
};

export default getMessageService;
