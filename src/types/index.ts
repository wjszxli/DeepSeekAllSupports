import type OpenAI from 'openai';
import type { Chunk } from './chunk';
import type { Message } from './message';

declare global {
    interface Window {
        currentAbortController?: AbortController;
    }
}

// 定义请求方法类型
export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface FetchOptions {
    url: string;
    method?: RequestMethod;
    body?: any;
    headers?: Record<string, string>;
    timeout?: number; // 超时时间（毫秒）
    apiKey?: string | null;
    service?: string | null;
}

export interface ProviderConfig {
    name: string; // 当前服务商的名称
    apiKey: string | null; // 当前服务商的 API Key
    apiHost: string; // 当前服务商的 API Host
    models: { label: string; value: string }[]; // 该服务商支持的模型列表
    apiKeyUrl?: string; // 获取 API Key 的 URL
    selectedModel: string | null; // 当前选中的模型
    selected: boolean; // 是否选中
    requiresApiKey?: boolean; // 是否需要 API Key
}

export interface StorageData {
    providers: Record<string, ProviderConfig>; // 存储所有服务商的配置信息
    selectedProvider: string | null; // 当前选中的服务商
    selectedModel: string | null; // 当前选中的模型
}

export interface IMessage {
    role: string;
    content: string;
}

export interface OllamaResponse {
    model: string;
    created_at: string;
    message: {
        role: string;
        content: string;
    };
    done: boolean;
}

// 搜索结果接口
export interface SearchResult {
    title: string;
    link: string;
    snippet: string;
    thinking?: string; // 添加思考部分，可选
    source: string; // 添加来源
}

export interface ChatParams {
    message: string;
    provider: string;
    model: string;
    apiKey: string;
    onMessage: (content: string) => void;
    onError: (error: any) => void;
    onFinish: (result: string) => void;
}

export interface ChatMessage {
    id: number;
    text: string;
    thinking?: string;
    sender: 'user' | 'ai' | 'system';
}

// Chrome Side Panel API type definitions
declare global {
    namespace chrome {
        namespace sidePanel {
            function open(options: { windowId?: number; tabId?: number }): Promise<void>;
            function setOptions(options: {
                tabId?: number;
                path?: string;
                enabled?: boolean;
            }): Promise<void>;
            function setPanelBehavior(behavior: { openPanelOnActionClick: boolean }): Promise<void>;
            function getOptions(options: { tabId?: number }): Promise<{ path: string }>;
        }
    }
}

export interface WebsiteMetadata {
    system: {
        language: string;
    };
    website: {
        url: string;
        origin: string;
        title: string;
        content: string;
        type: string;
        selection: string;
        hash?: string;
        language?: string;
        favicons?: string[];
        og?: any;
    };
    id?: string;
}

export type ModelType =
    | 'text'
    | 'vision'
    | 'embedding'
    | 'reasoning'
    | 'function_calling'
    | 'web_search';

export interface Model {
    id: string;
    provider: string;
    name: string;
    group: string;
    owned_by?: string;
    description?: string;
    type?: ModelType[];
}

export type ProviderType =
    | 'openai'
    | 'openai-response'
    | 'anthropic'
    | 'gemini'
    | 'qwenlm'
    | 'azure-openai';

export interface Provider {
    id: string;
    type: ProviderType;
    name: string;
    apiKey: string;
    apiHost: string;
    apiVersion?: string;
    models: Model[];
    selectedModel?: Model;
    enabled?: boolean;
    isSystem?: boolean;
    isAuthed?: boolean;
    rateLimit?: number;
    isNotSupportArrayContent?: boolean;
    notes?: string;
    requiresApiKey?: boolean; // Whether this provider requires an API key, defaults to true
}

export enum UserMessageStatus {
    SUCCESS = 'success',
}

export enum RobotMessageStatus {
    PROCESSING = 'processing',
    PENDING = 'pending',
    SUCCESS = 'success',
    PAUSED = 'paused',
    ERROR = 'error',
}

export type Usage = OpenAI.Completions.CompletionUsage & {
    thoughts_tokens?: number;
};

export interface Metrics {
    completion_tokens: number;
    time_completion_millsec: number;
    time_first_token_millsec?: number;
    time_thinking_millsec?: number;
}

export interface RobotMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface Robot {
    id: string;
    name: string;
    prompt: string;
    type: string;
    icon?: string;
    description?: string;
    model?: Model;
    defaultModel?: Model;
    messages?: RobotMessage[];
    topics: Topic[];
    selectedTopicId?: string;
    showPrompt?: boolean; // Whether to display the prompt in the chat interface
    isSystem?: boolean; // 是否为系统机器人
    cannotDelete?: boolean; // 是否不可删除
}

export interface CompletionsParams {
    messages: Message[];
    robot: Robot;
    onChunk: (chunk: Chunk) => void;
    onFilterMessages?: (messages: Message[]) => void;
    abortController?: AbortController;
}

export interface Topic {
    id: string;
    assistantId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    messages: Message[];
    pinned?: boolean;
    prompt?: string;
    isNameManuallyEdited?: boolean;
}

export enum ConfigModelType {
    CHAT = 'chat',
    POPUP = 'popup',
    SIDEBAR = 'sidebar',
}
