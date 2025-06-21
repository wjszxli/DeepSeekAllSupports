import { Button, message as messageApi, Select, Tooltip, Tabs } from 'antd';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    GlobalOutlined,
    SettingOutlined,
    RocketOutlined,
    CommentOutlined,
    MessageOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    RobotOutlined,
} from '@ant-design/icons';

import { t, getLocale, setLocale } from '@/locales/i18n';
import type { LocaleType } from '@/locales';
import { locales } from '@/locales';
import storage from '@/utils/storage';
import rootStore from '@/store';

import './App.scss';
import Robot from './components/Robot';
import Topic from './components/Topic';
import ChatBody from './components/ChatBody';
import { FEEDBACK_SURVEY_URL } from '@/utils/constant';

const { Option } = Select;

const App: React.FC = () => {
    const [selectedProvider, setSelectedProvider] = useState('DeepSeek');
    const [currentLocale, setCurrentLocale] = useState<LocaleType>(getLocale());
    const [userInput, setUserInput] = useState('');
    const [activeTab, setActiveTab] = useState('assistant');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(false);
    const resizeRef = useRef<HTMLDivElement>(null);

    // 拖拽调整大小的处理函数
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isResizing) return;

            const newWidth = e.clientX;
            const minWidth = 200;
            const maxWidth = window.innerWidth * 0.5; // 最大占屏幕宽度的50%

            if (newWidth >= minWidth && newWidth <= maxWidth) {
                setSidebarWidth(newWidth);
            }
        },
        [isResizing],
    );

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
    }, []);

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, handleMouseMove, handleMouseUp]);

    useEffect(() => {
        const init = async () => {
            try {
                const savedLocale = await storage.getLocale();
                if (savedLocale && Object.keys(locales).includes(savedLocale)) {
                    await setLocale(savedLocale as LocaleType);
                    setCurrentLocale(savedLocale as LocaleType);
                    console.log('Initialized locale from storage:', savedLocale);
                }
                const selectedProvider = await storage.getSelectedProvider();
                setSelectedProvider(selectedProvider || 'DeepSeek');
            } catch (error) {
                console.error('Failed to initialize locale:', error);
            }
        };

        init();
    }, []);

    // Listen for provider settings updates from other parts of the extension
    useEffect(() => {
        const handleMessage = async (message: any) => {
            if (message.action === 'providerSettingsUpdated') {
                try {
                    const defaultProvider = await storage.getSelectedProvider();

                    // 2. 更新 selectedProvider 状态
                    setSelectedProvider(defaultProvider || 'DeepSeek');

                    // 4. 如果有选定的机器人，更新其模型为最新的默认模型
                    if (rootStore.robotStore.selectedRobot) {
                        // 强制从存储中获取最新的默认模型
                        const chatModel = rootStore.llmStore.chatModel;

                        // 更新机器人信息
                        await rootStore.robotStore.updateSelectedRobot({
                            ...rootStore.robotStore.selectedRobot,
                            model: chatModel,
                        });

                        // 5. 刷新页面以确保所有组件都使用最新数据
                        // 这是一个临时解决方案，理想情况下我们应该找出为什么数据不同步
                        window.location.reload();
                    }

                    // 显示通知
                    messageApi.info('提供商设置已更新');
                } catch (error) {
                    console.error('更新提供商设置时出错:', error);
                    messageApi.error('更新提供商设置失败');
                }
            }
        };

        // Add listener for messages from background script
        chrome.runtime.onMessage.addListener(handleMessage);

        // Clean up listener when component unmounts
        return () => {
            chrome.runtime.onMessage.removeListener(handleMessage);
        };
    }, []);

    useEffect(() => {
        const handleCopyButtonClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const copyButton = target.closest('.copy-button') as HTMLButtonElement;

            if (copyButton) {
                const encodedCode = copyButton.getAttribute('data-code');
                if (encodedCode) {
                    const code = decodeURIComponent(encodedCode);
                    navigator.clipboard
                        .writeText(code)
                        .then(() => {
                            const buttonText = copyButton.querySelector('span');
                            if (buttonText) {
                                const originalText = buttonText.textContent;
                                buttonText.textContent = t('copied');
                                setTimeout(() => {
                                    buttonText.textContent = originalText;
                                }, 2000);
                            }
                            messageApi.success(t('copied'), 2);
                        })
                        .catch(() => {
                            messageApi.error(t('failedCopy'));
                        });
                }
            }
        };

        document.addEventListener('click', handleCopyButtonClick);

        return () => {
            document.removeEventListener('click', handleCopyButtonClick);
        };
    }, [t]);

    useEffect(() => {
        const handleLocaleChange = (event: CustomEvent<{ locale: LocaleType }>) => {
            setCurrentLocale(event.detail.locale);
        };

        window.addEventListener('localeChange', handleLocaleChange as EventListener);

        return () => {
            window.removeEventListener('localeChange', handleLocaleChange as EventListener);
        };
    }, []);

    // 更新页面标题
    useEffect(() => {
        document.title = t('appTitle');
    }, [currentLocale, t]);

    const handleLanguageChange = async (locale: LocaleType) => {
        await setLocale(locale);
        setCurrentLocale(locale);

        messageApi.success(t('languageChanged'));

        try {
            if (chrome && chrome.tabs) {
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach((tab) => {
                        if (tab.id) {
                            chrome.tabs
                                .sendMessage(tab.id, { action: 'localeChanged', locale })
                                .catch(() => {});
                        }
                    });
                });
            }
        } catch (error) {
            console.log('Failed to notify tabs about language change:', error);
        }
    };

    const openOptionsPage = () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    };

    // Function to open feedback survey
    const openFeedbackSurvey = () => {
        window.open(FEEDBACK_SURVEY_URL, '_blank');
    };

    return (
        <div className="app">
            <div className="chat-container">
                <div className="chat-header">
                    <div className="chat-title">
                        <RocketOutlined /> {t('appTitle')}
                    </div>
                    <div className="header-actions">
                        <Tooltip title={t('feedback')}>
                            <Button
                                type="text"
                                icon={<CommentOutlined />}
                                onClick={openFeedbackSurvey}
                                className="feedback-button"
                            />
                        </Tooltip>
                        <Select
                            value={currentLocale}
                            onChange={handleLanguageChange}
                            className="language-selector"
                            dropdownMatchSelectWidth={false}
                            bordered={false}
                            suffixIcon={<GlobalOutlined />}
                            style={{ width: 'auto' }}
                        >
                            {(Object.keys(locales) as LocaleType[]).map((locale) => {
                                const localeWithoutHyphen = locale.replace('-', '');
                                const value =
                                    localeWithoutHyphen.charAt(0).toUpperCase() +
                                    localeWithoutHyphen.slice(1);
                                const key =
                                    `language${value}` as keyof typeof locales[typeof locale];
                                return (
                                    <Option key={locale} value={locale}>
                                        {t(key as string)}
                                    </Option>
                                );
                            })}
                        </Select>
                        <Button
                            type="text"
                            icon={<SettingOutlined />}
                            onClick={openOptionsPage}
                            className="settings-button"
                        />
                    </div>
                </div>

                {/* 主要内容区域 - 左右布局 */}
                <div className="main-content">
                    {/* 左侧边栏 */}
                    <div
                        className={`sidebar-container ${sidebarCollapsed ? 'collapsed' : ''}`}
                        style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
                    >
                        {!sidebarCollapsed && (
                            <div className="sidebar-tabs">
                                <Tabs
                                    activeKey={activeTab}
                                    onChange={setActiveTab}
                                    type="card"
                                    size="small"
                                    items={[
                                        {
                                            key: 'assistant',
                                            label: (
                                                <span>
                                                    <RobotOutlined style={{ marginRight: 5 }} />
                                                    {t('assistants') || '机器人'}
                                                </span>
                                            ),
                                            children: (
                                                <Robot
                                                    onSwitchToTopics={() => setActiveTab('topic')}
                                                />
                                            ),
                                        },
                                        {
                                            key: 'topic',
                                            label: (
                                                <span>
                                                    <MessageOutlined style={{ marginRight: 5 }} />
                                                    {t('topics') || '话题'}
                                                </span>
                                            ),
                                            children: <Topic />,
                                        },
                                    ]}
                                />
                            </div>
                        )}
                    </div>

                    {/* 拖拽调整大小的分隔线 */}
                    {!sidebarCollapsed && (
                        <div
                            ref={resizeRef}
                            className="resize-handle"
                            onMouseDown={handleMouseDown}
                        >
                            <Button
                                type="text"
                                icon={<MenuFoldOutlined />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSidebarCollapsed(true);
                                }}
                                className="collapse-button-on-handle"
                                title={t('collapse') || '折叠'}
                                size="small"
                            />
                        </div>
                    )}

                    {/* 折叠状态下的展开按钮 */}
                    {sidebarCollapsed && (
                        <div className="collapsed-sidebar-trigger">
                            <Button
                                type="text"
                                icon={<MenuUnfoldOutlined />}
                                onClick={() => setSidebarCollapsed(false)}
                                className="expand-button"
                                title={t('expand') || '展开'}
                            />
                        </div>
                    )}

                    {/* 右侧聊天区域 */}
                    <ChatBody
                        selectedProvider={selectedProvider}
                        userInput={userInput}
                        setUserInput={setUserInput}
                    />
                </div>
            </div>
        </div>
    );
};

export default App;
