import { Form, Select } from 'antd';
import { useEffect, useState } from 'react';

import { modelList } from '@/service';
import type { ProviderConfig } from '@/typings';
import { isLocalhost } from '@/utils';
import { PROVIDERS_DATA } from '@/utils/constant';
import storage from '@/utils/storage';
import { useLanguage } from '@/contexts/LanguageContext';

const { Option } = Select;

const Config = (props: {
    width: number;
    height: number;
    parentInitData: () => void;
    onCancel: () => void;
}) => {
    const [form] = Form.useForm();
    const [models, setModels] = useState<Array<{ label: string; value: string }>>([]);
    const [configProviders, setConfigProviders] = useState<Record<string, ProviderConfig>>({});
    const [availableProviders, setAvailableProviders] = useState<string[]>([]);
    const { t, currentLanguage } = useLanguage();

    const initData = async () => {
        const providers = await storage.getProviders();
        setConfigProviders(providers);

        // 只过滤出已经设置了 API Key 的服务商
        const providersWithApiKey = Object.keys(providers).filter((key) => {
            const apiKey = providers[key]?.apiKey;
            return apiKey !== null && apiKey !== undefined && apiKey.trim() !== '';
        });
        setAvailableProviders(providersWithApiKey);

        const { selectedProvider, selectedModel } = await storage.getConfig();
        if (!selectedProvider) {
            return;
        }
        await getModels(selectedProvider);

        form.setFieldsValue({
            provider: selectedProvider,
            apiKey: providers[selectedProvider]?.apiKey || '',
            model: selectedModel,
        });
    };

    useEffect(() => {
        initData();
    }, []);

    useEffect(() => {
        form.setFieldsValue(form.getFieldsValue());

        const handleLanguageUpdate = () => {
            form.setFieldsValue(form.getFieldsValue());
        };

        window.addEventListener('languageUpdated', handleLanguageUpdate);

        return () => {
            window.removeEventListener('languageUpdated', handleLanguageUpdate);
        };
    }, [currentLanguage, form]);

    const getModels = async (selectedProvider: string | null) => {
        if (!selectedProvider) {
            setModels([]);
            return;
        }

        // 先清空模型列表
        setModels([]);

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
                const providersData = await storage.getProviders();
                providersData[selectedProvider] = {
                    ...PROVIDERS_DATA[selectedProvider],
                    models: models,
                };
                await storage.setProviders(providersData);
            }
        } else {
            const models = PROVIDERS_DATA[selectedProvider].models;
            setModels(models);
        }
    };

    const onProviderChange = async (value: string) => {
        props.onCancel();

        // 先重置表单中的模型值
        form.resetFields(['model']);

        // 获取提供商数据并设置选中的提供商
        const providers = await storage.getProviders();
        await storage.setSelectedProvider(value);

        // 获取模型列表
        await getModels(value);
        console.log('isLocalhost(value)', isLocalhost(value))

        // 获取模型列表后，根据情况设置默认模型
        if (!isLocalhost(value)) {
            const apiKey = providers[value]?.apiKey;
            const availableModels = providers[value]?.models || [];

            if (availableModels.length > 0) {
                const defaultModel = availableModels[0].value;
                await storage.setSelectedModel(defaultModel);
                form.setFieldsValue({
                    apiKey,
                    model: defaultModel,
                });
            } else {
                // 如果没有模型，清空选择模型
                await storage.setSelectedModel('');
                form.setFieldsValue({
                    apiKey,
                    model: null,
                });
            }
        } else {
            const availableModels = providers[value]?.models || [];

            if (availableModels.length > 0) {
                const defaultModel = availableModels[0].value;
                await storage.setSelectedModel(defaultModel);
                form.setFieldsValue({ model: defaultModel });
            } else {
                // 如果没有模型，清空选择模型
                await storage.setSelectedModel('');
                form.setFieldsValue({ model: undefined });
            }
        }
    };

    const onModelChange = async (value: string) => {
        props.onCancel();
        form.setFieldsValue({ model: value });
        await storage.setSelectedModel(value);
    };

    return (
        <div
            style={{
                margin: '8px 0',
            }}
        >
            <Form form={form} layout="inline" style={{ marginLeft: 20 }}>
                <Form.Item
                    label={t('serviceProvider')}
                    name="provider"
                    rules={[{ message: t('selectProvider') }]}
                    tooltip={{
                        title: t('selectProvider'),
                        getPopupContainer: (trigger) =>
                            trigger.parentElement?.parentElement?.parentElement || document.body,
                    }}
                >
                    <Select
                        placeholder={t('selectProvider')}
                        onChange={(value) => onProviderChange(value)}
                        allowClear
                        getPopupContainer={(trigger) => trigger.parentElement || document.body}
                        style={{ width: props.width / 4 }}
                    >
                        {availableProviders.map((key) => (
                            <Option key={key} value={key}>
                                {configProviders[key]?.name || key}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item
                    label={t('modelSelection')}
                    name="model"
                    rules={[{ message: t('selectModel') }]}
                >
                    <Select
                        placeholder={t('selectModel')}
                        onChange={(value) => onModelChange(value)}
                        options={models}
                        allowClear
                        getPopupContainer={(trigger) => trigger.parentElement || document.body}
                        style={{ width: props.width / 4 }}
                    />
                </Form.Item>
            </Form>
        </div>
    );
};

export default Config;
