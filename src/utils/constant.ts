import type { ProviderConfig } from '@/typings';

export const SERVICE_MAP = {
    DeepSeek: {
        chat: '/chat/completions',
    },
    Ollama: {
        chat: '/api/chat',
        modelList: '/api/tags',
    },
    SiliconFlow: {
        chat: '/v1/chat/completions',
    },
    Tencent: {
        chat: '/v1/chat/completions',
    },
    Baidu: {
        chat: '/v2/chat/completions',
    },
    Aliyun: {
        chat: '/compatible-mode/v1/chat/completions',
    },
};

export const PROVIDERS_DATA: Record<string, ProviderConfig> = {
    DeepSeek: {
        name: 'DeepSeek',
        apiKey: null,
        apiKeyUrl: 'https://platform.deepseek.com/api_keys',
        models: [
            { label: 'V3', value: 'deepseek-chat' },
            { label: 'R1', value: 'deepseek-reasoner' },
        ],
    },
    Ollama: {
        name: '本地 Ollama',
        apiKey: null,
        apiKeyUrl: 'https://ollama.com/api_keys',
        models: [],
    },
    SiliconFlow: {
        name: '硅基流动',
        apiKey: null,
        apiKeyUrl: 'https://cloud.siliconflow.cn/account/ak',
        models: [
            { label: 'V3', value: 'deepseek-ai/DeepSeek-V3' },
            { label: 'R1', value: 'deepseek-ai/DeepSeek-R1' },
            { label: 'pro-R1', value: 'Pro/deepseek-ai/DeepSeek-R1' },
            { label: 'pro-v3', value: 'Pro/deepseek-ai/DeepSeek-V3' },
            { label: 'r1-llama-70b', value: 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B' },
            { label: 'r1-llama-32b', value: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B' },
            { label: 'r1-llama-14b', value: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B' },

            {
                label: 'deepseek-ai/DeepSeek-R1-Distill-Llama-8B',
                value: 'deepseek-ai/DeepSeek-R1-Distill-Llama-8B',
            },
            {
                label: 'Pro/deepseek-ai/DeepSeek-R1-Distill-Llama-8B',
                value: 'Pro/deepseek-ai/DeepSeek-R1-Distill-Llama-8B',
            },
            {
                label: 'nvidia/Llama-3.1-Nemotron-70B-Instruct',
                value: 'nvidia/Llama-3.1-Nemotron-70B-Instruct',
            },
            {
                label: 'meta-llama/Meta-Llama-3.1-405B-Instruct',
                value: 'meta-llama/Meta-Llama-3.1-405B-Instruct',
            },
            {
                label: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
                value: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
            },
            {
                label: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
                value: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
            },
            { label: 'google/gemma-2-27b-it', value: 'google/gemma-2-27b-it' },
            { label: 'google/gemma-2-9b-it', value: 'google/gemma-2-9b-it' },
            { label: '01-ai/Yi-1.5-34B-Chat-16K', value: '01-ai/Yi-1.5-34B-Chat-16K' },
            { label: '01-ai/Yi-1.5-9B-Chat-16K', value: '01-ai/Yi-1.5-9B-Chat-16K' },
            { label: '01-ai/Yi-1.5-6B-Chat', value: '01-ai/Yi-1.5-6B-Chat' },
            { label: 'THUDM/glm-4-9b-chat', value: 'THUDM/glm-4-9b-chat' },
            {
                label: 'Vendor-A/Qwen/Qwen2.5-72B-Instruct',
                value: 'Vendor-A/Qwen/Qwen2.5-72B-Instruct',
            },
            {
                label: 'internlm/internlm2_{5}-7b-chat',
                value: 'internlm/internlm2_{5}-7b-chat',
            },
            {
                label: 'internlm/internlm2_{5}-20b-chat',
                value: 'internlm/internlm2_{5}-20b-chat',
            },
            { label: 'Pro/Qwen/Qwen2.5-7B-Instruct', value: 'Pro/Qwen/Qwen2.5-7B-Instruct' },
            { label: 'Pro/Qwen/Qwen2-7B-Instruct', value: 'Pro/Qwen/Qwen2-7B-Instruct' },
            { label: 'Pro/Qwen/Qwen2-1.5B-Instruct', value: 'Pro/Qwen/Qwen2-1.5B-Instruct' },
            { label: 'Pro/THUDM/chatglm3-6b', value: 'Pro/THUDM/chatglm3-6b' },
            { label: 'Pro/THUDM/glm-4-9b-chat', value: 'Pro/THUDM/glm-4-9b-chat' },
            {
                label: 'Pro/meta-llama/Meta-Llama-3.1-8B-Instruct',
                value: 'Pro/meta-llama/Meta-Llama-3.1-8B-Instruct',
            },
            { label: 'Pro/google/gemma-2-9b-it', value: 'Pro/google/gemma-2-9b-it' },
        ],
    },
    Tencent: {
        name: '腾讯云',
        apiKey: null,
        apiKeyUrl: 'https://console.cloud.tencent.com/lkeap/api',
        models: [
            { label: 'V3', value: 'deepseek-v3' },
            { label: 'R1', value: 'deepseek-r1' },
        ],
    },
    Baidu: {
        name: '百度云',
        apiKey: null,
        apiKeyUrl: 'https://console.bce.baidu.com/iam/#/iam/apikey/list',
        models: [
            { label: 'V3', value: 'deepseek-v3' },
            { label: 'R1', value: 'deepseek-r1' },
        ],
    },
    Aliyun: {
        name: '阿里云',
        apiKey: null,
        apiKeyUrl: 'https://bailian.console.aliyun.com/?apiKey=1#/api-key',
        models: [
            { label: 'V3', value: 'deepseek-v3' },
            { label: 'R1', value: 'deepseek-r1' },
        ],
    },
};

export const URL_MAP = {
    DeepSeek: 'https://api.deepseek.com',
    Ollama: 'http://127.0.0.1:11434',
    SiliconFlow: 'https://api.siliconflow.com',
    Tencent: 'https://api.lkeap.cloud.tencent.com',
    Baidu: 'https://qianfan.baidubce.com',
    Aliyun: 'https://dashscope.aliyuncs.com',
};

export const CHAT_BOX_ID = 'custom-chat-box';
export const CHAT_BUTTON_ID = 'custom-chat-button';

export const GIT_URL = 'https://github.com/wjszxli/DeepSeekAllSupports';

export const MODIFY_HEADERS_RULE_ID = 1001;

export const tags = ['think', 'reason', 'reasoning', 'thought'];

export const SHORTCUTS_URL = 'chrome://extensions/shortcuts';
