import type { LocaleType, LocaleKey } from '@/locales';
import { locales, DEFAULT_LOCALE } from '@/locales';
import storage from '@/utils/storage';

// 使用更简单的实现
const i18nState = {
    currentLocale: 'zh-CN' as LocaleType,
    listeners: [] as Array<(locale: LocaleType) => void>,
};

export const i18n = {
    getLocale: () => i18nState.currentLocale,

    setLocale: async (locale: LocaleType) => {
        if (i18nState.currentLocale === locale) return;

        i18nState.currentLocale = locale;
        await storage.setLocale(locale);

        // 通知监听器
        i18nState.listeners.forEach((listener) => listener(locale));

        // 广播到其他上下文
        window.dispatchEvent(new CustomEvent('localeChange', { detail: { locale } }));

        // 告诉内容脚本保持窗口位置并更新翻译
        window.dispatchEvent(new CustomEvent('maintainChatPosition'));
        
        // 为内容脚本添加更详细的语言变更事件
        window.dispatchEvent(new CustomEvent('translationUpdate', { 
            detail: { 
                locale,
                translations: locales[locale]
            } 
        }));

        // 通知其他上下文，例如 background, popup 等
        if (chrome && chrome.runtime) {
            chrome.runtime.sendMessage({ action: 'localeChanged', locale }).catch(() => {
                /* 忽略错误 */
            });
        }
    },

    translate: (key: LocaleKey) => {
        try {
            // 添加键名映射
            const keyMap: Record<string, string> = {
                'includeWebpageContent': 'includeWebpage'
            };
            
            const actualKey = keyMap[key as string] || key;
            
            if (!locales[i18nState.currentLocale]) {
                return locales[DEFAULT_LOCALE][actualKey as keyof typeof locales[typeof DEFAULT_LOCALE]] || key as string;
            }
            
            return locales[i18nState.currentLocale][actualKey as keyof typeof locales[typeof i18nState.currentLocale]] || 
                   locales[DEFAULT_LOCALE][actualKey as keyof typeof locales[typeof DEFAULT_LOCALE]] || 
                   key as string;
        } catch {
            console.warn(`Translation key not found: ${key}`);
            return key as string;
        }
    },

    subscribe: (callback: (locale: LocaleType) => void) => {
        i18nState.listeners.push(callback);
        return () => {
            const index = i18nState.listeners.indexOf(callback);
            if (index !== -1) {
                i18nState.listeners.splice(index, 1);
            }
        };
    },
};

// 初始化
storage
    .getLocale()
    .then((savedLocale) => {
        if (savedLocale && Object.keys(locales).includes(savedLocale)) {
            i18nState.currentLocale = savedLocale as LocaleType;
            i18nState.listeners.forEach((listener) => listener(i18nState.currentLocale));
        }
    })
    .catch(console.error);

// Helper functions
export const t = (key: string): string => {
    const translation = i18n.translate(key as LocaleKey);
    // If translation is missing and returns the key itself
    if (translation === key) {
        // Provide fallbacks for specific keys
        const fallbacks: Record<string, string> = {
            pin: 'Pin',
            unpin: 'Unpin',
            // Add other fallbacks as needed
        };
        return fallbacks[key] || key;
    }
    return translation;
};

export const getLocale = (): LocaleType => i18n.getLocale();
export const setLocale = (locale: LocaleType): Promise<void> => i18n.setLocale(locale);
export const subscribeToLocaleChange = (callback: (locale: LocaleType) => void): (() => void) =>
    i18n.subscribe(callback);
