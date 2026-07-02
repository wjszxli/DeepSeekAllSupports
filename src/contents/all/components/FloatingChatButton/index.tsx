import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.scss';

interface FloatingChatButtonProps {
    onClick: () => void;
}

const DRAG_THRESHOLD = 5;

const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({ onClick }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [position, setPosition] = useState<{ right: number; bottom: number }>({
        right: 10,
        bottom: 20,
    });
    const [isDragging, setIsDragging] = useState(false);

    const buttonRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef({ startX: 0, startY: 0, initialRight: 0, initialBottom: 0 });
    const dragMovedRef = useRef(false);

    // 检测平台并返回对应的快捷键
    const shortcutKey = useMemo(() => {
        const userAgent = navigator.userAgent.toLowerCase();
        const platform = navigator.platform.toLowerCase();

        // 检测 Mac 平台
        if (platform.includes('mac') || userAgent.includes('mac')) {
            return '⌘ + ⇧ + Y';
        }
        // 检测 Windows 平台
        else if (platform.includes('win') || userAgent.includes('windows')) {
            return 'Ctrl + Shift + Y';
        }
        // 其他平台（Linux等）
        else {
            return 'Ctrl + Shift + Y';
        }
    }, []);

    const handleMouseMove = useCallback((moveEvent: MouseEvent) => {
        moveEvent.preventDefault();

        const deltaX = dragStartRef.current.startX - moveEvent.clientX;
        const deltaY = dragStartRef.current.startY - moveEvent.clientY;

        if (
            !dragMovedRef.current &&
            (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)
        ) {
            dragMovedRef.current = true;
            setIsDragging(true);
        }

        const buttonWidth = buttonRef.current?.offsetWidth || 50;
        const buttonHeight = buttonRef.current?.offsetHeight || 50;

        const newRight = Math.max(
            0,
            Math.min(
                dragStartRef.current.initialRight + deltaX,
                window.innerWidth - buttonWidth,
            ),
        );
        const newBottom = Math.max(
            0,
            Math.min(
                dragStartRef.current.initialBottom + deltaY,
                window.innerHeight - buttonHeight,
            ),
        );

        setPosition({ right: newRight, bottom: newBottom });
    }, []);

    const handleMouseUp = useCallback(() => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        // 延迟重置拖拽状态，避免 click 事件在 drag 后立即触发
        setTimeout(() => {
            setIsDragging(false);
        }, 0);
    }, [handleMouseMove]);

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            dragMovedRef.current = false;
            dragStartRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                initialRight: position.right,
                initialBottom: position.bottom,
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        },
        [position, handleMouseMove, handleMouseUp],
    );

    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            if (dragMovedRef.current) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            onClick();
        },
        [onClick],
    );

    // 窗口大小变化时防止按钮跑出可视区域
    useEffect(() => {
        const handleResize = () => {
            setPosition((prev) => ({
                right: Math.min(prev.right, window.innerWidth - 50),
                bottom: Math.min(prev.bottom, window.innerHeight - 50),
            }));
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <>
            {/* 悬停时显示的横向卡片 */}
            {isHovered ? (
                <div
                    className="floating-shortcut-card"
                    style={{ right: position.right + 60, bottom: position.bottom + 8 }}
                >
                    <button
                        className="shortcut-close-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsHovered(false);
                        }}
                    >
                        ×
                    </button>
                    <div className="shortcut-content">
                        <div className="shortcut-icon">
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z"
                                    fill="currentColor"
                                />
                                <circle cx="8" cy="10" r="1.5" fill="currentColor" />
                                <circle cx="12" cy="10" r="1.5" fill="currentColor" />
                                <circle cx="16" cy="10" r="1.5" fill="currentColor" />
                            </svg>
                        </div>
                        <span className="shortcut-text">{shortcutKey}</span>
                    </div>
                </div>
            ) : null}

            {/* 浮动聊天按钮 */}
            <div
                ref={buttonRef}
                className={`floating-chat-button ${isHovered ? 'hovered' : ''} ${isDragging ? 'dragging' : ''}`}
                style={{ right: position.right, bottom: position.bottom }}
                onClick={handleClick}
                onMouseDown={handleMouseDown}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                role="button"
                tabIndex={0}
                aria-label="Open chat"
            >
                <div className="chat-icon">
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z"
                            fill="currentColor"
                        />
                        <circle cx="8" cy="10" r="1.5" fill="currentColor" />
                        <circle cx="12" cy="10" r="1.5" fill="currentColor" />
                        <circle cx="16" cy="10" r="1.5" fill="currentColor" />
                    </svg>
                </div>
            </div>
        </>
    );
};

export default FloatingChatButton;
