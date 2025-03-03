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
    models: { label: string; value: string }[]; // 该服务商支持的模型列表
    apiKeyUrl?: string; // 获取 API Key 的 URL
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

export interface ChatParams {
    message: string;
    provider: string;
    model: string;
    apiKey: string;
    onMessage: (content: string) => void;
    onError: (error: any) => void;
    onFinish: (result: string) => void;
}
