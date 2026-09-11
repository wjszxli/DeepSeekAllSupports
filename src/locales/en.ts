// 自动生成的翻译文件，请勿直接修改
// Generated on: 2025-03-12T03:10:07.890Z

export const en = {
    ok: 'OK',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    copy: 'Copy',
    regenerate: 'Regenerate',
    settings: 'Settings',
    stop: 'Stop',
    validated: 'Validated',
    aiAssistant: 'AI Assistant',
    you: 'You',
    edit: 'Edit',
    clear: 'Clear',
    create: 'Create',

    // Suggested prompts
    suggestedPrompt1: 'Explain the difference between deep learning and machine learning',
    suggestedPrompt2: 'Help me optimize a Python code',
    suggestedPrompt3: 'How to improve English speaking skills',
    suggestedPrompt4: 'Recommend some classic science fiction novels',

    // App and interface
    appTitle: 'AI Tool',
    assistants: 'Assistants',
    topics: 'Topics',
    expand: 'Expand',
    collapse: 'Collapse',

    // Page summary
    pageSummary: 'Page Summary',
    summarizePage: 'Summarize Page',
    summarizeCurrentPage: 'Summarize Current Page',
    generateSummary: 'Generate Summary',
    refreshSummary: 'Refresh Summary',
    copySummary: 'Copy Summary',
    regenerateSummary: 'Regenerate',

    // Topic management
    newTopic: 'New Topic',
    searchTopics: 'Search topics...',
    noTopicsFound: 'No topics found',
    noTopics: 'No topics yet',
    createTopic: 'Create Topic',
    editTopic: 'Edit Topic',
    enterTopicName: 'Enter topic name',
    topicNameRequired: 'Topic name is required',
    topicCreated: 'Topic created successfully',
    topicUpdated: 'Topic updated successfully',
    topicDeleted: 'Topic deleted successfully',
    deleteTopicConfirm: 'Confirm Delete Topic',
    deleteTopicContent: 'Are you sure you want to delete topic',
    question: '?',

    // Configuration and API
    saveConfig: 'Save Configuration',
    savingConfig: 'Saving Configuration',
    serviceProvider: 'Service Provider',
    selectProvider: 'Please select a service provider',
    apiKey: 'API Key',
    enterApiKey: 'Please enter your API Key',
    getApiKey: 'Get API Key',
    validate: 'Validate',
    apiHost: 'API Host',
    enterApiHost: 'Please enter your API Host',
    modelSelection: 'Model Selection',
    selectModel: 'Please select a model',
    showIcon: 'Show icon when text is selected',
    showFloatingButton: 'Show floating chat button',
    setShortcuts: 'Set Shortcuts',
    starAuthor: 'Star the Author | Contact',
    configSaved: 'Configuration saved',
    validatingApi: 'Validating API key',
    apiValidSuccess: 'API Key validation successful, the tool is ready to use',
    apiValidFailed: 'API Key validation failed',
    savingConfigError: 'Failed to save configuration. Please try again.',

    // Chat interface
    send: 'Send',
    thinking: 'AI is thinking...',
    interrupted: 'Interrupted',
    assistant: 'AI ASSISTANT',
    includeWebpage: 'Include webpage context in questions',
    includeWebpageTooltip:
        'Enable this feature to allow AI to use the content of the current webpage for answers',
    showFloatingButtonTooltip:
        'Enable this feature to show a floating chat button in the bottom-right corner for quick conversations',
    askWebpage: 'Ask about this webpage...',
    sendMessage: 'Send a message...',
    interfaceSettings: 'Interface Settings',
    exampleSummarize: 'Summarize this webpage for me',
    errorProcessing: 'Error processing message, please try again',
    errorRegenerating: 'Error regenerating response, please try again',
    copied: 'Copied to clipboard',
    failedCopy: 'Failed to copy',
    codeCopied: 'Code copied',
    failedCodeCopy: 'Failed to copy code',
    selectProviderFirst: 'Please select a provider first',
    processing: 'Processing...',

    // Language settings
    language: 'Language',
    languageEn: 'English',
    languageZhCN: '简体中文',
    languageZhTW: '繁體中文',
    languageJa: '日本語',
    languageKo: '한국어',
    languageChanged: 'Language changed successfully',

    // Input and interaction
    typeMessage: 'Type a message...',
    askAnything: 'Ask me anything about this webpage or any general questions',
    exampleMainPoints: 'What are the main points discussed here?',
    exampleHowToUse: 'How can I use this information?',
    unpinWindow: 'Unpin Window',
    pinWindow: 'Fixed Window',
    clearMessages: 'Clear Messages',
    confirmClearMessages: 'Confirm Clear Messages',
    clearMessagesDescription:
        'Are you sure you want to clear all messages? This action cannot be undone.',
    confirm: 'Confirm',

    // Web search
    webSearch: 'Web Search',
    webSearchTooltip: 'Enable web search for real-time information',
    on: 'On',
    off: 'Off',
    searchingWeb: 'Searching the web for information...',
    searchComplete: 'Search complete. Processing results with AI...',
    noSearchResults: 'No search results found. Using AI knowledge only...',
    // Quick actions
    think: 'Thinking content',
    translate: 'Translate',
    translatePrompt: 'Translate the following text to English: ',
    summarize: 'Summarize',
    summarizePrompt: 'Summarize the following text in a concise manner: ',
    explain: 'Explain',
    explainPrompt: 'Explain the following concept in simple terms: ',
    codeReview: 'Code Review',
    codeReviewPrompt: 'Review the following code and suggest improvements: ',
    rewrite: 'Rewrite',
    rewritePrompt: 'Rewrite the following text to make it more professional: ',

    // Web search results
    webSearchResultsTips1:
        'Here are some recent information from the web that might help answer this query:',
    webSearchResultsTips2:
        'Based on this information and your knowledge, please answer this question',
    Source: 'Source',
    webpageContent: 'Here is the content of the webpage I am currently browsing:',
    webpagePrompt: `Please answer the question based on the current webpage content.

## Current Webpage Content:

{content}

## User Question:

{question}

Please answer in the same language as the user's question.`,
    fetchWebpageContent: 'Fetching current webpage content...',
    fetchWebpageContentSuccess: 'Successfully fetched webpage content, processing with AI...',
    fetchWebpageContentFailed: 'Failed to fetch webpage content. Using AI knowledge only...',

    // Navigation
    openSettings: 'Open Settings',
    openChat: 'Open Chat',
    openSidebar: 'Summarize Current Page',
    welcomeMessage: 'Welcome to AI Assistant! How can I help you?',
    tryAsking: 'Try asking me:',
    copyMessage: 'Copy Success',
    close: 'Close',
    pleaseInputApiKey: 'Please enter your API Key in the configuration page.',

    // Reference prompt
    REFERENCE_PROMPT: `Please answer the question based on the reference materials.

## Annotation Rules:
- Please cite the context at the end of the sentence when appropriate.
- Please use the format [number] to reference the corresponding part in the answer.
- If a sentence is derived from multiple contexts, please list all relevant reference numbers, for example [1][2]. Remember not to concentrate the references at the end but to list them in the corresponding parts of the answer.

## My question is:

{question}

## Reference Materials:

{references}

Please answer in the same language as the user's question.`,

    // Search settings
    filteredDomains: 'Filtered Domain Names',
    searchEngines: 'Enabled search engines',
    pressTip: 'Press Enter to send, Shift+Enter to create a new line.',
    apiSettings: 'API Settings',
    interface: 'Interface',
    search: 'Search',
    about: 'About',
    tavilyApiKey: 'Tavily API Key',
    enterTavilyApiKey: 'Please enter Tavily API Key',
    getTavilyApiKey: 'Get Tavily API Key',
    exaApiKey: 'Exa API Key',
    enterExaApiKey: 'Please enter Exa API Key',
    getExaApiKey: 'Get Exa API Key',
    bochaApiKey: 'Bocha API Key',
    enterBochaApiKey: 'Please enter Bocha API Key',
    getBochaApiKey: 'Get Bocha API Key',
    selectAtLeastOneSearchEngine:
        'Please select at least one search engine when web search is enabled',
    selectAtMostThreeSearchEngines: 'You can select at most 3 search engines',
    noFilteredDomains: 'No filtered domains',
    enterDomainToFilter: 'Enter domain to filter',
    add: 'Add',
    enableWebSearchMessage: 'Enable Web Search to configure search settings.',
    aboutDescription:
        'A powerful browser extension that integrates Ai and other AI models into your browsing experience.',

    // Auto-save
    autoSaving: 'Saving...',
    autoSaved: 'Changes saved',
    autoSaveError: 'Error saving changes',
    validatingTavilyApi: 'Validating Tavily API Key...',
    tavilyApiValidSuccess: 'Tavily API Key validation successful',
    tavilyApiValidError: 'Tavily API Key validation failed',

    // Feedback
    feedback: 'Give Feedback',
    apiKeyNeeded:
        'You need to set up your API Key to use this feature. Would you like to go to the settings page now?',

    // System and errors
    systemPrompt: "You are an AI assistant, please answer the user's question",
    modelListNotSupported: 'The current service provider does not support model listing',
    pleaseSelectProvider: 'Please select a service provider first',
    pleaseEnterApiKey: 'Please enter an API Key',
    providerBaseUrlNotFound: 'Base URL for {provider} not found',
    httpError: 'HTTP {status} {statusText}',
    invalidProviderData: 'Invalid data, service provider not found: {provider}',
    backgroundSearchFailed: 'Background search failed',
    webContentFetchFailed: 'Failed to fetch web content in background',
    baiduSearchFailed: 'Baidu search request failed, status code: {status}',
    googleSearchFailed: 'Google search request failed, status code: {status}',
    duckduckgoSearchFailed: 'DuckDuckGo search request failed, status code: {status}',
    sogouSearchFailed: 'Sogou search request failed, status code: {status}',
    braveSearchFailed: 'Brave search request failed, status code: {status}',
    searxngSearchFailed: 'SearXNG search request failed, status code: {status}',
    enterQuestion: 'Please enter your question...',

    // Logging related translations
    options_tab_logging: 'Logging',
    options_logging_settings: 'Logging Settings',
    options_logging_enabled: 'Enable Logging',
    options_logging_level: 'Logging Level',
    options_logging_level_debug: 'Debug',
    options_logging_level_info: 'Info',
    options_logging_level_warn: 'Warning',
    options_logging_level_error: 'Error',
    options_logging_include_timestamp: 'Include Timestamp',
    options_logging_to_console: 'Log to Console',
    options_logging_persist: 'Persist Logs',
    options_logging_max_persisted: 'Maximum Persisted Logs',
    options_logging_clear: 'Clear Logs',
    options_logging_settings_saved: 'Logging settings saved',
    options_logging_settings_save_failed: 'Failed to save logging settings',
    options_logging_cleared: 'Logs cleared',
    options_logging_clear_failed: 'Failed to clear logs',

    // Chat management
    clearConfirmTitle: 'Clear Chat History',
    clearConfirmContent: 'Are you sure you want to clear the chat history?',
    chatCleared: 'Chat history cleared',
    chatWithAI: 'Chat with AI',
    clearChat: 'Clear Chat',
    startChat: 'Start Chat',
    defaultTopicName: 'New Conversation',
    ai: 'AI',

    // HTTP Error messages
    errorDefault: 'An unknown error occurred. Please try again later.',
    error400: 'Bad Request: The server could not understand the request.',
    error401: 'Unauthorized: Authentication is required and has failed or not yet been provided.',
    error403: 'Forbidden: You do not have permission to access this resource.',
    error404: 'Not Found: The requested resource could not be found.',
    error429: 'Too Many Requests: You have sent too many requests in a given amount of time.',
    error500:
        'Internal Server Error: The server has encountered a situation it does not know how to handle.',
    error502: 'Bad Gateway: The server received an invalid response from an upstream server.',
    error503: 'Service Unavailable: The server is not ready to handle the request.',
    error504:
        'Gateway Timeout: The server did not receive a timely response from an upstream server.',

    // Provider names
    provider_silicon: 'Silicon',
    provider_aihubmix: 'AiHubMix',
    provider_ocoolai: 'ocoolAI',
    provider_deepseek: 'deepseek',
    provider_openrouter: 'OpenRouter',
    provider_ppio: 'PPIO',

    provider_infini: 'Infini',
    provider_qiniu: 'Qiniu',
    provider_dmxapi: 'DMXAPI',
    provider_o3: 'O3',
    provider_ollama: 'Ollama',
    provider_lmstudio: 'LM Studio',
    provider_anthropic: 'Anthropic',
    provider_openai: 'OpenAI',
    provider_azure_openai: 'Azure OpenAI',
    provider_gemini: 'Gemini',
    provider_zhipu: 'ZhiPu',
    provider_github: 'Github Models',
    provider_copilot: 'Github Copilot',
    provider_yi: 'Yi',
    provider_moonshot: 'Moonshot AI',
    provider_baichuan: 'BAICHUAN AI',
    provider_dashscope: 'Bailian',
    provider_stepfun: 'StepFun',
    provider_doubao: 'doubao',
    provider_minimax: 'MiniMax',
    provider_groq: 'Groq',
    provider_together: 'Together',
    provider_fireworks: 'Fireworks',
    provider_zhinao: 'zhinao',
    provider_hunyuan: 'hunyuan',
    provider_nvidia: 'nvidia',
    provider_grok: 'Grok',
    provider_hyperbolic: 'Hyperbolic',
    provider_mistral: 'Mistral',
    provider_jina: 'Jina',
    provider_gitee_ai: 'gitee ai',
    provider_perplexity: 'Perplexity',
    provider_modelscope: 'ModelScope',
    provider_xirang: 'Xirang',
    provider_tencent_cloud_ti: 'Tencent Cloud TI',
    provider_baidu_cloud: 'Baidu Cloud',
    provider_gpustack: 'GPUStack',
    provider_voyageai: 'VoyageAI',

    // Model settings
    modelSettings: 'Model Settings',
    chatModel: 'Chat Model',
    popupModel: 'Popup Model',
    sidebarModel: 'Sidebar Model',
    chatModelDescription: 'Select the model used for the main chat interface',
    popupModelDescription: 'Select the model used for the popup window',
    sidebarModelDescription: 'Select the model used for the sidebar panel',
    modelProvider: 'Provider',
    modelName: 'Model',
    selectModelFirst: 'Please select a model first',
    modelSettingsSaved: 'Model settings saved successfully',
    failedToLoadModelSettings: 'Failed to load model settings',
    failedToSaveModelSettings: 'Failed to save model settings',
    noProvidersConfigured: 'No providers configured. Please set up providers in API Settings first',
    modelSettingsInfo:
        'Configure different AI models for each interface. Your selections will be saved automatically.',

    // Search related
    searchResults: 'Search Results',
    results: 'results',
    searchQuery: 'Search Query',
    contentFetched: 'Content Fetched',
    searching: 'Searching',
    using: 'Using',
    clickToOpenAll: 'Click any result to open all links',

    // Tour related
    tourWelcome: 'Welcome to the Setup Guide',
    tourWelcomeDesc:
        'I will guide you through the basic configuration of the plugin to help you get started quickly.',
    tourApiDesc:
        'First, configure your AI model service providers, which is the foundation for using the assistant. You can add multiple providers and set priorities.',
    tourModelDesc:
        'Here, select and configure specific AI models, adjusting parameters for the best conversation experience.',
    tourInterfaceDesc:
        'Personalize your interface, including themes, languages, display options, etc., to create your exclusive user experience.',
    tourSearchDesc:
        'Configure search engines to enable the AI assistant to obtain the latest web information to answer your questions.',
    tourComplete: 'Configuration Complete',
    tourCompleteDesc:
        'Congratulations! You have completed the basic configuration. Now you can start using the Ai assistant.',
    tourFinished: 'Setup guide completed!',
    startTour: 'Start Setup Guide',
    guide: 'Guide',
    apiKeyInput: 'API Key Input',
    tourApiKeyDesc:
        'Please enter your API key here. Your key is stored locally only, so please feel free to enter it. If you don\'t have a key, you can click the "Get API Key" link below.',
    tourGetApiKey: 'Get API Key',
    tourGetApiKeyDesc:
        'Click the "Get API Key" button to obtain your API key, then paste it into the input box above.',
    tourSaveConfig: 'Save Configuration',
    tourSaveConfigDesc:
        'After filling in the API key, click the "Save" button to save your configuration.',
    tourChatModel: 'Configure Chat Interface Model',
    tourChatModelDesc:
        'Select the AI model to use in the chat interface. This will be the model used when you interact with AI on the main chat page.',
    tourPopupModel: 'Configure Popup Interface Model',
    tourPopupModelDesc:
        'Select the AI model to use in the popup interface. This model will be used when you select text on a webpage and use quick functions.',
    tourSidebarModel: 'Configure Sidebar Model',
    tourSidebarModelDesc:
        'Select the AI model to use in the sidebar. This will be the model used when you interact with AI in the browser sidebar.',
    tourNext: 'Next',
    tourPrev: 'Previous',
    tourFinish: 'Finish',
    tourSelectionToolbar: 'Configure Selection Toolbar',
    tourSelectionToolbarDesc:
        'When enabled, you will see quick action buttons when selecting text on web pages, allowing for easy translation, summarization, and other operations.',
    tourWebpageContext: 'Configure Webpage Context',
    tourWebpageContextDesc:
        'When enabled, the AI can access the current webpage content as context to provide more accurate and relevant responses.',
    tourWebSearch: 'Configure Web Search',
    tourWebSearchDesc:
        'When enabled, the AI can search for the latest web information to answer your questions, providing more accurate and timely responses.',
    tourSearchEngines: 'Select Search Engines',
    tourSearchEnginesDesc:
        'Choose the search engines you want to use. It is recommended to select multiple search engines for more comprehensive search results.',
    tourStarAuthor: 'Star the Author',
    tourStarAuthorDesc:
        'If you find this tool useful, please give the author a star on GitHub to support the development of open source projects!',
    // OrcaRouter provider (API key + OAuth 2.0 PKCE)
    provider_orcarouter: 'OrcaRouter - API',
    provider_orcarouter_oauth: 'OrcaRouter - Auth',
    orcarouterAuthMethods: 'OrcaRouter sign-in',
    orcarouterAuthMethodsDesc: 'Choose how to connect. Both options produce the same OrcaRouter API key and use the same models.',
    orcarouterApiKeyChoice: 'Use an API key',
    orcarouterApiKeyChoiceDesc: 'Paste a key you already created in the OrcaRouter console.',
    orcarouterPkceChoice: 'Connect with OrcaRouter',
    orcarouterPkceChoiceDesc: 'Authorize in your browser with OAuth 2.0 + PKCE. No client secret and no redirect URI to register.',
    orcarouterApiKeyLabel: 'OrcaRouter API Key',
    orcarouterApiKeyPlaceholder: 'sk-orca-...',
    orcarouterApiKeyHint: 'Stored locally with your other provider keys. Never sent anywhere except OrcaRouter.',
    orcarouterGetApiKey: 'Open OrcaRouter key settings',
    orcarouterConnect: 'Connect with OrcaRouter',
    orcarouterConnecting: 'Waiting for authorization...',
    orcarouterAuthorizeHint: 'Approve in the tab that just opened, then paste the code OrcaRouter shows you.',
    orcarouterOpenAuthPage: 'Reopen the authorization page',
    orcarouterPasteCode: 'Authorization code',
    orcarouterPasteCodePlaceholder: 'Paste the code shown by OrcaRouter',
    orcarouterSubmitCode: 'Finish connecting',
    orcarouterCancelLogin: 'Cancel',
    orcarouterRetry: 'Try again',
    orcarouterConnected: 'Connected',
    orcarouterConnectedApi: 'Using a pasted API key',
    orcarouterConnectedPkce: 'Connected with your OrcaRouter account',
    orcarouterNeedsReauth: 'This OrcaRouter key was revoked or replaced. Reconnect to continue.',
    orcarouterDisconnect: 'Disconnect',
    orcarouterDisconnectConfirm: 'Remove the stored OrcaRouter credential from this device?',
    orcarouterLoginDenied: 'Authorization was declined in the browser.',
    orcarouterLoginTimeout: 'The authorization window closed. Start the connection again.',
    orcarouterLoginCancelled: 'Authorization cancelled.',
    orcarouterLoginExpired: 'That authorization code is expired, already used, or does not match this attempt.',
    orcarouterLoginRateLimited: 'Too many OrcaRouter authorizations were started recently. The existing connection is reused automatically; try again later.',
    orcarouterLoginNetwork: 'Could not reach OrcaRouter. Check your connection and try again.',
    orcarouterLoginScope: 'OrcaRouter granted a scope that is not enough for inference. Ask a workspace admin to allow the api scope, or paste an API key instead.',
    orcarouterModelCatalog: 'Model catalog',
    orcarouterCatalogLive: '{count} models from OrcaRouter',
    orcarouterCatalogDegraded: 'OrcaRouter unreachable: showing {count} verified fallback models',
    orcarouterCatalogRefresh: 'Refresh model list',
    orcarouterCatalogLoading: 'Loading OrcaRouter models...',
    orcarouterCatalogEmpty: 'OrcaRouter returned no models usable by this client.',
    orcarouterModelCleared: 'The previous model is not available for this input. Select another one.',
    orcarouterAuthBaseLabel: 'Authorization server',
    orcarouterApiBaseLabel: 'Inference API base URL',
    orcarouterSelfHostedHint: 'Leave the defaults unless you run a self-hosted OrcaRouter.',
    orcarouterInputTypeLabel: 'Model input type',
    orcarouterInputTypeHint: 'Restrict the model list to models that accept this input. Changing it re-filters the list and clears an incompatible selection.',
};
