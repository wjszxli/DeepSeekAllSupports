import { createRoot } from 'react-dom/client';

import { removeChatBox, removeChatButton, removeFloatingChatButton } from '@/utils';
import { CHAT_BOX_ID, CHAT_BUTTON_ID, FLOATING_CHAT_BUTTON_ID } from '@/utils/constant';
import storage from '@/utils/storage';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { setLocale } from '@/locales/i18n';
import type { LocaleType } from '@/locales';
import { initLogger, Logger } from '@/utils/logger';

import ChatWindow from '@/contents/chat-windows';
import { IframeSidePanelManager } from './components/IframeSidePanel/index';
import FloatingChatButton from './components/FloatingChatButton';
import './styles/animations.css';
import './styles/highlight.css';

// 延迟创建Logger实例，避免初始化顺序问题
let logger: Logger;

// 初始化Logger
initLogger()
    .then((config) => {
        // 在initLogger完成后创建Logger实例
        logger = new Logger('content-script');
        logger.debug('Content script logger initialized', config);
    })
    .catch((error) => {
        console.error('Failed to initialize logger in content script:', error);
    });

// Add debounce utility at the top of the file
const debounce = <F extends (...args: any[]) => any>(
    func: F,
    waitFor: number,
): ((...args: Parameters<F>) => void) => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<F>): void => {
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => func(...args), waitFor);
    };
};

// 计算聊天窗口居中位置的函数
const calculateCenterPosition = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const chatWidth = 600;
    const chatHeight = 800;

    const centerX = Math.max(0, (viewportWidth - chatWidth) / 2);
    const centerY = Math.max(0, (viewportHeight - chatHeight) / 2);

    return { x: centerX, y: centerY };
};

// 初始化语言设置
(async () => {
    try {
        const savedLocale = await storage.getLocale();
        if (
            savedLocale &&
            ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'ru', 'es', 'fr', 'de'].includes(savedLocale)
        ) {
            await setLocale(savedLocale as LocaleType);
            console.info('Initialized locale from storage:', savedLocale);
        }
    } catch (error) {
        console.error('Failed to initialize locale:', error);
    }
})();

// 监听来自扩展程序的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'localeChanged' && message.locale) {
        // 更新语言设置
        setLocale(message.locale)
            .then(() => {
                logger.debug('Content script locale updated:', message.locale);
                sendResponse({ success: true });
            })
            .catch((error) => {
                console.error('Failed to update locale in content script:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    // 处理提供商设置更新
    if (message.action === 'providerSettingsUpdated') {
        logger.debug('Provider settings updated in content script');
        // 通知UI组件刷新
        window.dispatchEvent(
            new CustomEvent('providerSettingsUpdated', {
                detail: { provider: message.provider },
            }),
        );
        sendResponse({ success: true });
        return true;
    }

    if (message.action === 'openChatWindow') {
        const selectedText = message.selectedText || '';
        logger.debug('Opening chat window with selected text:', selectedText);

        // 计算真正的居中位置
        const { x: centerX, y: centerY } = calculateCenterPosition();

        // 先移除已存在的聊天窗口和按钮
        removeChatButton();
        removeChatBox();

        // 注入聊天窗口到页面中心
        injectChatBox(centerX, centerY, selectedText, true);
        sendResponse({ success: true });
        return true;
    }

    // 处理 iframe 侧边栏创建请求
    if (message.action === 'createIframeSidePanel') {
        logger.debug('Creating iframe side panel');

        try {
            // 显示 iframe 侧边栏
            IframeSidePanelManager.show();
            sendResponse({ success: true });
        } catch (error: unknown) {
            console.error('Failed to create iframe side panel:', error);
            sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }

        return true;
    }

    // 处理总结当前页面请求
    if (message.action === 'summarizeCurrentPage') {
        try {
            // 显示 iframe 侧边栏并触发总结功能
            IframeSidePanelManager.showWithSummarize();
            sendResponse({ success: true });
        } catch (error: unknown) {
            console.error('Failed to summarize current page:', error);
            sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }

        return true;
    }

    // 处理浮动聊天按钮显示/隐藏设置变化
    if (message.action === 'floatingButtonSettingsChanged') {
        const isEnabled = message.enabled;
        if (isEnabled) {
            injectFloatingChatButton();
        } else {
            removeFloatingChatButton();
        }
        sendResponse({ success: true });
        return true;
    }

    return false;
});

// 监听选中文字
document.addEventListener(
    'mouseup',
    debounce(async (event) => {
        // Chat button should not appear right after clicking on an element
        if (event.target && (event.target as Element).id === CHAT_BUTTON_ID) {
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === '') {
            removeChatButton();
            return;
        }

        const chatBoxExists = document.getElementById(CHAT_BOX_ID);
        if (chatBoxExists) {
            return;
        }

        const text = selection.toString();
        const { clientX, clientY } = event;

        const isIcon = await storage.getIsChatBoxIcon();
        if (!isIcon) {
            return;
        }

        injectChatButton(clientX, clientY, text);
    }, 100),
    { passive: true },
);

// 在选中文字后插入按钮
const injectChatButton = (x: number, y: number, text: string) => {
    let chatButton = document.getElementById(CHAT_BUTTON_ID) as HTMLImageElement;
    if (!chatButton) {
        chatButton = document.createElement('img');
        chatButton.id = CHAT_BUTTON_ID;
        chatButton.src = chrome.runtime.getURL('icons/icon48.png');
        chatButton.style.position = 'absolute';
        chatButton.style.width = '40px';
        chatButton.style.height = '40px';
        chatButton.style.cursor = 'pointer';
        chatButton.style.zIndex = '9999';
        chatButton.style.borderRadius = '50%';
        chatButton.style.background = 'white';
        chatButton.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
        chatButton.style.padding = '5px';

        document.body.append(chatButton);
    }

    chatButton.style.top = `${y}px`;
    chatButton.style.left = `${x}px`;

    // Remove any existing click listeners to prevent multiple handlers
    const newButton = chatButton.cloneNode(true) as HTMLImageElement;
    chatButton.parentNode?.replaceChild(newButton, chatButton);
    chatButton = newButton;

    chatButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Clear text selection first to prevent mouseup from reinjecting the button
        window.getSelection()?.removeAllRanges();

        // Use setTimeout to ensure the selection clear takes effect before we remove the button
        setTimeout(() => {
            removeChatButton();
            injectChatBox(x, y, text);
        }, 0);
    });
};

// 在选中文字后插入对话框
const injectChatBox = (x: number, y: number, text: string, isCentered: boolean = false) => {
    // 保存当前滚动位置
    const scrollPos = {
        x: window.scrollX,
        y: window.scrollY,
    };

    // First, ensure the chat button is removed and the text selection is cleared
    removeChatButton();
    window.getSelection()?.removeAllRanges();

    let centerX = x;
    let centerY = y;

    // 如果不是预计算的居中位置，则进行位置调整
    if (!isCentered) {
        // 确保位置在视图区域内
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const chatWidth = 600;
        const chatHeight = 800;

        // 计算调整后的位置
        centerX = Math.max(0, Math.min(x, viewportWidth - chatWidth - 20));
        centerY = Math.max(0, Math.min(y, viewportHeight - chatHeight - 20));

        // 如果位置在视图之外，则使用居中位置
        if (x < 0 || x > viewportWidth || y < 0 || y > viewportHeight) {
            const centeredPos = calculateCenterPosition();
            centerX = centeredPos.x;
            centerY = centeredPos.y;
        }
    }

    let chatContainer = document.getElementById(CHAT_BOX_ID);
    if (!chatContainer) {
        chatContainer = document.createElement('div');
        chatContainer.id = CHAT_BOX_ID;
        document.body.append(chatContainer);
    }

    // 渲染聊天组件
    const root = createRoot(chatContainer);
    root.render(
        <LanguageProvider>
            <ChatWindow x={centerX} y={centerY} text={text} />
        </LanguageProvider>,
    );

    // 恢复滚动位置
    setTimeout(() => {
        window.scrollTo(scrollPos.x, scrollPos.y);
    }, 0);
};

// 监听 ESC 关闭聊天窗口
document.addEventListener('keydown', async (event) => {
    if (event.key === 'Escape') {
        removeChatBox();
        removeChatButton();
    }
});

// 注入浮动聊天按钮
const injectFloatingChatButton = () => {
    const isExist = document.getElementById(FLOATING_CHAT_BUTTON_ID);
    // 检查是否已经存在浮动按钮
    if (isExist) {
        return;
    }

    // 创建浮动按钮容器
    const floatingButtonContainer = document.createElement('div');
    floatingButtonContainer.id = FLOATING_CHAT_BUTTON_ID;
    document.body.appendChild(floatingButtonContainer);

    // 渲染浮动聊天按钮
    const root = createRoot(floatingButtonContainer);
    root.render(
        <LanguageProvider>
            <FloatingChatButton
                onClick={() => {
                    // 点击浮动按钮时打开聊天窗口，显示在页面中心
                    const { x: centerX, y: centerY } = calculateCenterPosition();

                    // 移除已存在的聊天窗口和按钮
                    removeChatButton();
                    removeChatBox();

                    // 注入聊天窗口到页面中心
                    injectChatBox(centerX, centerY, '', true);
                }}
            />
        </LanguageProvider>,
    );
};

// 初始化浮动聊天按钮
const initializeFloatingButton = async () => {
    try {
        // 检查是否启用了聊天按钮功能
        const isIcon = await storage.getIsChatBoxIcon();
        if (isIcon) {
            injectFloatingChatButton();
        }
    } catch (error) {
        console.error('Error initializing floating chat button:', error);
    }
};

// 页面加载完成后初始化浮动按钮
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFloatingButton);
} else {
    // 如果页面已经加载完成
    initializeFloatingButton();
}
