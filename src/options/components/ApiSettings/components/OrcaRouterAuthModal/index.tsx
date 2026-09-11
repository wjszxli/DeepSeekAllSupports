import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Input, Select, Space, Tag, Tooltip, Typography, message } from 'antd';
import {
    CheckCircleOutlined,
    DisconnectOutlined,
    KeyOutlined,
    LinkOutlined,
    ReloadOutlined,
    SafetyCertificateOutlined,
    WarningOutlined,
} from '@ant-design/icons';

import { t } from '@/locales/i18n';
import type { Model, Provider } from '@/types';
import {
    ORCA_APP_NAME,
    ORCA_KEY_DASHBOARD_URL,
    ORCA_DEFAULT_API_BASE_URL,
    ORCA_DEFAULT_AUTH_BASE_URL,
    ORCA_OAUTH_PROVIDER_ID,
    ORCA_PROVIDER_ID,
} from '@/orcarouter/constants';
import {
    checkApiKeyFormat,
    createApiKeyAdapter,
    type OrcaCredential,
} from '@/orcarouter/credentials';
import {
    OrcaLoginController,
    type OrcaLoginError,
    type OrcaLoginState,
} from '@/orcarouter/loginSession';
import {
    buildModelOptions,
    describeCredential,
    originsForProvider,
    reconcileSelection,
    requestModelsForProvider,
    resolveCatalogState,
} from '@/orcarouter/provider';
import type { OrcaInputModality, OrcaModel } from '@/orcarouter/catalog';
import orcaRouterStore from '@/orcarouter/store';

import './index.scss';

const { Text, Link } = Typography;

/** Both OrcaRouter entries, shown in the shared-credential note. */
const PROVIDER_IDS_LABEL = `${ORCA_PROVIDER_ID} / ${ORCA_OAUTH_PROVIDER_ID}`;

export type OrcaAuthChoice = 'api-key' | 'pkce';

interface OrcaRouterAuthModalProps {
    provider: Provider;
    /** The other OrcaRouter entry, shown so the shared-credential rule is visible. */
    siblingProvider?: Provider | null;
    apiKeyDraft: string;
    /** Input type the next request will carry; drives the capability filter. */
    inputModality: OrcaInputModality;
    onInputModalityChange: (modality: OrcaInputModality) => void;
    onApiKeyDraftChange: (value: string) => void;
    onModelCatalogChange: (models: Model[]) => void;
    onDirty: () => void;
}

/** Input types a user can filter the OrcaRouter catalog by. */
const INPUT_MODALITY_OPTIONS: { label: string; value: OrcaInputModality }[] = [
    { label: 'Text', value: 'text' },
    { label: 'Image', value: 'image' },
    { label: 'Audio', value: 'audio' },
    { label: 'Video', value: 'video' },
];

/**
 * The OrcaRouter configuration panel.
 *
 * Both credential choices are shown side by side and are independently usable:
 * a user with an existing key never has to start a browser login, and a user
 * without one never has to go find a key. Both end up producing the same
 * `sk-orca-…` credential for the shared inference adapter.
 *
 * The API key stays in a draft held by the parent form until the user saves;
 * the PKCE flow writes directly through the credential store because it has
 * just obtained the key itself.
 */
const OrcaRouterAuthModal: React.FC<OrcaRouterAuthModalProps> = ({
    provider,
    siblingProvider,
    apiKeyDraft,
    inputModality,
    onInputModalityChange,
    onApiKeyDraftChange,
    onModelCatalogChange,
    onDirty,
}) => {
    const isPkceEntry = provider.id === ORCA_OAUTH_PROVIDER_ID;

    const storedCredential = orcaRouterStore.read(provider.id);
    const [choice, setChoice] = useState<OrcaAuthChoice>(
        storedCredential?.source === 'pkce' || isPkceEntry ? 'pkce' : 'api-key',
    );

    const [loginState, setLoginState] = useState<OrcaLoginState | null>(null);
    const [codeDraft, setCodeDraft] = useState('');
    const [catalog, setCatalog] = useState<OrcaModel[]>([]);
    const [catalogSummary, setCatalogSummary] = useState<string>('');
    const [catalogDegraded, setCatalogDegraded] = useState(false);
    const [loadingModels, setLoadingModels] = useState(false);
    const [selectionCleared, setSelectionCleared] = useState(false);

    const controllerRef = useRef<OrcaLoginController | null>(null);
    const mountedRef = useRef(true);
    const openAuthPageRef = useRef<number>(0);

    // Recomputed whenever a write lands. `orcaRouterStore.metadata` is read
    // directly (not memoized on it) because mobx re-renders this observer on
    // every write, so the read always sees the current generation.
    const credential: OrcaCredential | null = orcaRouterStore.read(provider.id);

    /* ---------------- catalog ---------------- */

    const loadCatalog = useCallback(
        async (options: { silent?: boolean } = {}) => {
            if (!options.silent) setLoadingModels(true);
            try {
                const { models, source, degradedReason } = await requestModelsForProvider(
                    provider,
                    'all',
                );
                if (!mountedRef.current) return;
                setCatalog(models);
                setCatalogSummary(resolveCatalogState(source, models.length, degradedReason));
                setCatalogDegraded(source !== 'live');
                onModelCatalogChange(buildModelOptions(models, 'vision', inputModality, provider.id));
            } finally {
                if (mountedRef.current) setLoadingModels(false);
            }
        },
        [provider, onModelCatalogChange, inputModality],
    );

    useEffect(() => {
        /* fire-and-forget */ loadCatalog({ silent: true });
        // Reload when the credential or the origin changes: a different key can
        // see a different set of models in the same workspace.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [provider.id, provider.apiHost, credential?.generation]);

    /**
     * Input-type changes re-filter the *already loaded* catalog — no second
     * network call — and reconcile the current selection: a model that does not
     * accept the new input type is cleared rather than silently kept.
     */
    const handleInputModalityChange = useCallback(
        (modality: OrcaInputModality) => {
            onInputModalityChange(modality);
            if (catalog.length === 0) return;
            const { valid } = reconcileSelection(
                catalog,
                provider.selectedModel?.id,
                'vision',
                modality,
            );
            onModelCatalogChange(buildModelOptions(catalog, 'vision', modality, provider.id));
            // Only surface the notice when a real selection was invalidated.
            setSelectionCleared(!valid && Boolean(provider.selectedModel?.id));
        },
        [catalog, onInputModalityChange, onModelCatalogChange, provider],
    );

    /* ---------------- PKCE login lifecycle ---------------- */

    const releaseController = useCallback(() => {
        controllerRef.current?.dispose();
        controllerRef.current = null;
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        // Unmount: drop server work without writing UI state.
        return () => {
            mountedRef.current = false;
            releaseController();
        };
    }, [releaseController]);

    // Buffer back-forward cache handling: the guarded `finally` of the aborted
    // exchange correctly refuses to mutate state, so busy/hint must be cleared
    // synchronously here or a restored page stays permanently busy.
    useEffect(() => {
        const handlePageHide = () => {
            controllerRef.current?.handlePageHide();
        };
        window.addEventListener('pagehide', handlePageHide);
        return () => window.removeEventListener('pagehide', handlePageHide);
    }, []);

    const persistCredential = useCallback(
        (next: OrcaCredential, attemptId: number) => {
            // `attemptId` is the controller's own generation guard, passed so a
            // caller can correlate; the controller only invokes this for the
            // attempt it currently owns.
            if (attemptId < 1) return;
            orcaRouterStore.write({ ...next, providerId: provider.id });
            onApiKeyDraftChange(next.apiKey);
            onDirty();
            message.success(t('orcarouterConnected'));
            /* fire-and-forget */ loadCatalog();
        },
        [provider.id, onApiKeyDraftChange, onDirty, loadCatalog],
    );

    const ensureController = useCallback((): OrcaLoginController => {
        if (controllerRef.current) return controllerRef.current;
        const controller = new OrcaLoginController({
            providerId: provider.id,
            origins: originsForProvider(provider),
            source: 'pkce',
            callbacks: {
                onStateChange: (state) => {
                    if (!mountedRef.current) return;
                    setLoginState(state);
                },
                onCredential: persistCredential,
            },
        });
        controllerRef.current = controller;
        return controller;
    }, [provider, persistCredential]);

    const handleConnect = useCallback(async () => {
        releaseController();
        setCodeDraft('');
        const controller = ensureController();
        const state = await controller.begin('oob');
        openAuthPageRef.current += 1;
        // Opening the consent screen is a user gesture from this click.
        if (state.authorizeUrl) {
            window.open(state.authorizeUrl, '_blank', 'noopener,noreferrer');
        }
    }, [ensureController, releaseController]);

    const handleCancelLogin = useCallback(() => {
        controllerRef.current?.cancel();
        setCodeDraft('');
    }, []);

    const handleSubmitCode = useCallback(async () => {
        const controller = controllerRef.current;
        if (!controller) return;
        const result = await controller.submitCode(codeDraft);
        if (!mountedRef.current) return;
        if (!result.ok) {
            // The controller already surfaced the sanitized message; clear the
            // single-use code so the user is not tempted to resubmit it.
            setCodeDraft('');
        }
    }, [codeDraft]);

    /* ---------------- API key ---------------- */

    const handleApiKeyChange = (value: string) => {
        onApiKeyDraftChange(value);
        onDirty();
    };

    const handleUseApiKey = () => {
        setChoice('api-key');
        // Switching authentication method must release any in-flight login.
        controllerRef.current?.cancel();
        releaseController();
        setCodeDraft('');
    };

    const handleSaveApiKey = async () => {
        const formatError = checkApiKeyFormat(apiKeyDraft);
        if (formatError) {
            message.error(formatError);
            return;
        }
        const adapter = createApiKeyAdapter({
            providerId: provider.id,
            apiKey: apiKeyDraft,
            store: orcaRouterStore.credentialStore,
        });
        const result = await adapter.acquire();
        if (!result.ok) {
            message.error(result.error.message);
            return;
        }
        onDirty();
        message.success(t('orcarouterConnected'));
        /* fire-and-forget */ loadCatalog();
    };

    const handleDisconnect = () => {
        handleCancelLogin();
        orcaRouterStore.clear(provider.id);
        onApiKeyDraftChange('');
        onDirty();
        setCatalogSummary('');
        setCatalogDegraded(false);
        onModelCatalogChange([]);
    };

    /* ---------------- derived UI state ---------------- */

    const status = loginState?.status ?? 'idle';
    const busy = status === 'awaiting-authorization' || status === 'exchanging';
    const loginError: OrcaLoginError | null = loginState?.error ?? null;
    const isConnected = Boolean(credential?.apiKey) && credential?.status === 'active';
    const needsReauth = credential?.status === 'needsReauth';

    const loginErrorMessage = useMemo(() => {
        if (!loginError) return null;
        switch (loginError.code) {
            case 'denied':
                return t('orcarouterLoginDenied');
            case 'timeout':
                return t('orcarouterLoginTimeout');
            case 'cancelled':
                return t('orcarouterLoginCancelled');
            case 'code_expired_or_used':
            case 'verifier_mismatch':
                return t('orcarouterLoginExpired');
            case 'rate_limited':
                return t('orcarouterLoginRateLimited');
            case 'network':
                return t('orcarouterLoginNetwork');
            case 'scope_downgrade':
                return t('orcarouterLoginScope');
            default:
                return loginError.message;
        }
    }, [loginError]);

    return (
        <div className="orca-auth" data-testid="orcarouter-auth-panel">
            <p className="orca-auth__intro">{t('orcarouterAuthMethodsDesc')}</p>

            <div className="orca-auth__choices" role="radiogroup" aria-label={t('orcarouterAuthMethods')}>
                <div
                    className={`orca-auth__choice ${
                        choice === 'api-key' ? 'orca-auth__choice--selected' : ''
                    }`}
                    data-testid="orcarouter-choice-api-key"
                >
                    <div className="orca-auth__choice-header">
                        <KeyOutlined />
                        <span>{t('orcarouterApiKeyChoice')}</span>
                    </div>
                    <div className="orca-auth__choice-desc">{t('orcarouterApiKeyChoiceDesc')}</div>
                    <Button
                        size="small"
                        type={choice === 'api-key' ? 'primary' : 'default'}
                        data-testid="orcarouter-select-api-key"
                        onClick={handleUseApiKey}
                    >
                        {t('orcarouterApiKeyChoice')}
                    </Button>
                </div>

                <div
                    className={`orca-auth__choice ${
                        choice === 'pkce' ? 'orca-auth__choice--selected' : ''
                    }`}
                    data-testid="orcarouter-choice-pkce"
                >
                    <div className="orca-auth__choice-header">
                        <SafetyCertificateOutlined />
                        <span>{t('orcarouterPkceChoice')}</span>
                    </div>
                    <div className="orca-auth__choice-desc">{t('orcarouterPkceChoiceDesc')}</div>
                    <Button
                        size="small"
                        type={choice === 'pkce' ? 'primary' : 'default'}
                        data-testid="orcarouter-select-pkce"
                        onClick={() => setChoice('pkce')}
                    >
                        {t('orcarouterPkceChoice')}
                    </Button>
                </div>
            </div>

            {choice === 'api-key' && (
                <div className="orca-auth__field">
                    <Text strong>{t('orcarouterApiKeyLabel')}</Text>
                    <Space.Compact style={{ width: '100%' }}>
                        <Input.Password
                            id="orcarouter-api-key-input"
                            data-testid="orcarouter-api-key-input"
                            value={apiKeyDraft}
                            onChange={(event) => handleApiKeyChange(event.target.value)}
                            placeholder={t('orcarouterApiKeyPlaceholder')}
                            autoComplete="off"
                            // Explicit: the key must never be readable from the DOM.
                            type="password"
                        />
                        <Button
                            type="primary"
                            data-testid="orcarouter-save-api-key"
                            onClick={handleSaveApiKey}
                        >
                            {t('save')}
                        </Button>
                    </Space.Compact>
                    <span className="orca-auth__hint">{t('orcarouterApiKeyHint')}</span>
                    <Link href={ORCA_KEY_DASHBOARD_URL} target="_blank" rel="noreferrer">
                        {t('orcarouterGetApiKey')}
                    </Link>
                </div>
            )}

            {choice === 'pkce' && (
                <div className="orca-auth__field">
                    {!busy && (
                        <Button
                            type="primary"
                            icon={<LinkOutlined />}
                            data-testid="orcarouter-connect"
                            onClick={handleConnect}
                        >
                            {t('orcarouterConnect')}
                        </Button>
                    )}

                    {busy ? <>
                            <Text strong>{t('orcarouterConnecting')}</Text>
                            <span className="orca-auth__hint">{loginState?.hint ?? ''}</span>
                            {loginState?.authorizeUrl ? <div className="orca-auth__authorize-url">
                                    <Input
                                        readOnly
                                        value={loginState.authorizeUrl}
                                        data-testid="orcarouter-authorize-url"
                                        onFocus={(event) => event.target.select()}
                                    />
                                    <Tooltip title={t('orcarouterOpenAuthPage')}>
                                        <Button
                                            icon={<LinkOutlined />}
                                            onClick={() =>
                                                window.open(
                                                    loginState.authorizeUrl ?? '',
                                                    '_blank',
                                                    'noopener,noreferrer',
                                                )
                                            }
                                        />
                                    </Tooltip>
                                </div> : null}
                            <Space.Compact style={{ width: '100%' }}>
                                <Input
                                    data-testid="orcarouter-code-input"
                                    value={codeDraft}
                                    onChange={(event) => setCodeDraft(event.target.value)}
                                    placeholder={t('orcarouterPasteCodePlaceholder')}
                                    autoComplete="off"
                                />
                                <Button
                                    type="primary"
                                    data-testid="orcarouter-submit-code"
                                    onClick={handleSubmitCode}
                                    disabled={!codeDraft.trim()}
                                >
                                    {t('orcarouterSubmitCode')}
                                </Button>
                            </Space.Compact>
                            <Button
                                size="small"
                                data-testid="orcarouter-cancel-login"
                                onClick={handleCancelLogin}
                            >
                                {t('orcarouterCancelLogin')}
                            </Button>
                        </> : null}
                </div>
            )}

            {isConnected ? <div className="orca-auth__status" data-testid="orcarouter-status">
                    <Space>
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        <span>
                            {credential?.source === 'pkce'
                                ? t('orcarouterConnectedPkce')
                                : t('orcarouterConnectedApi')}
                        </span>
                        <Tag>{describeCredential(credential)}</Tag>
                    </Space>
                    <Button
                        size="small"
                        icon={<DisconnectOutlined />}
                        data-testid="orcarouter-disconnect"
                        onClick={handleDisconnect}
                    >
                        {t('orcarouterDisconnect')}
                    </Button>
                </div> : null}

            {needsReauth ? <div className="orca-auth__status orca-auth__status--warning" data-testid="orcarouter-needs-reauth">
                    <Space>
                        <WarningOutlined style={{ color: '#faad14' }} />
                        <span>{t('orcarouterNeedsReauth')}</span>
                    </Space>
                    <Button
                        size="small"
                        data-testid="orcarouter-reconnect"
                        onClick={() => {
                            setChoice('pkce');
                            /* fire-and-forget */ handleConnect();
                        }}
                    >
                        {t('orcarouterRetry')}
                    </Button>
                </div> : null}

            {loginErrorMessage ? <Alert
                    type={loginError?.code === 'cancelled' ? 'info' : 'error'}
                    showIcon
                    message={loginErrorMessage}
                    data-testid="orcarouter-login-error"
                    action={
                        <Button
                            size="small"
                            data-testid="orcarouter-login-retry"
                            onClick={() => {
                                setChoice('pkce');
                                /* fire-and-forget */ handleConnect();
                            }}
                        >
                            {t('orcarouterRetry')}
                        </Button>
                    }
                /> : null}

            <div className="orca-auth__field">
                <Text strong>{t('orcarouterInputTypeLabel')}</Text>
                <Select
                    data-testid="orcarouter-input-modality"
                    size="small"
                    value={inputModality}
                    options={INPUT_MODALITY_OPTIONS}
                    onChange={(value) => handleInputModalityChange(value as OrcaInputModality)}
                    style={{ maxWidth: 180 }}
                />
                <span className="orca-auth__hint">{t('orcarouterInputTypeHint')}</span>
            </div>

            {selectionCleared ? <Alert
                    type="warning"
                    showIcon
                    message={t('orcarouterModelCleared')}
                    data-testid="orcarouter-model-cleared"
                /> : null}

            <div className="orca-auth__catalog">
                <span
                    className={`orca-auth__catalog-dot ${
                        catalogDegraded ? 'orca-auth__catalog-dot--degraded' : ''
                    }`}
                />
                <span data-testid="orcarouter-catalog-state">
                    {loadingModels
                        ? t('orcarouterCatalogLoading')
                        : catalogSummary || t('orcarouterCatalogEmpty')}
                </span>
                <Button
                    size="small"
                    type="text"
                    icon={<ReloadOutlined />}
                    loading={loadingModels}
                    aria-label={t('orcarouterCatalogRefresh')}
                    data-testid="orcarouter-catalog-refresh"
                    onClick={() => /* fire-and-forget */ loadCatalog()}
                />
            </div>

            <Text type="secondary" style={{ fontSize: 12 }}>
                {t('orcarouterAuthBaseLabel')}: {ORCA_DEFAULT_AUTH_BASE_URL} ·{' '}
                {t('orcarouterApiBaseLabel')}: {ORCA_DEFAULT_API_BASE_URL}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
                {t('orcarouterSelfHostedHint')} {ORCA_APP_NAME}
            </Text>

            {siblingProvider ? <Text type="secondary" style={{ fontSize: 12 }} data-testid="orcarouter-shared-credential-note">
                    {PROVIDER_IDS_LABEL}: {siblingProvider.name}
                </Text> : null}
        </div>
    );
};

export default OrcaRouterAuthModal;
