import { CloseCircleFilled, PushpinOutlined, PushpinFilled } from '@ant-design/icons';
import { Alert, Tooltip, Typography } from 'antd';
import { useEffect, useRef, useState, useCallback } from 'react';

import { removeChatBox, removeChatButton } from '@/utils';
import storage from '@/utils/storage';

import Config from '../Config';
import ChatInterface from '../ChatInterface';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDraggable } from '@/hooks/useDraggable';

const ChatWindow = ({ x, y, text }: { x: number; y: number; text?: string }) => {
    const { t, currentLanguage } = useLanguage();
    const [isSelectProvider, setIsSelectProvider] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [position, setPosition] = useState({ x, y });
    const [size, setSize] = useState({ width: 500, height: 600 });
    const [isVisible, setIsVisible] = useState(false);
    const chatBoxRef = useRef<HTMLDivElement | null>(null);

    // 保存初始位置用于重置
    const initialPosition = useRef({ x, y });

    const initData = async () => {
        try {
            await storage.remove('chatHistory');
            const config = await storage.getConfig();
            if (!config.selectedProvider) return;

            setIsSelectProvider(true);

            const { width, height } = await storage.getChatBoxSize();
            setSize({ width: width || 500, height: height || 600 });

            // Start the animation after initialization
            setTimeout(() => setIsVisible(true), 50);
        } catch (error) {
            console.error('Failed to initialize data:', error);
        }
    };

    // 恢复 onCancel 方法，用于中止请求
    const onCancel = () => {
        try {
            // @ts-ignore
            window.currentAbortController.abort();
            // @ts-ignore
            window.currentAbortController = null;
        } catch (error) {
            console.error('Failed to abort:', error);
        }
    };

    useEffect(() => {
        initData();
        // 保证组件挂载时可以正确设置位置
        setPosition(initialPosition.current);

        // 确保窗口在可视区域内
        ensureWindowVisible();

        // 添加 ESC 键监听
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel();
                removeChatBox();
                removeChatButton();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);

            // 组件卸载时中止任何未完成的请求
            onCancel();
        };
    }, []);

    // 确保窗口在可视区域内，增加节流控制
    const ensureWindowVisible = useCallback(() => {
        // 如果正在拖拽，不执行边界检查
        if (chatBoxRef.current?.classList.contains('dragging')) return;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let newX = position.x;
        let newY = position.y;

        // 检查是否超出右边界
        if (newX + size.width > viewportWidth) {
            newX = viewportWidth - size.width - 20;
        }

        // 检查是否超出左边界
        if (newX < 0) {
            newX = 20;
        }

        // 检查是否超出底部
        if (newY + size.height > viewportHeight) {
            newY = viewportHeight - size.height - 20;
        }

        // 检查是否超出顶部
        if (newY < 0) {
            newY = 20;
        }

        // 只有当位置真正改变时才更新状态
        if (Math.abs(newX - position.x) > 1 || Math.abs(newY - position.y) > 1) {
            setPosition({ x: newX, y: newY });
        }
    }, [position.x, position.y, size.width, size.height]);

    // 监听语言变更
    useEffect(() => {
        // 强制组件更新以反映新语言
        if (chatBoxRef.current) {
            // 强制重新渲染整个聊天窗口
            setIsVisible(false);
            setTimeout(() => {
                setIsVisible(true);
            }, 10);
            
            // 触发事件让子组件知道语言已变更
            window.dispatchEvent(new CustomEvent('languageUpdated', { detail: { locale: currentLanguage } }));
        }
    }, [currentLanguage]);

    // 语言变更时保持位置不变，现在使用 currentLanguage
    useEffect(() => {
        ensureWindowVisible();
    }, [currentLanguage, ensureWindowVisible]);

    const { handleMouseDown: dragHandleMouseDown } = useDraggable({ x, y }, chatBoxRef, isPinned);

    const handleResizeMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const startSize = { ...size };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = startSize.width + (moveEvent.clientX - startX);
            const newHeight = startSize.height + (moveEvent.clientY - startY);
            if (newWidth < 360 || newHeight < 400) return;
            setSize({ width: newWidth, height: newHeight });
            storage.setChatBoxSize({ width: newWidth, height: newHeight });
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    useEffect(() => {
        // 监控窗口大小变化
        if (chatBoxRef.current) {
            const resizeObserver = new ResizeObserver(() => {
                ensureWindowVisible();
            });

            resizeObserver.observe(chatBoxRef.current);

            return () => {
                resizeObserver.disconnect();
            };
        }

        return () => {};
    }, []);

    useEffect(() => {
        const handleMaintainPosition = () => {
            // 强制重新应用当前位置
            const currentPos = { ...position };
            setPosition({ x: -9999, y: -9999 });
            setTimeout(() => {
                setPosition(currentPos);
            }, 50);
        };

        window.addEventListener('maintainChatPosition', handleMaintainPosition);

        return () => {
            window.removeEventListener('maintainChatPosition', handleMaintainPosition);
        };
    }, [position]);

    return (
        <div
            ref={chatBoxRef}
            className={`ai-chat-box ${isVisible ? 'visible' : ''}`}
            style={{
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08), 0 6px 12px rgba(0, 0, 0, 0.05)',
                overflow: 'hidden',
                zIndex: 2147483647,
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translate3d(0, 0, 0)' : 'translate3d(0, 20px, 0)',
                transition: 'opacity 0.3s ease',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
                border: '1px solid rgba(229, 231, 235, 0.8)',
            }}
        >
            <div
                className="chat-window-header"
                id="chatBoxHeader"
                onMouseDown={dragHandleMouseDown}
            >
                <Typography.Text strong style={{ fontSize: '14px', color: '#2c3e50' }}>
                    {t('assistant')}
                </Typography.Text>

                <div className="chat-window-actions">
                    <Tooltip title={isPinned ? 'Unpin' : 'Pin'} placement="bottom">
                        <div
                            className="header-action-button pin-button"
                            onClick={async () => {
                                setIsPinned(!isPinned);
                            }}
                        >
                            {isPinned ? (
                                <PushpinFilled style={{ fontSize: 16 }} />
                            ) : (
                                <PushpinOutlined style={{ fontSize: 16 }} />
                            )}
                        </div>
                    </Tooltip>

                    <Tooltip title={t('close')} placement="bottom">
                        <div
                            className="header-action-button close-button"
                            onClick={() => {
                                setIsSelectProvider(false);
                                removeChatButton();
                                removeChatBox();
                            }}
                        >
                            <CloseCircleFilled style={{ fontSize: 16 }} />
                        </div>
                    </Tooltip>
                </div>
            </div>

            {!isSelectProvider ? (
                <div className="provider-alert-container">
                    <Alert type="info" message={t('selectProviderFirst')} showIcon />
                </div>
            ) : (
                <div className="chat-content-container">
                    <ChatInterface initialText={text} />
                </div>
            )}

            <Config
                width={size.width}
                height={size.height}
                parentInitData={initData}
                onCancel={onCancel}
            />

            <div className="resize-handle" onMouseDown={handleResizeMouseDown} />
        </div>
    );
};

export default ChatWindow;
