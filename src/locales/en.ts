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
    showIconTooltip: 'Show a small icon when text is selected on web pages',
    chatWindowSize: 'Chat Window Size',
    chatWindowSizeTooltip: 'Set the default size of the chat window (width × height)',
    width: 'Width',
    height: 'Height',
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

    // Web search
    webSearch: 'Web Search',
    webSearchTooltip: 'Enable web search for real-time information',
    on: 'On',
    off: 'Off',
    searchingWeb: 'Searching the web for information...',
    searchComplete: 'Search complete. Processing results with AI...',
    noSearchResults: 'No search results found. Using AI knowledge only...',
    exclusiveFeatureError:
        'Web search and webpage context cannot be enabled at the same time. Please enable only one of them.',
    exclusiveFeatureWarning:
        'Web search and webpage context cannot be enabled at the same time. Please enable only one of them.',

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
    webpageContent: "The following is the content of the webpage I'm currently viewing:",
    webpagePrompt: 'Given this webpage content, please answer my question',
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
        'A powerful browser extension that integrates DeepSeek and other AI models into your browsing experience.',

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
    summarizePage: `
Please provide a structured summary of the following webpage, including these three sections:
1. Summary: Concisely summarize the core content of the webpage, highlighting the main information or themes.
2. Details: Elaborate on the main content of the webpage, including background, key points, processes, technical details (if applicable), or relevant information.
3. Insights: Outline the core value points of the webpage, such as main conclusions, important impacts, innovations, implications, or recommendations.
Please ensure your response is clear and specific, providing effective guidance for readers while considering personal interests and goals. Additionally, provide practical examples and resources to help readers better understand and apply learning strategies.
    Webpage content: {content}
    `,

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
};
