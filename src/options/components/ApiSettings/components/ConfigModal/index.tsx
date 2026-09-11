import { Avatar, Button, Form, Input, message, Modal, Select, Space, Card, Typography } from 'antd';
import React, { useState, useEffect, useCallback } from 'react';
import {
    GlobalOutlined,
    KeyOutlined,
    CodeOutlined,
    CheckCircleOutlined,
    ReloadOutlined,
} from '@ant-design/icons';

import { t } from '@/locales/i18n';
import { requiresApiKey , getModelGroupOptions } from '@/utils';
import type { Provider, Model } from '@/types';
import { getProviderLogo, PROVIDER_CONFIG } from '@/config/providers';
import LangChainService from '@/langchain/services/LangChainService';
import { getProviderName } from '@/utils/i18n';
import llmStore from '@/store/llm';
import OrcaRouterAuthModal from '../OrcaRouterAuthModal';
import {
    ORCA_OAUTH_PROVIDER_ID,
    ORCA_PROVIDER_ID,
} from '@/orcarouter/constants';
import {
    buildModelOptions,
    isOrcaRouterProvider,
    requestModelsForProvider,
    resolveCatalogState,
} from '@/orcarouter/provider';
import type { OrcaInputModality, OrcaModel } from '@/orcarouter/catalog';

const { Text } = Typography;

interface ConfigModalProps {
    isModalOpen: boolean;
    onCancel: () => void;
    onOk: () => void;
    selectProviderId: string;
}

const ConfigModal: React.FC<ConfigModalProps> = ({
    isModalOpen,
    selectProviderId,
    onCancel,
    onOk,
}) => {
    const [apiKeyValidated, setApiKeyValidated] = useState<boolean>(false);
    const [testing, setTesting] = useState<boolean>(false);
    const currentProvider = llmStore.providers.find((p: Provider) => p.id === selectProviderId);
    const [form] = Form.useForm();
    const [, setDirty] = useState<boolean>(false);

    // OrcaRouter only: the model list is discovered from the live catalog rather
    // than typed in, so it lives in state instead of the provider's static list.
    // The full discovered catalog plus the input type currently selected. The
    // options handed to the model selector are derived from both, so changing
    // either re-filters the list without another network call.
    const [orcaCatalog, setOrcaCatalog] = useState<OrcaModel[]>([]);
    const [orcaModality, setOrcaModality] = useState<OrcaInputModality>('text');
    const [orcaModels, setOrcaModels] = useState<Model[]>([]);
    const [orcaCatalogState, setOrcaCatalogState] = useState<string>('');
    const [orcaCatalogDegraded, setOrcaCatalogDegraded] = useState<boolean>(false);
    const [orcaLoadingModels, setOrcaLoadingModels] = useState<boolean>(false);

    const needsApiKey = currentProvider ? requiresApiKey(currentProvider) : true;
    const isOrca = isOrcaRouterProvider(currentProvider);

    const siblingOrcaProvider = React.useMemo(() => {
        if (!currentProvider || !isOrca) return null;
        const otherId =
            currentProvider.id === ORCA_PROVIDER_ID ? ORCA_OAUTH_PROVIDER_ID : ORCA_PROVIDER_ID;
        return llmStore.providers.find((p) => p.id === otherId) ?? null;
    }, [currentProvider, isOrca]);

    /**
     * Load the model list for the current provider.
     *
     * OrcaRouter is special: its list comes from the live catalog for the
     * configured origin and the user's own key, filtered to the chat capability,
     * so it is kept in component state and never hand-maintained. Every other
     * provider keeps its existing behaviour.
     */
    const initializeSelectedModels = async () => {
        if (!currentProvider) return;

        if (isOrca) {
            setOrcaLoadingModels(true);
            try {
                const { models: catalog, source, degradedReason } =
                    await requestModelsForProvider(currentProvider, 'all');
                setOrcaCatalog(catalog);
                setOrcaCatalogState(resolveCatalogState(source, catalog.length, degradedReason));
                setOrcaCatalogDegraded(source !== 'live');

                const models = buildModelOptions(catalog, 'vision', orcaModality, currentProvider.id);
                setOrcaModels(models);

                // A previously stored selection must be re-validated against the
                // freshly discovered list before it is restored, or cleared.
                const storedId = currentProvider.selectedModel?.id ?? null;
                if (storedId && !models.some((model) => model.id === storedId)) {
                    const fallbackModel = models[0] ?? null;
                    llmStore.updateProvider({ ...currentProvider, models, selectedModel: fallbackModel ?? undefined });
                    form.setFieldsValue({ model: fallbackModel?.id });
                    message.warning(t('orcarouterModelCleared'));
                } else {
                    llmStore.updateProvider({ ...currentProvider, models });
                }
            } finally {
                setOrcaLoadingModels(false);
            }
            return;
        }

        if (currentProvider.models.length === 0 || !needsApiKey) {
            const models = await LangChainService.getModels({
                ...currentProvider,
                apiKey: currentProvider.apiKey || 'xxx',
                apiHost: currentProvider.apiHost,
            });

            currentProvider.models = models;
            llmStore.updateProvider({
                ...currentProvider,
                models,
            });
        }
    };

    /**
     * Catalog-aware reload triggered by the OrcaRouter panel.
     *
     * The options that reach the model selector are substituted here, so an
     * incompatible selection is cleared at the moment the list changes rather
     * than being caught later by a send-time guard.
     */
    const handleOrcaCatalogChange = useCallback(
        (models: Model[]) => {
            setOrcaModels(models);
            const storedId = currentProvider?.selectedModel?.id ?? null;
            if (storedId && !models.some((model) => model.id === storedId)) {
                const fallbackModel = models[0] ?? null;
                if (currentProvider) {
                    llmStore.updateProvider({
                        ...currentProvider,
                        models,
                        selectedModel: fallbackModel ?? undefined,
                    });
                }
                form.setFieldsValue({ model: fallbackModel?.id });
                message.warning(t('orcarouterModelCleared'));
            }
        },
        [currentProvider, form],
    );

    /** Input type changed: re-derive options from the cached catalog and reconcile. */
    const handleOrcaModalityChange = useCallback(
        (modality: OrcaInputModality) => {
            setOrcaModality(modality);
            if (!currentProvider || orcaCatalog.length === 0) return;
            const models = buildModelOptions(orcaCatalog, 'vision', modality, currentProvider.id);
            handleOrcaCatalogChange(models);
        },
        [currentProvider, orcaCatalog, handleOrcaCatalogChange],
    );

    useEffect(() => {
        setDirty(false);
        if (isModalOpen && currentProvider) {
            initializeSelectedModels();
            let defaultModelId = currentProvider.selectedModel?.id;

            if (!defaultModelId && currentProvider.models && currentProvider.models.length > 0) {
                defaultModelId = currentProvider.models[0].id;
            }

            // 设置表单值
            form.setFieldsValue({
                apiKey: currentProvider.apiKey || '',
                apiHost: currentProvider.apiHost || '',
                model: defaultModelId,
            });
        }
    }, [isModalOpen, selectProviderId]);

    const validateApiHost = async () => {
        if (!currentProvider) return;

        setTesting(true);

        try {
            const apiKey = form.getFieldValue('apiKey');
            const apiHost = form.getFieldValue('apiHost');
            const selectedModelId = form.getFieldValue('model');

            if (needsApiKey && !apiKey) {
                message.error(t('pleaseEnterApiKey'));
                setTesting(false);
                return;
            }

            const model =
                currentProvider.models.find((m) => m.id === selectedModelId) ||
                currentProvider.models[0];

            const newProvider = {
                ...currentProvider,
                apiKey,
                apiHost,
                selectedModel: model,
            };

            llmStore.updateProvider(newProvider);

            const { valid, error } = await LangChainService.checkApiProvider(newProvider);

            if (valid) {
                setApiKeyValidated(true);
                message.success(t('apiValidSuccess'));
            } else {
                setApiKeyValidated(false);
                message.error(error?.message || t('apiValidFailed'));
            }
        } catch (error) {
            console.error('API 验证错误:', error);
            setApiKeyValidated(false);

            if (error instanceof Error) {
                message.error(error.message);
            } else {
                message.error(String(error));
            }
        } finally {
            setTesting(false);
        }
    };

    const onUpdateApiHost = () => {
        const { apiHost } = form.getFieldsValue();
        if (!currentProvider) return;
        llmStore.updateProvider({ ...currentProvider, apiHost });
    };

    const availableModels = isOrca ? orcaModels : (currentProvider?.models ?? []);

    const onModelChange = (modelId: string) => {
        if (!currentProvider) return;
        const model = availableModels.find((m) => m.id === modelId);
        if (model) {
            llmStore.updateProvider({
                ...currentProvider,
                selectedModel: model,
            });
        }
    };

    const handleOk = async () => {
        const { apiKey, apiHost, model: selectedModelId } = form.getFieldsValue();

        if (currentProvider && !apiHost) {
            message.error(t('pleaseEnterApiHost'));
            return;
        }

        // The PKCE entry satisfies the credential requirement with a key it
        // obtained itself, so an empty paste field is not an error there.
        const requiresPastedKey = needsApiKey && !isOrca;
        if (currentProvider && requiresPastedKey && !apiKey) {
            message.error(t('pleaseEnterApiKey'));
            return;
        }

        if (currentProvider && selectedModelId) {
            const model = (isOrca ? orcaModels : currentProvider.models).find(
                (m) => m.id === selectedModelId,
            );
            if (model) {
                llmStore.updateProvider({
                    ...currentProvider,
                    apiKey,
                    apiHost,
                    selectedModel: model,
                });
            }
        }

        if (chrome && chrome.runtime) {
            try {
                if (currentProvider) {
                    await chrome.runtime.sendMessage({
                        action: 'providerSettingsUpdated',
                        provider: currentProvider.id,
                        timestamp: Date.now(),
                    });
                }
            } catch (error) {
                console.error('Failed to notify about provider settings update:', error);
            }
        }
        onOk();
        setApiKeyValidated(false);
    };

    // @ts-ignore
    const providerConfig = (PROVIDER_CONFIG as any)[currentProvider?.id] || {};
    const officialWebsite = providerConfig?.websites?.official;
    const apiKeyWebsite = providerConfig?.websites?.apiKey;
    const modelsPage = providerConfig?.websites?.models;
    const docs = providerConfig?.websites?.docs;

    return (
        <Modal
            title={
                currentProvider ? <Space>
                        <Avatar size="small" src={getProviderLogo(currentProvider.id)} />
                        {`配置 ${getProviderName(currentProvider)}`}
                    </Space> : null
            }
            open={isModalOpen}
            onOk={handleOk}
            onCancel={() => {
                onCancel();
                setApiKeyValidated(false);
                setDirty(false);
                setOrcaModels([]);
                setOrcaCatalog([]);
                setOrcaModality('text');
                setOrcaCatalogState('');
            }}
            width={600}
            footer={[
                <Button
                    key="test"
                    type="default"
                    onClick={validateApiHost}
                    loading={testing}
                    icon={apiKeyValidated ? <CheckCircleOutlined /> : null}
                >
                    {testing ? '测试中...' : apiKeyValidated ? '连接成功' : '测试连接'}
                </Button>,
                <Button
                    key="cancel"
                    onClick={() => {
                        onCancel();
                        setApiKeyValidated(false);
                    }}
                >
                    取消
                </Button>,
                <Button key="save" type="primary" onClick={handleOk}>
                    保存
                </Button>,
            ]}
        >
            <Form form={form} layout="vertical" requiredMark={false}>
                {isOrca && currentProvider ? (
                    // OrcaRouter exposes both credential choices here instead of a
                    // bare key field. The model selector below is fed from the
                    // discovered catalog, never from a free-text field.
                    <OrcaRouterAuthModal
                        provider={currentProvider}
                        siblingProvider={siblingOrcaProvider}
                        inputModality={orcaModality}
                        onInputModalityChange={handleOrcaModalityChange}
                        apiKeyDraft={(form.getFieldValue('apiKey') as string) || ''}
                        onApiKeyDraftChange={(value) => {
                            form.setFieldsValue({ apiKey: value });
                            onUpdateApiHost();
                        }}
                        onModelCatalogChange={handleOrcaCatalogChange}
                        onDirty={() => setDirty(true)}
                    />
                ) : null}

                {!isOrca && (!currentProvider || needsApiKey) ? (
                    <Form.Item
                        label={
                            <Space>
                                <KeyOutlined />
                                <span>API 密钥</span>
                            </Space>
                        }
                        tooltip="您的密钥仅存储在本地，请放心填写"
                    >
                        <Form.Item
                            name="apiKey"
                            rules={[
                                {
                                    required: needsApiKey,
                                    message: '请输入 API 密钥',
                                },
                            ]}
                            noStyle
                        >
                            <Input.Password 
                                id="tour-api-key-input"
                                placeholder="您的密钥存储在您本地，请放心填写" 
                            />
                        </Form.Item>
                        {apiKeyWebsite ? <Button
                                icon={<KeyOutlined />}
                                type="link"
                                href={apiKeyWebsite}
                                target="_blank"
                                style={{ textAlign: 'left', padding: 0 }}
                            >
                                获取 API 密钥
                            </Button> : null}
                    </Form.Item>
                ) : null}

                <Form.Item
                    label={
                        <Space>
                            <GlobalOutlined />
                            <span>API 地址</span>
                        </Space>
                    }
                    name="apiHost"
                    rules={[{ required: true, message: '请输入 API 地址' }]}
                    tooltip="如果不确定，请保留默认值"
                >
                    <Input placeholder="请输入 API 地址" onBlur={onUpdateApiHost} />
                </Form.Item>

                <Form.Item
                    label={
                        <Space>
                            <CodeOutlined />
                            <span>默认模型</span>
                        </Space>
                    }
                    name="model"
                    rules={[{ required: true, message: '请选择默认模型' }]}
                >
                    <Select
                        data-testid="provider-model-select"
                        // Scoped so the model overlay is clearly delineated
                        // against the settings panel behind it.
                        popupClassName="provider-model-dropdown"
                        placeholder="请选择默认模型"
                        showSearch
                        optionFilterProp="label"
                        loading={isOrca ? orcaLoadingModels : undefined}
                        notFoundContent={
                            isOrca && !orcaLoadingModels ? t('orcarouterCatalogEmpty') : undefined
                        }
                        options={getModelGroupOptions(availableModels)}
                        onChange={onModelChange}
                    />
                </Form.Item>
                {isOrca ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <ReloadOutlined
                            spin={orcaLoadingModels}
                            onClick={async () => {
                                if (!currentProvider) return;
                                setOrcaLoadingModels(true);
                                try {
                                    const { models: catalog, source, degradedReason } =
                                        await requestModelsForProvider(currentProvider, 'all');
                                    setOrcaCatalog(catalog);
                                    setOrcaModels(
                                        buildModelOptions(
                                            catalog,
                                            'vision',
                                            orcaModality,
                                            currentProvider.id,
                                        ),
                                    );
                                    setOrcaCatalogState(
                                        resolveCatalogState(source, catalog.length, degradedReason),
                                    );
                                    setOrcaCatalogDegraded(source !== 'live');
                                } finally {
                                    setOrcaLoadingModels(false);
                                }
                            }}
                        />
                        <Text
                            data-testid="provider-catalog-state"
                            style={{ fontSize: 12, color: orcaCatalogDegraded ? '#faad14' : '#52c41a' }}
                        >
                            {orcaLoadingModels
                                ? t('orcarouterCatalogLoading')
                                : orcaCatalogState || t('orcarouterCatalogEmpty')}
                        </Text>
                    </div> : null}

                <div>
                    {officialWebsite ? <Button
                            icon={<GlobalOutlined />}
                            type="link"
                            href={officialWebsite}
                            target="_blank"
                            style={{ textAlign: 'left' }}
                        >
                            官网
                        </Button> : null}
                    {docs ? <Button
                            icon={<CodeOutlined />}
                            type="link"
                            href={docs}
                            target="_blank"
                            style={{ textAlign: 'left' }}
                        >
                            官方文档
                        </Button> : null}
                    {modelsPage ? <Button
                            icon={<GlobalOutlined />}
                            type="link"
                            href={modelsPage}
                            target="_blank"
                            style={{ textAlign: 'left' }}
                        >
                            模型列表
                        </Button> : null}
                </div>

                {apiKeyValidated ? <Card
                        style={{
                            marginBottom: 16,
                            backgroundColor: '#f6ffed',
                            border: '1px solid #b7eb8f',
                        }}
                        size="small"
                    >
                        <Space>
                            <CheckCircleOutlined style={{ color: '#52c41a' }} />
                            <Text>API 连接测试成功</Text>
                        </Space>
                    </Card> : null}
            </Form>
        </Modal>
    );
};

export default ConfigModal;
