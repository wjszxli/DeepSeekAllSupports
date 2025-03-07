import {
    Button,
    Form,
    Input,
    message,
    Select,
    Switch,
    Tooltip,
    Typography,
    Divider,
    Card,
    Space,
    Checkbox,
    Tag,
} from 'antd';
import React, { useEffect, useState } from 'react';
import { GlobalOutlined, SettingOutlined, GithubOutlined, RocketOutlined } from '@ant-design/icons';

import { modelList, validateApiKey } from '@/services';
import { t, getLocale, setLocale } from '@/services/i18n';
import type { LocaleType } from '@/locales';
import { locales } from '@/locales';
import { isLocalhost } from '@/utils';
import {
    GIT_URL,
    PROVIDERS_DATA,
    SHORTCUTS_URL,
    isFirefox,
    SEARCH_ENGINE_NAMES,
    DEFAULT_SEARCH_ENGINES,
    FILTERED_DOMAINS,
} from '@/utils/constant';
import storage from '@/utils/storage';
import { featureSettings } from '@/utils/featureSettings';

import './App.scss';

const { Option } = Select;

const App: React.FC = () => {
    const [form] = Form.useForm();
    const LOADING_STATE = {
        SAVE: 'SAVE',
        SAVING: 'SAVING',
        VALIDATING: 'VALIDATING',
    };
    const [loadingState, setLoadingState] = useState<string>(LOADING_STATE.SAVE);
    const [selectedProvider, setSelectedProvider] = useState('DeepSeek');
    const [models, setModels] = useState<Array<{ label: string; value: string }>>([]);
    const [currentLocale, setCurrentLocale] = useState<LocaleType>(getLocale());
    const [enabledSearchEngines, setEnabledSearchEngines] =
        useState<string[]>(DEFAULT_SEARCH_ENGINES);
    const [tavilyApiKey, setTavilyApiKey] = useState<string>('');
    const [filteredDomains, setFilteredDomains] = useState<string[]>(FILTERED_DOMAINS);
    const [newFilterDomain, setNewFilterDomain] = useState<string>('');

    useEffect(() => {
        const init = async () => {
            try {
                const savedLocale = await storage.getLocale();
                if (savedLocale && Object.keys(locales).includes(savedLocale)) {
                    await setLocale(savedLocale as LocaleType);
                    setCurrentLocale(savedLocale as LocaleType);
                    console.log('Initialized locale from storage:', savedLocale);
                }
            } catch (error) {
                console.error('Failed to initialize locale:', error);
            }

            await initData();
        };

        init();
    }, []);

    const initData = async () => {
        const { selectedProvider, selectedModel } = await storage.getConfig();

        if (!selectedProvider) {
            console.log('No provider selected, setting default provider');
            const defaultProvider = 'DeepSeek';
            const defaultModel = PROVIDERS_DATA[defaultProvider].models[0].value;

            form.setFieldsValue({
                provider: defaultProvider,
                model: defaultModel,
                isIcon: true,
                webSearchEnabled: false,
                useWebpageContext: false,
            });

            await storage.setProviders(PROVIDERS_DATA);
            await storage.setSelectedProvider(defaultProvider);
            await storage.setSelectedModel(defaultModel);
            await storage.setIsChatBoxIcon(true);
            await storage.setWebSearchEnabled(false);
            await storage.setUseWebpageContext(true);

            setSelectedProvider(defaultProvider);
            await getModels(defaultProvider);
            return;
        }

        const isChatBoxIcon = await storage.getIsChatBoxIcon();
        const isWebSearchEnabled = await storage.getWebSearchEnabled();
        const isUseWebpageContext = await storage.getUseWebpageContext();
        const userEnabledSearchEngines = await storage.getEnabledSearchEngines();
        const userTavilyApiKey = (await storage.getTavilyApiKey()) || '';
        const userFilteredDomains = await storage.getFilteredDomains();

        setSelectedProvider(selectedProvider);
        await getModels(selectedProvider);

        const providers = await storage.getProviders();

        setEnabledSearchEngines(userEnabledSearchEngines);
        setTavilyApiKey(userTavilyApiKey);
        setFilteredDomains(userFilteredDomains);

        form.setFieldsValue({
            provider: selectedProvider,
            apiKey: providers[selectedProvider]?.apiKey || '',
            model: selectedModel,
            isIcon: isChatBoxIcon !== undefined ? isChatBoxIcon : true,
            webSearchEnabled: isWebSearchEnabled,
            useWebpageContext: isUseWebpageContext,
            tavilyApiKey: userTavilyApiKey,
        });
    };

    useEffect(() => {
        const handleLocaleChange = (event: CustomEvent<{ locale: LocaleType }>) => {
            setCurrentLocale(event.detail.locale);
            form.setFieldsValue(form.getFieldsValue());
        };

        window.addEventListener('localeChange', handleLocaleChange as EventListener);

        return () => {
            window.removeEventListener('localeChange', handleLocaleChange as EventListener);
        };
    }, [form]);

    const getModels = async (selectedProvider: string | null) => {
        if (!selectedProvider) {
            setModels([]);
            return;
        }

        if (isLocalhost(selectedProvider)) {
            const res = (await modelList(selectedProvider)) as {
                models?: Array<{ name: string; model: string }>;
            };

            if (res?.models) {
                const models = res.models.map((value) => ({
                    label: value.name,
                    value: value.model,
                }));
                setModels(models);
            }
        } else {
            const models = PROVIDERS_DATA[selectedProvider].models;
            setModels(models);
        }
    };

    const onFinish = async (values: any) => {
        setLoadingState(LOADING_STATE.SAVING);

        const isValid = await featureSettings.validateAndSubmitSettings(values, t);
        if (!isValid) {
            setLoadingState(LOADING_STATE.SAVE);
            return;
        }

        const { provider, apiKey, model, isIcon, webSearchEnabled, useWebpageContext } = values;

        try {
            let providersData = await storage.getProviders();
            if (!providersData) {
                providersData = PROVIDERS_DATA;
            }

            providersData[provider] = {
                ...PROVIDERS_DATA[provider],
                apiKey,
                selected: true,
                selectedModel: model,
            };

            await Promise.all([
                storage.setProviders(providersData),
                storage.setSelectedProvider(provider),
                storage.setSelectedModel(model),
                storage.updateApiKey(provider, apiKey),
                storage.setIsChatBoxIcon(isIcon),
                storage.setWebSearchEnabled(webSearchEnabled),
                storage.setUseWebpageContext(useWebpageContext),
                storage.setEnabledSearchEngines(enabledSearchEngines),
                storage.setTavilyApiKey(values.tavilyApiKey || ''),
                storage.setFilteredDomains(filteredDomains),
            ]);

            message.success(t('configSaved'));
            setLoadingState(LOADING_STATE.VALIDATING);
            onValidateApiKey();
        } catch (error) {
            console.error('Failed to save configuration:', error);
            message.error(t('savingConfigError'));
            setLoadingState(LOADING_STATE.SAVE);
        }
    };

    const onProviderChange = async (value: string) => {
        setSelectedProvider(value);

        // 首先清空模型选择
        form.setFieldsValue({ model: undefined });

        const providers = await storage.getProviders();
        await storage.setSelectedProvider(value);
        await getModels(value);
        if (!isLocalhost(value)) {
            const apiKey = providers[value]?.apiKey;
            const model = providers[value]?.models[0].value;
            const fieldsValue = { apiKey, model };
            form.setFieldsValue(fieldsValue);
        }
    };

    const onModelChange = (value: string) => {
        form.setFieldsValue({ model: value });
    };

    const onValidateApiKey = async () => {
        try {
            await validateApiKey();
            message.success(t('apiValidSuccess'));
            setLoadingState(LOADING_STATE.SAVE);
        } catch (error) {
            setLoadingState(LOADING_STATE.SAVE);
            if (error instanceof Error) {
                message.error(error.message);
            } else {
                message.error(error as string);
            }
        }
    };

    const onSetShortcuts = () => {
        chrome.tabs.create({
            url: SHORTCUTS_URL,
        });

        if (isFirefox) {
            // Firefox需要额外的步骤来访问快捷键设置
            message.info(
                '在Firefox扩展页面打开后，请点击左侧的"⚙️ 管理您的扩展程序"，然后选择"⌨️ 管理扩展快捷键"',
                8,
            );
        }
    };

    const handleLanguageChange = async (locale: LocaleType) => {
        await setLocale(locale);
        setCurrentLocale(locale);

        message.success(t('languageChanged'));

        setTimeout(() => {
            form.setFieldsValue(form.getFieldsValue());
        }, 50);

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

    // 处理搜索引擎选择变化
    const handleSearchEngineChange = (engine: string, checked: boolean) => {
        if (checked) {
            setEnabledSearchEngines((prev) => [...prev, engine]);
        } else {
            setEnabledSearchEngines((prev) => prev.filter((e) => e !== engine));
        }
    };

    // 处理添加新过滤域名
    const handleAddFilterDomain = () => {
        if (newFilterDomain && !filteredDomains.includes(newFilterDomain)) {
            setFilteredDomains([...filteredDomains, newFilterDomain]);
            setNewFilterDomain('');
        }
    };

    // 处理删除过滤域名
    const handleRemoveFilterDomain = (domain: string) => {
        setFilteredDomains(filteredDomains.filter((d) => d !== domain));
    };

    return (
        <div className="app">
            <Card className="app-container">
                <div className="app-header">
                    <Typography.Title level={2} className="app-title">
                        <RocketOutlined /> {t('appTitle')}
                    </Typography.Title>
                    <Select
                        value={currentLocale}
                        onChange={handleLanguageChange}
                        className="language-selector"
                        dropdownMatchSelectWidth={false}
                        bordered={true}
                        suffixIcon={<GlobalOutlined />}
                        style={{ width: '150px' }}
                    >
                        {(Object.keys(locales) as LocaleType[]).map((locale) => {
                            const localeWithoutHyphen = locale.replace('-', '');
                            const value =
                                localeWithoutHyphen.charAt(0).toUpperCase() +
                                localeWithoutHyphen.slice(1);
                            const key = `language${value}` as keyof typeof locales[typeof locale];
                            return (
                                <Option key={locale} value={locale}>
                                    {t(key as string)}
                                </Option>
                            );
                        })}
                    </Select>
                </div>

                <Divider />

                <Form
                    form={form}
                    name="setting"
                    className="form"
                    onFinish={onFinish}
                    layout="vertical"
                    requiredMark={false}
                    size="large"
                >
                    <Form.Item
                        className="form-item"
                        label={t('serviceProvider')}
                        name="provider"
                        rules={[{ required: true, message: t('selectProvider') }]}
                    >
                        <Select
                            placeholder={t('selectProvider')}
                            onChange={(value) => onProviderChange(value)}
                            allowClear
                            style={{ fontSize: '16px' }}
                        >
                            {(
                                Object.keys(PROVIDERS_DATA) as Array<keyof typeof PROVIDERS_DATA>
                            ).map((key) => (
                                <Option key={key} value={key}>
                                    {PROVIDERS_DATA[key].name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {!isLocalhost(selectedProvider) && (
                        <Form.Item className="form-item" label={t('apiKey')} name="ApiKey">
                            <>
                                <Form.Item
                                    name="apiKey"
                                    noStyle
                                    rules={[{ required: true, message: t('enterApiKey') }]}
                                >
                                    <Input placeholder={t('enterApiKey')} />
                                </Form.Item>
                                <div className="api-link">
                                    <Tooltip title={t('getApiKey')}>
                                        <Typography.Link
                                            href={PROVIDERS_DATA[selectedProvider].apiKeyUrl || ''}
                                            target="_blank"
                                        >
                                            {t('getApiKey')}
                                        </Typography.Link>
                                    </Tooltip>
                                </div>
                            </>
                        </Form.Item>
                    )}

                    <Form.Item
                        className="form-item"
                        label={t('modelSelection')}
                        name="model"
                        rules={[{ required: true, message: t('selectModel') }]}
                    >
                        <Select
                            placeholder={t('selectModel')}
                            onChange={(value) => onModelChange(value)}
                            options={models}
                            allowClear
                        />
                    </Form.Item>

                    <Form.Item
                        className="form-item"
                        label={t('showIcon')}
                        name="isIcon"
                        valuePropName="checked"
                        initialValue={true}
                    >
                        <Switch />
                    </Form.Item>

                    <Form.Item
                        className="form-item"
                        label={t('webSearch')}
                        name="webSearchEnabled"
                        valuePropName="checked"
                        initialValue={false}
                        tooltip={t('webSearchTooltip')}
                    >
                        <Switch
                            onChange={(checked) => {
                                if (checked && form.getFieldValue('useWebpageContext')) {
                                    message.warning(t('exclusiveFeatureWarning'));
                                    form.setFieldsValue({ useWebpageContext: false });
                                }
                            }}
                        />
                    </Form.Item>

                    <Form.Item
                        className="form-item"
                        label={t('includeWebpage')}
                        name="useWebpageContext"
                        valuePropName="checked"
                        initialValue={true}
                        tooltip={t('includeWebpageTooltip')}
                    >
                        <Switch
                            onChange={(checked) => {
                                if (checked && form.getFieldValue('webSearchEnabled')) {
                                    message.warning(t('exclusiveFeatureWarning'));
                                    form.setFieldsValue({ webSearchEnabled: false });
                                }
                            }}
                        />
                    </Form.Item>

                    <Form.Item className="form-item" label={t('tavilyApiKey')} name="tavilyApiKey">
                        <Input
                            value={tavilyApiKey}
                            onChange={(e) => setTavilyApiKey(e.target.value)}
                            placeholder={t('enterTavilyApiKey')}
                        />
                    </Form.Item>

                    {form.getFieldValue('webSearchEnabled') && (
                        <>
                            <Form.Item className="form-item" label={t('searchEngines')}>
                                <div className="search-engines-container">
                                    {Object.entries(SEARCH_ENGINE_NAMES).map(([engine, name]) => (
                                        <div key={engine} className="search-engine-item">
                                            <Checkbox
                                                checked={enabledSearchEngines.includes(engine)}
                                                onChange={(e) =>
                                                    handleSearchEngineChange(
                                                        engine,
                                                        e.target.checked,
                                                    )
                                                }
                                            >
                                                {name}
                                            </Checkbox>
                                        </div>
                                    ))}
                                </div>
                            </Form.Item>

                            <Form.Item className="form-item" label={t('filteredDomains')}>
                                <div className="filtered-domains-container">
                                    <Space direction="vertical" style={{ width: '100%' }}>
                                        <div className="filtered-domains-list">
                                            {filteredDomains.length > 0 ? (
                                                filteredDomains.map((domain) => (
                                                    <Tag
                                                        key={domain}
                                                        closable
                                                        onClose={() =>
                                                            handleRemoveFilterDomain(domain)
                                                        }
                                                        style={{ marginBottom: '8px' }}
                                                    >
                                                        {domain}
                                                    </Tag>
                                                ))
                                            ) : (
                                                <div className="no-domains-message">
                                                    {t('noFilteredDomains') || '无过滤域名'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="add-domain-container">
                                            <Input
                                                placeholder={
                                                    t('enterDomainToFilter') ||
                                                    '输入要过滤的域名 (例如: zhihu.com)'
                                                }
                                                value={newFilterDomain}
                                                onChange={(e) => setNewFilterDomain(e.target.value)}
                                                onPressEnter={handleAddFilterDomain}
                                                style={{ width: 'calc(100% - 80px)' }}
                                            />
                                            <Button
                                                type="primary"
                                                onClick={handleAddFilterDomain}
                                                disabled={!newFilterDomain}
                                            >
                                                {t('add') || '添加'}
                                            </Button>
                                        </div>
                                    </Space>
                                </div>
                            </Form.Item>
                        </>
                    )}

                    <Divider />

                    <Form.Item className="form-actions">
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loadingState !== LOADING_STATE.SAVE}
                            block
                            size="large"
                        >
                            {loadingState === LOADING_STATE.VALIDATING
                                ? t('validatingApi')
                                : loadingState === LOADING_STATE.SAVING
                                ? t('savingConfig')
                                : t('saveConfig')}
                        </Button>
                    </Form.Item>
                </Form>

                <div className="app-footer">
                    <Space split={<Divider type="vertical" />}>
                        <Typography.Link onClick={onSetShortcuts} className="footer-link">
                            <SettingOutlined /> {t('setShortcuts')}
                        </Typography.Link>
                        <Typography.Link href={GIT_URL} target="_blank" className="footer-link">
                            <GithubOutlined /> {t('starAuthor')}
                        </Typography.Link>
                    </Space>
                </div>
            </Card>
        </div>
    );
};

export default App;
