import type { Model } from '@/types';

function isChatModel(model: Model): boolean {
    // If type is present, must include 'text' or 'reasoning' (for chat)
    if (Array.isArray(model.type)) {
        return model.type.includes('text') || model.type.includes('reasoning');
    }
    // Fallback: filter out known non-chat groups/names
    const nonChatKeywords = ['embedding', 'vision', 'rerank', 'code', 'tool', 'search', 'clip'];
    const lowerName = (model.name || '').toLowerCase();
    const lowerGroup = (model.group || '').toLowerCase();

    // Exclude if any non-chat keyword is present in name or group
    if (nonChatKeywords.some((k) => lowerName.includes(k) || lowerGroup.includes(k))) {
        return false;
    }

    // Exclude VL (Vision-Language) models using regex pattern
    if (
        /\bvl\b|\bvl[-_.]\w*|\bvl\d+/i.test(lowerName) ||
        /\bvl\b|\bvl[-_.]\w*|\bvl\d+/i.test(lowerGroup)
    ) {
        return false;
    }

    return true;
}

const RAW_SYSTEM_MODELS: Record<string, Model[]> = {
    'aihubmix': [
        {
            id: 'gpt-4o',
            provider: 'aihubmix',
            name: 'GPT-4o',
            group: 'GPT-4o',
        },
        {
            id: 'claude-3-5-sonnet-latest',
            provider: 'aihubmix',
            name: 'Claude 3.5 Sonnet',
            group: 'Claude 3.5',
        },
        {
            id: 'gemini-2.0-flash-exp-search',
            provider: 'aihubmix',
            name: 'Gemini 2.0 Flash Exp Search',
            group: 'Gemini 2.0',
        },
        {
            id: 'deepseek-chat',
            provider: 'aihubmix',
            name: 'DeepSeek Chat',
            group: 'DeepSeek Chat',
        },
        {
            id: 'aihubmix-Llama-3-3-70B-Instruct',
            provider: 'aihubmix',
            name: 'Llama-3.3-70b',
            group: 'Llama 3.3',
        },
        {
            id: 'Qwen/QVQ-72B-Preview',
            provider: 'aihubmix',
            name: 'Qwen/QVQ-72B',
            group: 'Qwen',
        },
    ],
    'o3': [
        {
            id: 'gpt-4o',
            provider: 'o3',
            name: 'GPT-4o',
            group: 'OpenAI',
        },
        {
            id: 'o1-mini',
            provider: 'o3',
            name: 'o1-mini',
            group: 'OpenAI',
        },
        {
            id: 'o1-preview',
            provider: 'o3',
            name: 'o1-preview',
            group: 'OpenAI',
        },
        {
            id: 'o3-mini',
            provider: 'o3',
            name: 'o3-mini',
            group: 'OpenAI',
        },
        {
            id: 'o3-mini-high',
            provider: 'o3',
            name: 'o3-mini-high',
            group: 'OpenAI',
        },
        {
            id: 'claude-3-7-sonnet-20250219',
            provider: 'o3',
            name: 'claude-3-7-sonnet-20250219',
            group: 'Anthropic',
        },
        {
            id: 'claude-3-5-sonnet-20241022',
            provider: 'o3',
            name: 'claude-3-5-sonnet-20241022',
            group: 'Anthropic',
        },
        {
            id: 'claude-3-5-haiku-20241022',
            provider: 'o3',
            name: 'claude-3-5-haiku-20241022',
            group: 'Anthropic',
        },
        {
            id: 'claude-3-opus-20240229',
            provider: 'o3',
            name: 'claude-3-opus-20240229',
            group: 'Anthropic',
        },
        {
            id: 'claude-3-haiku-20240307',
            provider: 'o3',
            name: 'claude-3-haiku-20240307',
            group: 'Anthropic',
        },
        {
            id: 'claude-3-5-sonnet-20240620',
            provider: 'o3',
            name: 'claude-3-5-sonnet-20240620',
            group: 'Anthropic',
        },
        {
            id: 'deepseek-ai/Deepseek-R1',
            provider: 'o3',
            name: 'DeepSeek R1',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-reasoner',
            provider: 'o3',
            name: 'deepseek-reasoner',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-chat',
            provider: 'o3',
            name: 'deepseek-chat',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-ai/DeepSeek-V3',
            provider: 'o3',
            name: 'DeepSeek V3',
            group: 'DeepSeek',
        },
        {
            id: 'text-embedding-3-small',
            provider: 'o3',
            name: 'text-embedding-3-small',
            group: '嵌入模型',
        },
        {
            id: 'text-embedding-ada-002',
            provider: 'o3',
            name: 'text-embedding-ada-002',
            group: '嵌入模型',
        },
        {
            id: 'text-embedding-v2',
            provider: 'o3',
            name: 'text-embedding-v2',
            group: '嵌入模型',
        },
        {
            id: 'Doubao-embedding',
            provider: 'o3',
            name: 'Doubao-embedding',
            group: '嵌入模型',
        },
        {
            id: 'Doubao-embedding-large',
            provider: 'o3',
            name: 'Doubao-embedding-large',
            group: '嵌入模型',
        },
    ],
    'ollama': [],
    'lmstudio': [],
    'silicon': [
        {
            id: 'deepseek-ai/DeepSeek-R1',
            name: 'deepseek-ai/DeepSeek-R1',
            provider: 'silicon',
            group: 'deepseek-ai',
        },
        {
            id: 'deepseek-ai/DeepSeek-V3',
            name: 'deepseek-ai/DeepSeek-V3',
            provider: 'silicon',
            group: 'deepseek-ai',
        },
        {
            id: 'Qwen/Qwen2.5-7B-Instruct',
            provider: 'silicon',
            name: 'Qwen2.5-7B-Instruct',
            group: 'Qwen',
        },
        {
            id: 'MiniMaxAI/MiniMax-M1-80k',
            name: 'MiniMax-M1-80k',
            provider: 'silicon',
            group: 'MiniMax',
        },
        {
            id: 'THUDM/GLM-Z1-32B-0414',
            name: 'GLM-Z1-32B-0414',
            provider: 'silicon',
            group: 'THUDM',
        },
        {
            id: 'THUDM/GLM-Z1-9B-0414',
            name: 'GLM-Z1-9B-0414',
            provider: 'silicon',
            group: '免费模型',
        },
        {
            id: 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B',
            name: 'DeepSeek-R1-0528-Qwen3-8B',
            provider: 'silicon',
            group: '免费模型',
        },
        {
            id: 'Qwen/Qwen3-8B',
            name: 'Qwen3-8B',
            provider: 'silicon',
            group: '免费模型',
        },
    ],
    'ppio': [
        {
            id: 'deepseek/deepseek-r1/community',
            name: 'DeepSeek: DeepSeek R1 (Community)',
            provider: 'ppio',
            group: 'deepseek',
        },
        {
            id: 'deepseek/deepseek-v3/community',
            name: 'DeepSeek: DeepSeek V3 (Community)',
            provider: 'ppio',
            group: 'deepseek',
        },
        {
            id: 'deepseek/deepseek-r1',
            provider: 'ppio',
            name: 'DeepSeek R1',
            group: 'deepseek',
        },
        {
            id: 'deepseek/deepseek-v3',
            provider: 'ppio',
            name: 'DeepSeek V3',
            group: 'deepseek',
        },
        {
            id: 'qwen/qwen-2.5-72b-instruct',
            provider: 'ppio',
            name: 'Qwen2.5-72B-Instruct',
            group: 'qwen',
        },
        {
            id: 'qwen/qwen2.5-32b-instruct',
            provider: 'ppio',
            name: 'Qwen2.5-32B-Instruct',
            group: 'qwen',
        },
        {
            id: 'deepseek/deepseek-r1-distill-llama-70b',
            provider: 'ppio',
            name: 'deepseek/deepseek-r1-distill-llama-70b',
            group: 'meta-llama',
        },
        {
            id: 'deepseek/deepseek-r1-distill-llama-8b',
            provider: 'ppio',
            name: 'deepseek/deepseek-r1-distill-llama-8b',
            group: 'meta-llama',
        },
        {
            id: '01-ai/yi-1.5-34b-chat',
            provider: 'ppio',
            name: 'Yi-1.5-34B-Chat',
            group: '01-ai',
        },
        {
            id: '01-ai/yi-1.5-9b-chat',
            provider: 'ppio',
            name: 'Yi-1.5-9B-Chat',
            group: '01-ai',
        },
    ],
    'openai': [
        { id: 'gpt-4.5-preview', provider: 'openai', name: ' gpt-4.5-preview', group: 'gpt-4.5' },
        { id: 'gpt-4o', provider: 'openai', name: ' GPT-4o', group: 'GPT 4o' },
        { id: 'gpt-4o-mini', provider: 'openai', name: ' GPT-4o-mini', group: 'GPT 4o' },
        { id: 'o1-mini', provider: 'openai', name: ' o1-mini', group: 'o1' },
        { id: 'o1-preview', provider: 'openai', name: ' o1-preview', group: 'o1' },
    ],
    'azure-openai': [
        {
            id: 'gpt-4o',
            provider: 'azure-openai',
            name: ' GPT-4o',
            group: 'GPT 4o',
        },
        {
            id: 'gpt-4o-mini',
            provider: 'azure-openai',
            name: ' GPT-4o-mini',
            group: 'GPT 4o',
        },
    ],
    'gemini': [
        {
            id: 'gemini-1.5-flash',
            provider: 'gemini',
            name: 'Gemini 1.5 Flash',
            group: 'Gemini 1.5',
        },
        {
            id: 'gemini-1.5-flash-8b',
            provider: 'gemini',
            name: 'Gemini 1.5 Flash (8B)',
            group: 'Gemini 1.5',
        },
        {
            id: 'gemini-1.5-pro',
            name: 'Gemini 1.5 Pro',
            provider: 'gemini',
            group: 'Gemini 1.5',
        },
        {
            id: 'gemini-2.0-flash',
            provider: 'gemini',
            name: 'Gemini 2.0 Flash',
            group: 'Gemini 2.0',
        },
    ],
    'anthropic': [
        {
            id: 'claude-3-7-sonnet-20250219',
            provider: 'anthropic',
            name: 'Claude 3.7 Sonnet',
            group: 'Claude 3.7',
        },
        {
            id: 'claude-3-5-sonnet-20241022',
            provider: 'anthropic',
            name: 'Claude 3.5 Sonnet',
            group: 'Claude 3.5',
        },
        {
            id: 'claude-3-5-haiku-20241022',
            provider: 'anthropic',
            name: 'Claude 3.5 Haiku',
            group: 'Claude 3.5',
        },
        {
            id: 'claude-3-5-sonnet-20240620',
            provider: 'anthropic',
            name: 'Claude 3.5 Sonnet (Legacy)',
            group: 'Claude 3.5',
        },
        {
            id: 'claude-3-opus-20240229',
            provider: 'anthropic',
            name: 'Claude 3 Opus',
            group: 'Claude 3',
        },
        {
            id: 'claude-3-haiku-20240307',
            provider: 'anthropic',
            name: 'Claude 3 Haiku',
            group: 'Claude 3',
        },
    ],
    'gitee-ai': [
        {
            id: 'DeepSeek-R1-Distill-Qwen-32B',
            name: 'DeepSeek-R1-Distill-Qwen-32B',
            provider: 'gitee-ai',
            group: 'DeepSeek',
        },
        {
            id: 'DeepSeek-R1-Distill-Qwen-1.5B',
            name: 'DeepSeek-R1-Distill-Qwen-1.5B',
            provider: 'gitee-ai',
            group: 'DeepSeek',
        },
        {
            id: 'DeepSeek-R1-Distill-Qwen-14B',
            name: 'DeepSeek-R1-Distill-Qwen-14B',
            provider: 'gitee-ai',
            group: 'DeepSeek',
        },
        {
            id: 'DeepSeek-R1-Distill-Qwen-7B',
            name: 'DeepSeek-R1-Distill-Qwen-7B',
            provider: 'gitee-ai',
            group: 'DeepSeek',
        },
        {
            id: 'DeepSeek-V3',
            name: 'DeepSeek-V3',
            provider: 'gitee-ai',
            group: 'DeepSeek',
        },
        {
            id: 'DeepSeek-R1',
            name: 'DeepSeek-R1',
            provider: 'gitee-ai',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-coder-33B-instruct',
            name: 'deepseek-coder-33B-instruct',
            provider: 'gitee-ai',
            group: 'DeepSeek',
        },
        {
            id: 'Qwen2.5-72B-Instruct',
            name: 'Qwen2.5-72B-Instruct',
            provider: 'gitee-ai',
            group: 'Qwen',
        },
        {
            id: 'Qwen2.5-14B-Instruct',
            name: 'Qwen2.5-14B-Instruct',
            provider: 'gitee-ai',
            group: 'Qwen',
        },
        {
            id: 'Qwen2-7B-Instruct',
            name: 'Qwen2-7B-Instruct',
            provider: 'gitee-ai',
            group: 'Qwen',
        },
        {
            id: 'Qwen2.5-32B-Instruct',
            name: 'Qwen2.5-32B-Instruct',
            provider: 'gitee-ai',
            group: 'Qwen',
        },
        {
            id: 'Qwen2-72B-Instruct',
            name: 'Qwen2-72B-Instruct',
            provider: 'gitee-ai',
            group: 'Qwen',
        },
        {
            id: 'Qwen2-VL-72B',
            name: 'Qwen2-VL-72B',
            provider: 'gitee-ai',
            group: 'Qwen',
        },
        {
            id: 'QwQ-32B-Preview',
            name: 'QwQ-32B-Preview',
            provider: 'gitee-ai',
            group: 'Qwen',
        },
        {
            id: 'Yi-34B-Chat',
            name: 'Yi-34B-Chat',
            provider: 'gitee-ai',
            group: '01-ai',
        },
        {
            id: 'glm-4-9b-chat',
            name: 'glm-4-9b-chat',
            provider: 'gitee-ai',
            group: 'THUDM',
        },
        {
            id: 'codegeex4-all-9b',
            name: 'codegeex4-all-9b',
            provider: 'gitee-ai',
            group: 'THUDM',
        },
        {
            id: 'InternVL2-8B',
            name: 'InternVL2-8B',
            provider: 'gitee-ai',
            group: 'OpenGVLab',
        },
        {
            id: 'InternVL2.5-26B',
            name: 'InternVL2.5-26B',
            provider: 'gitee-ai',
            group: 'OpenGVLab',
        },
        {
            id: 'InternVL2.5-78B',
            name: 'InternVL2.5-78B',
            provider: 'gitee-ai',
            group: 'OpenGVLab',
        },
        {
            id: 'bge-large-zh-v1.5',
            name: 'bge-large-zh-v1.5',
            provider: 'gitee-ai',
            group: 'BAAI',
        },
        {
            id: 'bge-small-zh-v1.5',
            name: 'bge-small-zh-v1.5',
            provider: 'gitee-ai',
            group: 'BAAI',
        },
        {
            id: 'bge-m3',
            name: 'bge-m3',
            provider: 'gitee-ai',
            group: 'BAAI',
        },
        {
            id: 'bce-embedding-base_v1',
            name: 'bce-embedding-base_v1',
            provider: 'gitee-ai',
            group: 'netease-youdao',
        },
    ],
    'deepseek': [
        {
            id: 'deepseek-chat',
            provider: 'deepseek',
            name: 'DeepSeek Chat',
            group: 'DeepSeek Chat',
        },
        {
            id: 'deepseek-reasoner',
            provider: 'deepseek',
            name: 'DeepSeek Reasoner',
            group: 'DeepSeek Reasoner',
        },
    ],
    'together': [
        {
            id: 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
            provider: 'together',
            name: 'Llama-3.2-11B-Vision',
            group: 'Llama-3.2',
        },
        {
            id: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
            provider: 'together',
            name: 'Llama-3.2-90B-Vision',
            group: 'Llama-3.2',
        },
        {
            id: 'google/gemma-2-27b-it',
            provider: 'together',
            name: 'gemma-2-27b-it',
            group: 'Gemma',
        },
        {
            id: 'google/gemma-2-9b-it',
            provider: 'together',
            name: 'gemma-2-9b-it',
            group: 'Gemma',
        },
    ],
    'ocoolai': [
        {
            id: 'deepseek-chat',
            provider: 'ocoolai',
            name: 'deepseek-chat',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-reasoner',
            provider: 'ocoolai',
            name: 'deepseek-reasoner',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-ai/DeepSeek-R1',
            provider: 'ocoolai',
            name: 'deepseek-ai/DeepSeek-R1',
            group: 'DeepSeek',
        },
        {
            id: 'HiSpeed/DeepSeek-R1',
            provider: 'ocoolai',
            name: 'HiSpeed/DeepSeek-R1',
            group: 'DeepSeek',
        },
        {
            id: 'ocoolAI/DeepSeek-R1',
            provider: 'ocoolai',
            name: 'ocoolAI/DeepSeek-R1',
            group: 'DeepSeek',
        },
        {
            id: 'Azure/DeepSeek-R1',
            provider: 'ocoolai',
            name: 'Azure/DeepSeek-R1',
            group: 'DeepSeek',
        },
        {
            id: 'gpt-4o',
            provider: 'ocoolai',
            name: 'gpt-4o',
            group: 'OpenAI',
        },
        {
            id: 'gpt-4o-all',
            provider: 'ocoolai',
            name: 'gpt-4o-all',
            group: 'OpenAI',
        },
        {
            id: 'gpt-4o-mini',
            provider: 'ocoolai',
            name: 'gpt-4o-mini',
            group: 'OpenAI',
        },
        {
            id: 'gpt-4',
            provider: 'ocoolai',
            name: 'gpt-4',
            group: 'OpenAI',
        },
        {
            id: 'o1-preview',
            provider: 'ocoolai',
            name: 'o1-preview',
            group: 'OpenAI',
        },
        {
            id: 'o1-mini',
            provider: 'ocoolai',
            name: 'o1-mini',
            group: 'OpenAI',
        },
        {
            id: 'claude-3-5-sonnet-20240620',
            provider: 'ocoolai',
            name: 'claude-3-5-sonnet-20240620',
            group: 'Anthropic',
        },
        {
            id: 'claude-3-5-haiku-20241022',
            provider: 'ocoolai',
            name: 'claude-3-5-haiku-20241022',
            group: 'Anthropic',
        },
        {
            id: 'gemini-pro',
            provider: 'ocoolai',
            name: 'gemini-pro',
            group: 'Gemini',
        },
        {
            id: 'gemini-1.5-pro',
            provider: 'ocoolai',
            name: 'gemini-1.5-pro',
            group: 'Gemini',
        },
        {
            id: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
            provider: 'ocoolai',
            name: 'Llama-3.2-90B-Vision-Instruct-Turbo',
            group: 'Llama-3.2',
        },
        {
            id: 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
            provider: 'ocoolai',
            name: 'Llama-3.2-11B-Vision-Instruct-Turbo',
            group: 'Llama-3.2',
        },
        {
            id: 'meta-llama/Llama-3.2-3B-Vision-Instruct-Turbo',
            provider: 'ocoolai',
            name: 'Llama-3.2-3B-Vision-Instruct-Turbo',
            group: 'Llama-3.2',
        },
        {
            id: 'google/gemma-2-27b-it',
            provider: 'ocoolai',
            name: 'gemma-2-27b-it',
            group: 'Gemma',
        },
        {
            id: 'google/gemma-2-9b-it',
            provider: 'ocoolai',
            name: 'gemma-2-9b-it',
            group: 'Gemma',
        },
        {
            id: 'Doubao-embedding',
            provider: 'ocoolai',
            name: 'Doubao-embedding',
            group: 'Doubao',
        },
        {
            id: 'text-embedding-3-large',
            provider: 'ocoolai',
            name: 'text-embedding-3-large',
            group: 'Embedding',
        },
        {
            id: 'text-embedding-3-small',
            provider: 'ocoolai',
            name: 'text-embedding-3-small',
            group: 'Embedding',
        },
        {
            id: 'text-embedding-v2',
            provider: 'ocoolai',
            name: 'text-embedding-v2',
            group: 'Embedding',
        },
    ],
    'github': [
        {
            id: 'gpt-4o',
            provider: 'github',
            name: 'OpenAI GPT-4o',
            group: 'OpenAI',
        },
    ],
    'copilot': [
        {
            id: 'gpt-4o-mini',
            provider: 'copilot',
            name: 'OpenAI GPT-4o-mini',
            group: 'OpenAI',
        },
    ],
    'yi': [
        {
            id: 'yi-lightning',
            name: 'Yi Lightning',
            provider: 'yi',
            group: 'yi-lightning',
            owned_by: '01.ai',
        },
        {
            id: 'yi-vision-v2',
            name: 'Yi Vision v2',
            provider: 'yi',
            group: 'yi-vision',
            owned_by: '01.ai',
        },
    ],
    'zhipu': [
        {
            id: 'glm-z1-air',
            provider: 'zhipu',
            name: 'GLM-Z1-AIR',
            group: 'GLM-Z1',
        },
        {
            id: 'glm-z1-airx',
            provider: 'zhipu',
            name: 'GLM-Z1-AIRX',
            group: 'GLM-Z1',
        },
        {
            id: 'glm-z1-flash',
            provider: 'zhipu',
            name: 'GLM-Z1-FLASH',
            group: 'GLM-Z1',
        },
        {
            id: 'glm-4-long',
            provider: 'zhipu',
            name: 'GLM-4-Long',
            group: 'GLM-4',
        },
        {
            id: 'glm-4-plus',
            provider: 'zhipu',
            name: 'GLM-4-Plus',
            group: 'GLM-4',
        },
        {
            id: 'glm-4-air-250414',
            provider: 'zhipu',
            name: 'GLM-4-Air-250414',
            group: 'GLM-4',
        },
        {
            id: 'glm-4-airx',
            provider: 'zhipu',
            name: 'GLM-4-AirX',
            group: 'GLM-4',
        },
        {
            id: 'glm-4-flash-250414',
            provider: 'zhipu',
            name: 'GLM-4-Flash-250414',
            group: 'GLM-4',
        },
        {
            id: 'glm-4-flashx',
            provider: 'zhipu',
            name: 'GLM-4-FlashX',
            group: 'GLM-4',
        },
        {
            id: 'glm-4v',
            provider: 'zhipu',
            name: 'GLM 4V',
            group: 'GLM-4v',
        },
        {
            id: 'glm-4v-flash',
            provider: 'zhipu',
            name: 'GLM-4V-Flash',
            group: 'GLM-4v',
        },
        {
            id: 'glm-4v-plus-0111',
            provider: 'zhipu',
            name: 'GLM-4V-Plus-0111',
            group: 'GLM-4v',
        },
        {
            id: 'glm-4-alltools',
            provider: 'zhipu',
            name: 'GLM-4-AllTools',
            group: 'GLM-4-AllTools',
        },
        {
            id: 'embedding-3',
            provider: 'zhipu',
            name: 'Embedding-3',
            group: 'Embedding',
        },
    ],
    'moonshot': [
        {
            id: 'moonshot-v1-auto',
            name: 'moonshot-v1-auto',
            provider: 'moonshot',
            group: 'moonshot-v1',
            owned_by: 'moonshot',
        },
    ],
    'baichuan': [
        {
            id: 'Baichuan4',
            provider: 'baichuan',
            name: 'Baichuan4',
            group: 'Baichuan4',
        },
        {
            id: 'Baichuan3-Turbo',
            provider: 'baichuan',
            name: 'Baichuan3 Turbo',
            group: 'Baichuan3',
        },
        {
            id: 'Baichuan3-Turbo-128k',
            provider: 'baichuan',
            name: 'Baichuan3 Turbo 128k',
            group: 'Baichuan3',
        },
    ],
    'modelscope': [
        {
            id: 'Qwen/Qwen2.5-72B-Instruct',
            name: 'Qwen/Qwen2.5-72B-Instruct',
            provider: 'modelscope',
            group: 'Qwen',
        },
        {
            id: 'Qwen/Qwen2.5-VL-72B-Instruct',
            name: 'Qwen/Qwen2.5-VL-72B-Instruct',
            provider: 'modelscope',
            group: 'Qwen',
        },
        {
            id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
            name: 'Qwen/Qwen2.5-Coder-32B-Instruct',
            provider: 'modelscope',
            group: 'Qwen',
        },
        {
            id: 'deepseek-ai/DeepSeek-R1',
            name: 'deepseek-ai/DeepSeek-R1',
            provider: 'modelscope',
            group: 'deepseek-ai',
        },
        {
            id: 'deepseek-ai/DeepSeek-V3',
            name: 'deepseek-ai/DeepSeek-V3',
            provider: 'modelscope',
            group: 'deepseek-ai',
        },
    ],
    'bailian': [
        {
            id: 'qwen-vl-plus',
            name: 'qwen-vl-plus',
            provider: 'dashscope',
            group: 'qwen-vl',
            owned_by: 'system',
        },
        {
            id: 'qwen-coder-plus',
            name: 'qwen-coder-plus',
            provider: 'dashscope',
            group: 'qwen-coder',
            owned_by: 'system',
        },
        {
            id: 'qwen-turbo',
            name: 'qwen-turbo',
            provider: 'dashscope',
            group: 'qwen-turbo',
            owned_by: 'system',
        },
        {
            id: 'qwen-plus',
            name: 'qwen-plus',
            provider: 'dashscope',
            group: 'qwen-plus',
            owned_by: 'system',
        },
        {
            id: 'qwen-max',
            name: 'qwen-max',
            provider: 'dashscope',
            group: 'qwen-max',
            owned_by: 'system',
        },
    ],
    'stepfun': [
        {
            id: 'step-1-8k',
            provider: 'stepfun',
            name: 'Step 1 8K',
            group: 'Step 1',
        },
        {
            id: 'step-1-flash',
            provider: 'stepfun',
            name: 'Step 1 Flash',
            group: 'Step 1',
        },
    ],
    'doubao': [
        {
            id: 'doubao-1-5-vision-pro-32k-250115',
            provider: 'doubao',
            name: 'doubao-1.5-vision-pro',
            group: 'Doubao-1.5-vision-pro',
        },
        {
            id: 'doubao-1-5-pro-32k-250115',
            provider: 'doubao',
            name: 'doubao-1.5-pro-32k',
            group: 'Doubao-1.5-pro',
        },
        {
            id: 'doubao-1-5-pro-32k-character-250228',
            provider: 'doubao',
            name: 'doubao-1.5-pro-32k-character',
            group: 'Doubao-1.5-pro',
        },
        {
            id: 'doubao-1-5-pro-256k-250115',
            provider: 'doubao',
            name: 'Doubao-1.5-pro-256k',
            group: 'Doubao-1.5-pro',
        },
        {
            id: 'deepseek-r1-250120',
            provider: 'doubao',
            name: 'DeepSeek-R1',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-r1-distill-qwen-32b-250120',
            provider: 'doubao',
            name: 'DeepSeek-R1-Distill-Qwen-32B',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-r1-distill-qwen-7b-250120',
            provider: 'doubao',
            name: 'DeepSeek-R1-Distill-Qwen-7B',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-v3-250324',
            provider: 'doubao',
            name: 'DeepSeek-V3',
            group: 'DeepSeek',
        },
        {
            id: 'doubao-pro-32k-241215',
            provider: 'doubao',
            name: 'Doubao-pro-32k',
            group: 'Doubao-pro',
        },
        {
            id: 'doubao-pro-32k-functioncall-241028',
            provider: 'doubao',
            name: 'Doubao-pro-32k-functioncall-241028',
            group: 'Doubao-pro',
        },
        {
            id: 'doubao-pro-32k-character-241215',
            provider: 'doubao',
            name: 'Doubao-pro-32k-character-241215',
            group: 'Doubao-pro',
        },
        {
            id: 'doubao-pro-256k-241115',
            provider: 'doubao',
            name: 'Doubao-pro-256k',
            group: 'Doubao-pro',
        },
        {
            id: 'doubao-lite-4k-character-240828',
            provider: 'doubao',
            name: 'Doubao-lite-4k-character-240828',
            group: 'Doubao-lite',
        },
        {
            id: 'doubao-lite-32k-240828',
            provider: 'doubao',
            name: 'Doubao-lite-32k',
            group: 'Doubao-lite',
        },
        {
            id: 'doubao-lite-32k-character-241015',
            provider: 'doubao',
            name: 'Doubao-lite-32k-character-241015',
            group: 'Doubao-lite',
        },
        {
            id: 'doubao-lite-128k-240828',
            provider: 'doubao',
            name: 'Doubao-lite-128k',
            group: 'Doubao-lite',
        },
        {
            id: 'doubao-1-5-lite-32k-250115',
            provider: 'doubao',
            name: 'Doubao-1.5-lite-32k',
            group: 'Doubao-lite',
        },
        {
            id: 'doubao-embedding-large-text-240915',
            provider: 'doubao',
            name: 'Doubao-embedding-large',
            group: 'Doubao-embedding',
        },
        {
            id: 'doubao-embedding-text-240715',
            provider: 'doubao',
            name: 'Doubao-embedding',
            group: 'Doubao-embedding',
        },
        {
            id: 'doubao-embedding-vision-241215',
            provider: 'doubao',
            name: 'Doubao-embedding-vision',
            group: 'Doubao-embedding',
        },
        {
            id: 'doubao-vision-lite-32k-241015',
            provider: 'doubao',
            name: 'Doubao-vision-lite-32k',
            group: 'Doubao-vision-lite-32k',
        },
    ],
    'minimax': [
        {
            id: 'abab6.5s-chat',
            provider: 'minimax',
            name: 'abab6.5s',
            group: 'abab6',
        },
        {
            id: 'abab6.5g-chat',
            provider: 'minimax',
            name: 'abab6.5g',
            group: 'abab6',
        },
        {
            id: 'abab6.5t-chat',
            provider: 'minimax',
            name: 'abab6.5t',
            group: 'abab6',
        },
        {
            id: 'abab5.5s-chat',
            provider: 'minimax',
            name: 'abab5.5s',
            group: 'abab5',
        },
        {
            id: 'minimax-text-01',
            provider: 'minimax',
            name: 'minimax-01',
            group: 'minimax-01',
        },
    ],
    'hyperbolic': [
        {
            id: 'Qwen/Qwen2-VL-72B-Instruct',
            provider: 'hyperbolic',
            name: 'Qwen2-VL-72B-Instruct',
            group: 'Qwen2-VL',
        },
        {
            id: 'Qwen/Qwen2-VL-7B-Instruct',
            provider: 'hyperbolic',
            name: 'Qwen2-VL-7B-Instruct',
            group: 'Qwen2-VL',
        },
        {
            id: 'mistralai/Pixtral-12B-2409',
            provider: 'hyperbolic',
            name: 'Pixtral-12B-2409',
            group: 'Pixtral',
        },
        {
            id: 'meta-llama/Meta-Llama-3.1-405B',
            provider: 'hyperbolic',
            name: 'Meta-Llama-3.1-405B',
            group: 'Meta-Llama-3.1',
        },
    ],
    'grok': [
        {
            id: 'grok-beta',
            provider: 'grok',
            name: 'Grok Beta',
            group: 'Grok',
        },
        {
            id: 'grok-vision-beta',
            provider: 'grok',
            name: 'Grok Vision Beta',
            group: 'Grok',
        },
    ],
    'mistral': [
        {
            id: 'pixtral-12b-2409',
            provider: 'mistral',
            name: 'Pixtral 12B [Free]',
            group: 'Pixtral',
        },
        {
            id: 'pixtral-large-latest',
            provider: 'mistral',
            name: 'Pixtral Large',
            group: 'Pixtral',
        },
        {
            id: 'ministral-3b-latest',
            provider: 'mistral',
            name: 'Mistral 3B [Free]',
            group: 'Mistral Mini',
        },
        {
            id: 'ministral-8b-latest',
            provider: 'mistral',
            name: 'Mistral 8B [Free]',
            group: 'Mistral Mini',
        },
        {
            id: 'codestral-latest',
            provider: 'mistral',
            name: 'Mistral Codestral',
            group: 'Mistral Code',
        },
        {
            id: 'mistral-large-latest',
            provider: 'mistral',
            name: 'Mistral Large',
            group: 'Mistral Chat',
        },
        {
            id: 'mistral-small-latest',
            provider: 'mistral',
            name: 'Mistral Small',
            group: 'Mistral Chat',
        },
        {
            id: 'open-mistral-nemo',
            provider: 'mistral',
            name: 'Mistral Nemo',
            group: 'Mistral Chat',
        },
        {
            id: 'mistral-embed',
            provider: 'mistral',
            name: 'Mistral Embedding',
            group: 'Mistral Embed',
        },
    ],
    'jina': [
        {
            id: 'jina-clip-v1',
            provider: 'jina',
            name: 'jina-clip-v1',
            group: 'Jina Clip',
        },
        {
            id: 'jina-clip-v2',
            provider: 'jina',
            name: 'jina-clip-v2',
            group: 'Jina Clip',
        },
        {
            id: 'jina-embeddings-v2-base-en',
            provider: 'jina',
            name: 'jina-embeddings-v2-base-en',
            group: 'Jina Embeddings V2',
        },
        {
            id: 'jina-embeddings-v2-base-es',
            provider: 'jina',
            name: 'jina-embeddings-v2-base-es',
            group: 'Jina Embeddings V2',
        },
        {
            id: 'jina-embeddings-v2-base-de',
            provider: 'jina',
            name: 'jina-embeddings-v2-base-de',
            group: 'Jina Embeddings V2',
        },
        {
            id: 'jina-embeddings-v2-base-zh',
            provider: 'jina',
            name: 'jina-embeddings-v2-base-zh',
            group: 'Jina Embeddings V2',
        },
        {
            id: 'jina-embeddings-v2-base-code',
            provider: 'jina',
            name: 'jina-embeddings-v2-base-code',
            group: 'Jina Embeddings V2',
        },
        {
            id: 'jina-embeddings-v3',
            provider: 'jina',
            name: 'jina-embeddings-v3',
            group: 'Jina Embeddings V3',
        },
    ],
    'fireworks': [
        {
            id: 'accounts/fireworks/models/mythomax-l2-13b',
            provider: 'fireworks',
            name: 'mythomax-l2-13b',
            group: 'Gryphe',
        },
        {
            id: 'accounts/fireworks/models/llama-v3-70b-instruct',
            provider: 'fireworks',
            name: 'Llama-3-70B-Instruct',
            group: 'Llama3',
        },
    ],
    'zhinao': [
        {
            id: '360gpt-pro',
            provider: 'zhinao',
            name: '360gpt-pro',
            group: '360Gpt',
        },
        {
            id: '360gpt-turbo',
            provider: 'zhinao',
            name: '360gpt-turbo',
            group: '360Gpt',
        },
    ],
    'hunyuan': [
        {
            id: 'hunyuan-pro',
            provider: 'hunyuan',
            name: 'hunyuan-pro',
            group: 'Hunyuan',
        },
        {
            id: 'hunyuan-standard',
            provider: 'hunyuan',
            name: 'hunyuan-standard',
            group: 'Hunyuan',
        },
        {
            id: 'hunyuan-lite',
            provider: 'hunyuan',
            name: 'hunyuan-lite',
            group: 'Hunyuan',
        },
        {
            id: 'hunyuan-standard-256k',
            provider: 'hunyuan',
            name: 'hunyuan-standard-256k',
            group: 'Hunyuan',
        },
        {
            id: 'hunyuan-vision',
            provider: 'hunyuan',
            name: 'hunyuan-vision',
            group: 'Hunyuan',
        },
        {
            id: 'hunyuan-code',
            provider: 'hunyuan',
            name: 'hunyuan-code',
            group: 'Hunyuan',
        },
        {
            id: 'hunyuan-role',
            provider: 'hunyuan',
            name: 'hunyuan-role',
            group: 'Hunyuan',
        },
        {
            id: 'hunyuan-turbo',
            provider: 'hunyuan',
            name: 'hunyuan-turbo',
            group: 'Hunyuan',
        },
        {
            id: 'hunyuan-turbos-latest',
            provider: 'hunyuan',
            name: 'hunyuan-turbos-latest',
            group: 'Hunyuan',
        },
        {
            id: 'hunyuan-embedding',
            provider: 'hunyuan',
            name: 'hunyuan-embedding',
            group: 'Embedding',
        },
    ],
    'nvidia': [
        {
            id: '01-ai/yi-large',
            provider: 'nvidia',
            name: 'yi-large',
            group: 'Yi',
        },
        {
            id: 'meta/llama-3.1-405b-instruct',
            provider: 'nvidia',
            name: 'llama-3.1-405b-instruct',
            group: 'llama-3.1',
        },
    ],
    'openrouter': [
        {
            id: 'google/gemini-2.5-flash-preview',
            provider: 'openrouter',
            name: 'Google: Gemini 2.5 Flash Preview',
            group: 'google',
        },
        {
            id: 'qwen/qwen-2.5-7b-instruct:free',
            provider: 'openrouter',
            name: 'Qwen: Qwen-2.5-7B Instruct',
            group: 'qwen',
        },
        {
            id: 'deepseek/deepseek-chat',
            provider: 'openrouter',
            name: 'DeepSeek: V3',
            group: 'deepseek',
        },
        {
            id: 'mistralai/mistral-7b-instruct:free',
            provider: 'openrouter',
            name: 'Mistral: Mistral 7B Instruct',
            group: 'mistralai',
        },
    ],
    'groq': [
        {
            id: 'llama3-8b-8192',
            provider: 'groq',
            name: 'LLaMA3 8B',
            group: 'Llama3',
        },
        {
            id: 'llama3-70b-8192',
            provider: 'groq',
            name: 'LLaMA3 70B',
            group: 'Llama3',
        },
        {
            id: 'mistral-saba-24b',
            provider: 'groq',
            name: 'Mistral Saba 24B',
            group: 'Mistral',
        },
        {
            id: 'gemma-9b-it',
            provider: 'groq',
            name: 'Gemma 9B',
            group: 'Gemma',
        },
    ],
    'baidu-cloud': [
        {
            id: 'deepseek-r1',
            provider: 'baidu-cloud',
            name: 'DeepSeek R1',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-v3',
            provider: 'baidu-cloud',
            name: 'DeepSeek V3',
            group: 'DeepSeek',
        },
        {
            id: 'ernie-4.0-8k-latest',
            provider: 'baidu-cloud',
            name: 'ERNIE-4.0',
            group: 'ERNIE',
        },
        {
            id: 'ernie-4.0-turbo-8k-latest',
            provider: 'baidu-cloud',
            name: 'ERNIE 4.0 Trubo',
            group: 'ERNIE',
        },
        {
            id: 'ernie-speed-8k',
            provider: 'baidu-cloud',
            name: 'ERNIE Speed',
            group: 'ERNIE',
        },
        {
            id: 'ernie-lite-8k',
            provider: 'baidu-cloud',
            name: 'ERNIE Lite',
            group: 'ERNIE',
        },
        {
            id: 'bge-large-zh',
            provider: 'baidu-cloud',
            name: 'BGE Large ZH',
            group: 'Embedding',
        },
        {
            id: 'bge-large-en',
            provider: 'baidu-cloud',
            name: 'BGE Large EN',
            group: 'Embedding',
        },
    ],
    'dmxapi': [
        {
            id: 'Qwen/Qwen2.5-7B-Instruct',
            provider: 'dmxapi',
            name: 'Qwen/Qwen2.5-7B-Instruct',
            group: '免费模型',
        },
        {
            id: 'ERNIE-Speed-128K',
            provider: 'dmxapi',
            name: 'ERNIE-Speed-128K',
            group: '免费模型',
        },
        {
            id: 'THUDM/glm-4-9b-chat',
            provider: 'dmxapi',
            name: 'THUDM/glm-4-9b-chat',
            group: '免费模型',
        },
        {
            id: 'glm-4-flash',
            provider: 'dmxapi',
            name: 'glm-4-flash',
            group: '免费模型',
        },
        {
            id: 'hunyuan-lite',
            provider: 'dmxapi',
            name: 'hunyuan-lite',
            group: '免费模型',
        },
        {
            id: 'gpt-4o',
            provider: 'dmxapi',
            name: 'gpt-4o',
            group: 'OpenAI',
        },
        {
            id: 'gpt-4o-mini',
            provider: 'dmxapi',
            name: 'gpt-4o-mini',
            group: 'OpenAI',
        },
        {
            id: 'DMXAPI-DeepSeek-R1',
            provider: 'dmxapi',
            name: 'DMXAPI-DeepSeek-R1',
            group: 'DeepSeek',
        },
        {
            id: 'DMXAPI-DeepSeek-V3',
            provider: 'dmxapi',
            name: 'DMXAPI-DeepSeek-V3',
            group: 'DeepSeek',
        },
        {
            id: 'claude-3-5-sonnet-20241022',
            provider: 'dmxapi',
            name: 'claude-3-5-sonnet-20241022',
            group: 'Claude',
        },
        {
            id: 'gemini-2.0-flash',
            provider: 'dmxapi',
            name: 'gemini-2.0-flash',
            group: 'Gemini',
        },
    ],
    'perplexity': [
        {
            id: 'sonar-reasoning-pro',
            provider: 'perplexity',
            name: 'sonar-reasoning-pro',
            group: 'Sonar',
        },
        {
            id: 'sonar-reasoning',
            provider: 'perplexity',
            name: 'sonar-reasoning',
            group: 'Sonar',
        },
        {
            id: 'sonar-pro',
            provider: 'perplexity',
            name: 'sonar-pro',
            group: 'Sonar',
        },
        {
            id: 'sonar',
            provider: 'perplexity',
            name: 'sonar',
            group: 'Sonar',
        },
    ],
    'infini': [
        {
            id: 'deepseek-r1',
            provider: 'infini',
            name: 'deepseek-r1',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-r1-distill-qwen-32b',
            provider: 'infini',
            name: 'deepseek-r1-distill-qwen-32b',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-v3',
            provider: 'infini',
            name: 'deepseek-v3',
            group: 'DeepSeek',
        },
        {
            id: 'qwen2.5-72b-instruct',
            provider: 'infini',
            name: 'qwen2.5-72b-instruct',
            group: 'Qwen',
        },
        {
            id: 'qwen2.5-32b-instruct',
            provider: 'infini',
            name: 'qwen2.5-32b-instruct',
            group: 'Qwen',
        },
        {
            id: 'qwen2.5-14b-instruct',
            provider: 'infini',
            name: 'qwen2.5-14b-instruct',
            group: 'Qwen',
        },
        {
            id: 'qwen2.5-7b-instruct',
            provider: 'infini',
            name: 'qwen2.5-7b-instruct',
            group: 'Qwen',
        },
        {
            id: 'qwen2-72b-instruct',
            provider: 'infini',
            name: 'qwen2-72b-instruct',
            group: 'Qwen',
        },
        {
            id: 'qwq-32b-preview',
            provider: 'infini',
            name: 'qwq-32b-preview',
            group: 'Qwen',
        },
        {
            id: 'qwen2.5-coder-32b-instruct',
            provider: 'infini',
            name: 'qwen2.5-coder-32b-instruct',
            group: 'Qwen',
        },
        {
            id: 'llama-3.3-70b-instruct',
            provider: 'infini',
            name: 'llama-3.3-70b-instruct',
            group: 'Llama',
        },
    ],
    'xirang': [],
    'tencent-cloud-ti': [
        {
            id: 'deepseek-r1',
            provider: 'tencent-cloud-ti',
            name: 'DeepSeek R1',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-v3',
            provider: 'tencent-cloud-ti',
            name: 'DeepSeek V3',
            group: 'DeepSeek',
        },
    ],
    'gpustack': [],
    'voyageai': [
        {
            id: 'voyage-3-large',
            provider: 'voyageai',
            name: 'voyage-3-large',
            group: 'Voyage Embeddings V3',
        },
        {
            id: 'voyage-3',
            provider: 'voyageai',
            name: 'voyage-3',
            group: 'Voyage Embeddings V3',
        },
        {
            id: 'voyage-3-lite',
            provider: 'voyageai',
            name: 'voyage-3-lite',
            group: 'Voyage Embeddings V3',
        },
        {
            id: 'voyage-code-3',
            provider: 'voyageai',
            name: 'voyage-code-3',
            group: 'Voyage Embeddings V3',
        },
        {
            id: 'voyage-finance-3',
            provider: 'voyageai',
            name: 'voyage-finance-3',
            group: 'Voyage Embeddings V2',
        },
        {
            id: 'voyage-law-2',
            provider: 'voyageai',
            name: 'voyage-law-2',
            group: 'Voyage Embeddings V2',
        },
        {
            id: 'voyage-code-2',
            provider: 'voyageai',
            name: 'voyage-code-2',
            group: 'Voyage Embeddings V2',
        },
        {
            id: 'rerank-2',
            provider: 'voyageai',
            name: 'rerank-2',
            group: 'Voyage Rerank V2',
        },
        {
            id: 'rerank-2-lite',
            provider: 'voyageai',
            name: 'rerank-2-lite',
            group: 'Voyage Rerank V2',
        },
    ],
    'qiniu': [
        {
            id: 'deepseek-r1',
            provider: 'qiniu',
            name: 'DeepSeek R1',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-r1-search',
            provider: 'qiniu',
            name: 'DeepSeek R1 Search',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-r1-32b',
            provider: 'qiniu',
            name: 'DeepSeek R1 32B',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-v3',
            provider: 'qiniu',
            name: 'DeepSeek V3',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-v3-search',
            provider: 'qiniu',
            name: 'DeepSeek V3 Search',
            group: 'DeepSeek',
        },
        {
            id: 'deepseek-v3-tool',
            provider: 'qiniu',
            name: 'DeepSeek V3 Tool',
            group: 'DeepSeek',
        },
        {
            id: 'qwq-32b',
            provider: 'qiniu',
            name: 'QWQ 32B',
            group: 'Qwen',
        },
        {
            id: 'qwen2.5-72b-instruct',
            provider: 'qiniu',
            name: 'Qwen2.5 72B Instruct',
            group: 'Qwen',
        },
    ],
    'gongjiyun': [],
};

export const SYSTEM_MODELS: Record<string, Model[]> = Object.fromEntries(
    Object.entries(RAW_SYSTEM_MODELS).map(([provider, models]: [string, Model[]]) => [
        provider,
        Array.isArray(models) ? models.filter(isChatModel) : [],
    ]),
);

/**
 * OrcaRouter fallback catalog (cold-start seed only).
 *
 * The authoritative list comes from `GET https://api.orcarouter.ai/v1/models`
 * at runtime (see `src/orcarouter/catalog.ts`). This seed exists so a fresh
 * install with no network still has a usable picker. It is deliberately small,
 * every entry is verified, and each keeps its verified capability metadata —
 * including the reasoning-effort ladder. It is never merged into a successful
 * live result.
 *
 * When live discovery fails, the UI must show a degraded/refresh notice rather
 * than presenting these as the full catalog.
 */
RAW_SYSTEM_MODELS['orcarouter'] = [
    {
        id: 'openai/gpt-5.5',
        provider: 'orcarouter',
        name: 'GPT-5.5',
        group: 'GPT-5.5',
        description: 'context 400,000 · input text/image · effort low/medium/high/xhigh',
        type: ['text', 'vision', 'reasoning'],
    },
    {
        id: 'anthropic/claude-opus-4.8',
        provider: 'orcarouter',
        name: 'Claude Opus 4.8',
        group: 'Claude 4.8',
        description: 'context 200,000 · input text/image · effort low/medium/high',
        type: ['text', 'vision', 'reasoning'],
    },
    {
        id: 'google/gemini-3.5-flash',
        provider: 'orcarouter',
        name: 'Gemini 3.5 Flash',
        group: 'Gemini 3.5',
        description: 'context 1,000,000 · input text/image/audio/video · effort low/medium/high',
        type: ['text', 'vision', 'reasoning'],
    },
    {
        id: 'deepseek/deepseek-v4-pro',
        provider: 'orcarouter',
        name: 'DeepSeek V4 Pro',
        group: 'DeepSeek V4',
        description: 'context 128,000 · input text · effort low/medium/high',
        type: ['text', 'reasoning'],
    },
    {
        id: 'orcarouter/auto',
        provider: 'orcarouter',
        name: 'OrcaRouter Auto',
        group: 'OrcaRouter',
        description: 'Adaptive gateway routing across the catalog.',
        type: ['text', 'vision', 'reasoning'],
    },
];

// "OrcaRouter - Auth" is the same gateway reached with a PKCE-issued key, so it
// offers the same models. Share the seed rather than duplicating it.
RAW_SYSTEM_MODELS['orcarouter-oauth'] = RAW_SYSTEM_MODELS['orcarouter'];
