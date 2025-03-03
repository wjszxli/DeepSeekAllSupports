import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { en } from '@/locales/en';
import { zhCN } from '@/locales/zh-CN';
import { zhTW } from '@/locales/zh-TW';
import { ja } from '@/locales/ja';
import { ko } from '@/locales/ko';
import { getLocale, setLocale as setI18nLocale, subscribeToLocaleChange } from '@/services/i18n';
import { LocaleType } from '@/locales';

// 支持的语言
type SupportedLanguages = LocaleType;

// 定义所有翻译键的类型
export type TranslationKey =
    | keyof typeof en
    | keyof typeof zhCN
    | keyof typeof zhTW
    | keyof typeof ja
    | keyof typeof ko;

// 语言上下文类型
export interface LanguageContextType {
    t: (key: TranslationKey) => string;
    currentLanguage: SupportedLanguages;
    setLocale: (locale: SupportedLanguages) => Promise<void>;
}

// 创建上下文
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 翻译资源
const resources = {
    'en': en,
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    'ja': ja,
    'ko': ko,
};

// 语言提供者组件
export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // 使用i18n服务获取当前语言
    const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguages>(getLocale());

    // 订阅语言变更
    useEffect(() => {
        const unsubscribe = subscribeToLocaleChange((locale) => {
            setCurrentLanguage(locale);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    // 翻译函数
    const t = (key: TranslationKey): string => {
        // 键名映射，处理不同版本的键名差异
        const keyMap: Record<string, string> = {
            includeWebpageContent: 'includeWebpage',
        };

        // 获取实际的键名
        const actualKey = keyMap[key as string] || key;

        try {
            return (
                resources[currentLanguage][
                    actualKey as keyof typeof resources[typeof currentLanguage]
                ] ||
                resources['en'][actualKey as keyof typeof resources['en']] ||
                (key as string)
            );
        } catch (error) {
            console.warn(`Translation key not found: ${key}`);
            return key as string;
        }
    };

    // 设置语言的函数
    const handleSetLocale = async (locale: SupportedLanguages): Promise<void> => {
        await setI18nLocale(locale);
        setCurrentLanguage(locale);
    };

    return (
        <LanguageContext.Provider
            value={{
                t,
                currentLanguage,
                setLocale: handleSetLocale,
            }}
        >
            {children}
        </LanguageContext.Provider>
    );
};

// 自定义钩子
export const useLanguage = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }

    return context;
};
