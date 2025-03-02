import { createRoot } from 'react-dom/client';

import { removeChatBox, removeChatButton } from '@/utils';
import { CHAT_BOX_ID, CHAT_BUTTON_ID } from '@/utils/constant';
import storage from '@/utils/storage';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { i18n, setLocale } from '@/services/i18n';

import ChatWindow from './components/ChatWindow';
import './styles/animations.css';

// 监听来自扩展程序的消息
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'languageChanged' && message.locale) {
        // 更新语言设置
        setLocale(message.locale).catch(console.error);
        
        // 触发UI更新
        window.dispatchEvent(new CustomEvent('translationUpdate', { 
            detail: { locale: message.locale } 
        }));
    }
    return true;
});

// 监听选中文字
document.addEventListener(
    'mouseup',
    async (event) => {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === '') {
            removeChatButton();
            return;
        }

        const text = selection.toString();
        const { clientX, clientY } = event;

        const isIcon = await storage.getIsChatBoxIcon();
        if (!isIcon) {
            return;
        }

        injectChatButton(clientX, clientY, text);
    },
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

    chatButton.style.top = `${y + 5}px`;

    chatButton.style.left = `${x + 5}px`;

    chatButton.addEventListener('click', () => {
        injectChatBox(x, y, text);
    });
};

// 在选中文字后插入对话框
const injectChatBox = (x: number, y: number, text: string) => {
    // 保存当前滚动位置
    const scrollPos = {
        x: window.scrollX,
        y: window.scrollY,
    };

    // 确保位置在视图区域内
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const chatWidth = 500;
    const chatHeight = 600;

    // 计算居中位置
    let centerX = Math.max(0, Math.min(x, viewportWidth - chatWidth - 20));
    let centerY = Math.max(0, Math.min(y, viewportHeight - chatHeight - 20));

    // 如果位置在视图之外，则使用居中位置
    if (x < 0 || x > viewportWidth || y < 0 || y > viewportHeight) {
        centerX = (viewportWidth - chatWidth) / 2;
        centerY = (viewportHeight - chatHeight) / 2;
    }

    removeChatBox();
    removeChatButton();

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

// Listen for extension messages
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'localeChanged' && message.locale) {
        // Update the i18n service locale
        i18n.setLocale(message.locale);
    }

    if (message.action === 'openChatWindow') {
        const { selectedText } = message;

        // Calculate center position
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const chatWidth = 500;
        const chatHeight = 600;

        const centerX = (windowWidth - chatWidth) / 2;
        const centerY = (windowHeight - chatHeight) / 2;

        injectChatBox(centerX, centerY, selectedText);
    }
});
