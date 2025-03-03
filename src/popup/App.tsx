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
} from 'antd';
import React, { useEffect, useState } from 'react';
import { GlobalOutlined, SettingOutlined, GithubOutlined, RocketOutlined } from '@ant-design/icons';

import { modelList, validateApiKey } from '@/service';
import { t, getLocale, setLocale } from '@/services/i18n';
import type { LocaleType } from '@/locales';
import { locales } from '@/locales';
import { isLocalhost } from '@/utils';
import { GIT_URL, PROVIDERS_DATA, SHORTCUTS_URL } from '@/utils/constant';
import storage from '@/utils/storage';

import './App.scss';

const { Option } = Select;

const App: React.FC = () => {
    const [form] = Form.useForm();
    const [loadings, setLoadings] = useState<string>(t('saveConfig'));
    const [selectedProvider, setSelectedProvider] = useState('DeepSeek');
    const [models, setModels] = useState<Array<{ label: string; value: string }>>([]);
    const [currentLocale, setCurrentLocale] = useState<LocaleType>(getLocale());

    const initData = async () => {
        const { selectedProvider, selectedModel } = await storage.getConfig();

        if (!selectedProvider) {
            // Auto-select DeepSeek as default provider if none is set
            console.log('No provider selected, setting default provider');
            const defaultProvider = 'DeepSeek';
            const defaultModel = PROVIDERS_DATA[defaultProvider].models[0].value;
            
            // Set default values in the form
            form.setFieldsValue({
                provider: defaultProvider,
                model: defaultModel,
                isIcon: true
            });
            
            // Save default configuration 
            await storage.setProviders(PROVIDERS_DATA);
            await storage.setSelectedProvider(defaultProvider);
            await storage.setSelectedModel(defaultModel);
            await storage.setIsChatBoxIcon(true);
            
            setSelectedProvider(defaultProvider);
            await getModels(defaultProvider);
            return;
        }

        const isChatBoxIcon = await storage.getIsChatBoxIcon();

        setSelectedProvider(selectedProvider);
        await getModels(selectedProvider);

        const providers = await storage.getProviders();

        form.setFieldsValue({
            provider: selectedProvider,
            apiKey: providers[selectedProvider]?.apiKey || '',
            model: selectedModel,
            isIcon: isChatBoxIcon !== undefined ? isChatBoxIcon : true,
        });
    };

    useEffect(() => {
        initData();
    }, []);

    // Listen for locale changes from the service
    useEffect(() => {
        // Add window event listener for locale changes
        const handleLocaleChange = (event: CustomEvent<{ locale: LocaleType }>) => {
            setCurrentLocale(event.detail.locale);
            // Reload the form with translated texts
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
        console.log('values', values);
        setLoadings(t('savingConfig'));
        const { provider, apiKey, model, isIcon } = values;

        let providersData = await storage.getProviders();
        if (!providersData) {
            providersData = PROVIDERS_DATA;
        }

        providersData[provider] = { ...PROVIDERS_DATA[provider], apiKey };

        await storage.setProviders(providersData);
        await storage.setSelectedProvider(provider);
        await storage.setSelectedModel(model);
        await storage.updateApiKey(provider, apiKey);
        await storage.setIsChatBoxIcon(isIcon);
        message.success(t('configSaved'));
        setLoadings(t('validatingApi'));
        onValidateApiKey();
    };

    const onProviderChange = async (value: string) => {
        setSelectedProvider(value);
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
            setLoadings(t('saveConfig'));
        } catch (error) {
            setLoadings(t('saveConfig'));
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
    };

    const handleLanguageChange = async (locale: LocaleType) => {
        await setLocale(locale);
        setCurrentLocale(locale);
        
        // Show success message
        message.success(t('languageChanged'));
        
        // Force reload form with translations
        setTimeout(() => {
            form.setFieldsValue(form.getFieldsValue());
        }, 50);
        
        // Inform content scripts about language change (if they're loaded)
        try {
            if (chrome && chrome.tabs) {
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach((tab) => {
                        if (tab.id) {
                            chrome.tabs.sendMessage(tab.id, { action: 'languageChanged', locale }).catch(() => {
                                // Ignore errors - content script might not be loaded
                            });
                        }
                    });
                });
            }
        } catch (error) {
            // Ignore any errors in this optional notification
            console.log('Failed to notify tabs about language change:', error);
        }
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
                            const key = `language${locale.replace('-', '')}` as keyof typeof locales[typeof locale];
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
                            {(Object.keys(PROVIDERS_DATA) as Array<keyof typeof PROVIDERS_DATA>).map((key) => (
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
                        rules={[{ required: true, message: t('showIcon') }]}
                        initialValue={true}
                    >
                        <Switch />
                    </Form.Item>

                    <Divider />

                    <Form.Item className="form-actions">
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loadings !== t('saveConfig')}
                            block
                            size="large"
                        >
                            {loadings === t('validatingApi')
                                ? t('validatingApi')
                                : loadings === t('savingConfig')
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
