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
    const { t, currentLanguage } = useLanguage();

    const initData = async () => {
        const providers = await storage.getProviders();
        setConfigProviders(providers);

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

    // Listen for language changes
    useEffect(() => {
        // Re-render form elements with new translations
        form.setFieldsValue(form.getFieldsValue());

        // Listen for language updated events from parent components
        const handleLanguageUpdate = () => {
            // Update form with current values to refresh translations
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
        const providers = await storage.getProviders();
        await storage.setSelectedProvider(value);
        await getModels(value);
        if (!isLocalhost(value)) {
            const apiKey = providers[value]?.apiKey;
            const model = providers[value]?.models[0].value;
            const fieldsValue = { apiKey, model };
            form.setFieldsValue(fieldsValue);
            await storage.setSelectedModel(model);
        } else {
            const model = providers[value]?.models[0].value;
            form.setFieldsValue({ model });
            await storage.setSelectedModel(model);
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
                        {(Object.keys(configProviders) as Array<keyof typeof configProviders>).map(
                            (key) => (
                                <Option key={key} value={key}>
                                    {configProviders[key].name}
                                </Option>
                            ),
                        )}
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
