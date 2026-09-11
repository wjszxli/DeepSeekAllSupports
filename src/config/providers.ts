import type { Provider } from '@/types';
import { SYSTEM_MODELS } from './models';

import ZhinaoProviderLogo from '@/assets/providers/360.png';
import HunyuanProviderLogo from '@/assets/providers/hunyuan.png';
import AzureProviderLogo from '@/assets/providers/microsoft.png';
import AiHubMixProviderLogo from '@/assets/providers/aihubmix.png';
import AnthropicProviderLogo from '@/assets/providers/anthropic.png';
import BaichuanProviderLogo from '@/assets/providers/baichuan.png';
import BaiduCloudProviderLogo from '@/assets/providers/baidu-cloud.svg';
import BailianProviderLogo from '@/assets/providers/bailian.png';
import DeepSeekProviderLogo from '@/assets/providers/deepseek.png';
import DmxapiProviderLogo from '@/assets/providers/DMXAPI.png';
import FireworksProviderLogo from '@/assets/providers/fireworks.png';
import GiteeAIProviderLogo from '@/assets/providers/gitee-ai.png';
import GithubProviderLogo from '@/assets/providers/github.png';
import GoogleProviderLogo from '@/assets/providers/google.png';
import GPUStackProviderLogo from '@/assets/providers/gpustack.svg';
import GrokProviderLogo from '@/assets/providers/grok.png';
import GroqProviderLogo from '@/assets/providers/groq.png';
import HyperbolicProviderLogo from '@/assets/providers/hyperbolic.png';
import InfiniProviderLogo from '@/assets/providers/infini.png';
import JinaProviderLogo from '@/assets/providers/jina.png';
import LMStudioProviderLogo from '@/assets/providers/lmstudio.png';
import MinimaxProviderLogo from '@/assets/providers/minimax.png';
import MistralProviderLogo from '@/assets/providers/mistral.png';
import ModelScopeProviderLogo from '@/assets/providers/modelscope.png';
import MoonshotProviderLogo from '@/assets/providers/moonshot.png';
import NvidiaProviderLogo from '@/assets/providers/nvidia.png';
import O3ProviderLogo from '@/assets/providers/o3.png';
import OcoolAiProviderLogo from '@/assets/providers/ocoolai.png';
import OllamaProviderLogo from '@/assets/providers/ollama.png';
import OpenAiProviderLogo from '@/assets/providers/openai.png';
import OpenRouterProviderLogo from '@/assets/providers/openrouter.png';
import OrcaRouterProviderLogo from '@/assets/providers/orcarouter.png';
import PerplexityProviderLogo from '@/assets/providers/perplexity.png';
import PPIOProviderLogo from '@/assets/providers/ppio.png';
import QiniuProviderLogo from '@/assets/providers/qiniu.png';
import SiliconFlowProviderLogo from '@/assets/providers/silicon.png';
import StepProviderLogo from '@/assets/providers/step.png';
import TencentCloudProviderLogo from '@/assets/providers/tencent-cloud-ti.png';
import TogetherProviderLogo from '@/assets/providers/together.png';
import BytedanceProviderLogo from '@/assets/providers/volcengine.png';
import VoyageAIProviderLogo from '@/assets/providers/voyageai.png';
import XirangProviderLogo from '@/assets/providers/xirang.png';
import ZeroOneProviderLogo from '@/assets/providers/zero-one.png';
import ZhipuProviderLogo from '@/assets/providers/zhipu.png';
import GongjiyunProviderLogo from '@/assets/providers/gongji.png';

const PROVIDER_LOGO_MAP = {
    'openai': OpenAiProviderLogo,
    'silicon': SiliconFlowProviderLogo,
    'deepseek': DeepSeekProviderLogo,
    'gitee-ai': GiteeAIProviderLogo,
    'yi': ZeroOneProviderLogo,
    'groq': GroqProviderLogo,
    'zhipu': ZhipuProviderLogo,
    'ollama': OllamaProviderLogo,
    'lmstudio': LMStudioProviderLogo,
    'moonshot': MoonshotProviderLogo,
    'openrouter': OpenRouterProviderLogo,
    'orcarouter': OrcaRouterProviderLogo,
    'orcarouter-oauth': OrcaRouterProviderLogo,
    'baichuan': BaichuanProviderLogo,
    'dashscope': BailianProviderLogo,
    'modelscope': ModelScopeProviderLogo,
    'xirang': XirangProviderLogo,
    'anthropic': AnthropicProviderLogo,
    'aihubmix': AiHubMixProviderLogo,
    'gemini': GoogleProviderLogo,
    'stepfun': StepProviderLogo,
    'doubao': BytedanceProviderLogo,
    'minimax': MinimaxProviderLogo,
    'github': GithubProviderLogo,
    'copilot': GithubProviderLogo,
    'ocoolai': OcoolAiProviderLogo,
    'together': TogetherProviderLogo,
    'fireworks': FireworksProviderLogo,
    'zhinao': ZhinaoProviderLogo,
    'nvidia': NvidiaProviderLogo,
    'azure-openai': AzureProviderLogo,
    'hunyuan': HunyuanProviderLogo,
    'grok': GrokProviderLogo,
    'hyperbolic': HyperbolicProviderLogo,
    'mistral': MistralProviderLogo,
    'jina': JinaProviderLogo,
    'ppio': PPIOProviderLogo,
    'baidu-cloud': BaiduCloudProviderLogo,
    'dmxapi': DmxapiProviderLogo,
    'perplexity': PerplexityProviderLogo,
    'infini': InfiniProviderLogo,
    'o3': O3ProviderLogo,
    'tencent-cloud-ti': TencentCloudProviderLogo,
    'gpustack': GPUStackProviderLogo,
    'voyageai': VoyageAIProviderLogo,
    'qiniu': QiniuProviderLogo,
    'gongjiyun': GongjiyunProviderLogo,
} as const;

export function getProviderLogo(providerId: string) {
    return PROVIDER_LOGO_MAP[providerId as keyof typeof PROVIDER_LOGO_MAP];
}

// Define supported languages
export type SupportedLanguage = 'en' | 'zh-CN';

// Create a multilingual text structure
export interface MultilingualText {
    'en': string;
    'zh-CN': string;
}

export const INITIAL_PROVIDERS: Provider[] = [
    {
        id: 'silicon',
        name: 'Silicon',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.siliconflow.cn',
        models: SYSTEM_MODELS.silicon,
        isSystem: true,
        enabled: true,
    },
    {
        id: 'deepseek',
        name: 'deepseek',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.deepseek.com',
        models: SYSTEM_MODELS.deepseek,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'tencent-cloud-ti',
        name: 'Tencent Cloud TI',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.lkeap.cloud.tencent.com',
        models: SYSTEM_MODELS['tencent-cloud-ti'],
        isSystem: true,
        enabled: false,
    },
    {
        id: 'baidu-cloud',
        name: 'Baidu Cloud',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://qianfan.baidubce.com/v2/',
        models: SYSTEM_MODELS['baidu-cloud'],
        isSystem: true,
        enabled: false,
    },
    {
        id: 'dashscope',
        name: 'Bailian',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://dashscope.aliyuncs.com/compatible-mode/v1/',
        models: SYSTEM_MODELS.bailian,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'zhipu',
        name: 'ZhiPu',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://open.bigmodel.cn/api/paas/v4/',
        models: SYSTEM_MODELS.zhipu,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'doubao',
        name: 'doubao',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://ark.cn-beijing.volces.com/api/v3/',
        models: SYSTEM_MODELS.doubao,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'hunyuan',
        name: 'hunyuan',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.hunyuan.cloud.tencent.com',
        models: SYSTEM_MODELS.hunyuan,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'openai',
        name: 'OpenAI',
        type: 'openai-response',
        apiKey: '',
        apiHost: 'https://api.openai.com',
        models: SYSTEM_MODELS.openai,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'azure-openai',
        name: 'Azure OpenAI',
        type: 'openai',
        apiKey: '',
        apiHost: '',
        apiVersion: '',
        models: SYSTEM_MODELS['azure-openai'],
        isSystem: true,
        enabled: false,
    },
    {
        id: 'gemini',
        name: 'Gemini',
        type: 'gemini',
        apiKey: '',
        apiHost: 'https://generativelanguage.googleapis.com',
        models: SYSTEM_MODELS.gemini,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'ollama',
        name: 'Ollama',
        type: 'openai',
        apiKey: '',
        apiHost: 'http://localhost:11434',
        models: SYSTEM_MODELS.ollama,
        isSystem: true,
        enabled: false,
        requiresApiKey: false,
    },
    {
        id: 'lmstudio',
        name: 'LM Studio',
        type: 'openai',
        apiKey: '',
        apiHost: 'http://localhost:1234',
        models: SYSTEM_MODELS.lmstudio,
        isSystem: true,
        enabled: false,
        requiresApiKey: false,
    },
    {
        id: 'aihubmix',
        name: 'AiHubMix',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://aihubmix.com',
        models: SYSTEM_MODELS.aihubmix,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'ocoolai',
        name: 'ocoolAI',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.ocoolai.com',
        models: SYSTEM_MODELS.ocoolai,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://openrouter.ai/api/v1/',
        models: SYSTEM_MODELS.openrouter,
        isSystem: true,
        enabled: false,
    },
    // Two explicit authentication choices for one gateway. Both share the
    // inference adapter, base URL, and model namespace; only credential
    // acquisition differs. Keeping them as separate entries keeps "which key am
    // I using" and "how do I sign out" unambiguous.
    {
        id: 'orcarouter',
        name: 'OrcaRouter - API',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.orcarouter.ai/v1',
        models: SYSTEM_MODELS.orcarouter ?? [],
        isSystem: true,
        enabled: true,
        requiresApiKey: true,
    },
    {
        id: 'orcarouter-oauth',
        name: 'OrcaRouter - Auth',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.orcarouter.ai/v1',
        models: SYSTEM_MODELS['orcarouter-oauth'] ?? [],
        isSystem: true,
        enabled: false,
        requiresApiKey: false,
        notes: 'Authorize with your OrcaRouter account (OAuth 2.0 + PKCE).',
    },
    {
        id: 'ppio',
        name: 'PPIO',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.ppinfra.com/v3/openai',
        models: SYSTEM_MODELS.ppio,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'infini',
        name: 'Infini',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://cloud.infini-ai.com/maas',
        models: SYSTEM_MODELS.infini,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'qiniu',
        name: 'Qiniu',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.qnaigc.com',
        models: SYSTEM_MODELS.qiniu,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'dmxapi',
        name: 'DMXAPI',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://www.dmxapi.cn',
        models: SYSTEM_MODELS.dmxapi,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'o3',
        name: 'O3',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.o3.fan',
        models: SYSTEM_MODELS.o3,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        type: 'anthropic',
        apiKey: '',
        apiHost: 'https://api.anthropic.com/',
        models: SYSTEM_MODELS.anthropic,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'github',
        name: 'Github Models',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://models.inference.ai.azure.com/',
        models: SYSTEM_MODELS.github,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'copilot',
        name: 'Github Copilot',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.githubcopilot.com/',
        models: SYSTEM_MODELS.copilot,
        isSystem: true,
        enabled: false,
        isAuthed: false,
    },
    {
        id: 'yi',
        name: 'Yi',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.lingyiwanwu.com',
        models: SYSTEM_MODELS.yi,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'moonshot',
        name: 'Moonshot AI',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.moonshot.cn',
        models: SYSTEM_MODELS.moonshot,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'baichuan',
        name: 'BAICHUAN AI',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.baichuan-ai.com',
        models: SYSTEM_MODELS.baichuan,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'stepfun',
        name: 'StepFun',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.stepfun.com',
        models: SYSTEM_MODELS.stepfun,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'minimax',
        name: 'MiniMax',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.minimax.chat/v1/',
        models: SYSTEM_MODELS.minimax,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'groq',
        name: 'Groq',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.groq.com/openai',
        models: SYSTEM_MODELS.groq,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'together',
        name: 'Together',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.together.xyz',
        models: SYSTEM_MODELS.together,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'fireworks',
        name: 'Fireworks',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.fireworks.ai/inference',
        models: SYSTEM_MODELS.fireworks,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'zhinao',
        name: 'zhinao',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.360.cn',
        models: SYSTEM_MODELS.zhinao,
        isSystem: true,
        enabled: false,
    },

    {
        id: 'nvidia',
        name: 'nvidia',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://integrate.api.nvidia.com',
        models: SYSTEM_MODELS.nvidia,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'grok',
        name: 'Grok',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.x.ai',
        models: SYSTEM_MODELS.grok,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'hyperbolic',
        name: 'Hyperbolic',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.hyperbolic.xyz',
        models: SYSTEM_MODELS.hyperbolic,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'mistral',
        name: 'Mistral',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.mistral.ai',
        models: SYSTEM_MODELS.mistral,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'jina',
        name: 'Jina',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.jina.ai',
        models: SYSTEM_MODELS.jina,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'gitee-ai',
        name: 'gitee ai',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://ai.gitee.com',
        models: SYSTEM_MODELS['gitee-ai'],
        isSystem: true,
        enabled: false,
    },
    {
        id: 'perplexity',
        name: 'Perplexity',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.perplexity.ai/',
        models: SYSTEM_MODELS.perplexity,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'modelscope',
        name: 'ModelScope',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api-inference.modelscope.cn/v1/',
        models: SYSTEM_MODELS.modelscope,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'xirang',
        name: 'Xirang',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://wishub-x1.ctyun.cn',
        models: SYSTEM_MODELS.xirang,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'gpustack',
        name: 'GPUStack',
        type: 'openai',
        apiKey: '',
        apiHost: '',
        models: SYSTEM_MODELS.gpustack,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'voyageai',
        name: 'VoyageAI',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.voyageai.com',
        models: SYSTEM_MODELS.voyageai,
        isSystem: true,
        enabled: false,
    },
    {
        id: 'gongjiyun',
        name: 'Gongjiyun',
        type: 'openai',
        apiKey: '',
        apiHost: 'https://api.gongjiyun.cn',
        models: SYSTEM_MODELS.gongjiyun,
        isSystem: true,
        enabled: false,
    },
];

export const PROVIDER_CONFIG = {
    'openai': {
        api: {
            url: 'https://api.openai.com',
        },
        websites: {
            official: 'https://openai.com/',
            apiKey: 'https://platform.openai.com/api-keys',
            docs: 'https://platform.openai.com/docs',
            models: 'https://platform.openai.com/docs/models',
        },
    },
    'o3': {
        api: {
            url: 'https://api.o3.fan',
        },
        websites: {
            official: 'https://o3.fan',
            apiKey: 'https://o3.fan/token',
            docs: 'https://docs.o3.fan',
            models: 'https://docs.o3.fan/models',
        },
    },
    'ppio': {
        api: {
            url: 'https://api.ppinfra.com/v3/openai',
        },
        websites: {
            official:
                'https://ppinfra.com/user/register?invited_by=0DBBGQ&utm_source=github_cherry-studio',
            apiKey: 'https://ppinfra.com/user/register?invited_by=0DBBGQ&utm_source=github_cherry-studio',
            docs: 'https://docs.cherry-ai.com/pre-basic/providers/ppio?invited_by=0DBBGQ&utm_source=github_cherry-studio',
            models: 'https://ppinfra.com/model-api/product/llm-api?utm_source=github_cherry-studio&utm_medium=github_readme&utm_campaign=link',
        },
    },
    'gemini': {
        api: {
            url: 'https://generativelanguage.googleapis.com',
        },
        websites: {
            official: 'https://gemini.google.com/',
            apiKey: 'https://aistudio.google.com/app/apikey',
            docs: 'https://ai.google.dev/gemini-api/docs',
            models: 'https://ai.google.dev/gemini-api/docs/models/gemini',
        },
    },
    'silicon': {
        api: {
            url: 'https://api.siliconflow.cn',
        },
        websites: {
            official: 'https://www.siliconflow.cn',
            apiKey: 'https://cloud.siliconflow.cn/i/AhCOFWnM',
            docs: 'https://docs.siliconflow.cn/',
            models: 'https://docs.siliconflow.cn/docs/model-names',
        },
    },
    'gitee-ai': {
        api: {
            url: 'https://ai.gitee.com',
        },
        websites: {
            official: 'https://ai.gitee.com/',
            apiKey: 'https://ai.gitee.com/dashboard/settings/tokens',
            docs: 'https://ai.gitee.com/docs/openapi/v1#tag/%E6%96%87%E6%9C%AC%E7%94%9F%E6%88%90/POST/chat/completions',
            models: 'https://ai.gitee.com/serverless-api',
        },
    },
    'deepseek': {
        api: {
            url: 'https://api.deepseek.com',
        },
        websites: {
            official: 'https://deepseek.com/',
            apiKey: 'https://platform.deepseek.com/api_keys',
            docs: 'https://platform.deepseek.com/api-docs/',
            models: 'https://platform.deepseek.com/api-docs/',
        },
    },
    'ocoolai': {
        api: {
            url: 'https://api.ocoolai.com',
        },
        websites: {
            official: 'https://one.ocoolai.com/',
            apiKey: 'https://one.ocoolai.com/token',
            docs: 'https://docs.ocoolai.com/',
            models: 'https://api.ocoolai.com/info/models/',
        },
    },
    'together': {
        api: {
            url: 'https://api.together.xyz',
        },
        websites: {
            official: 'https://www.together.ai/',
            apiKey: 'https://api.together.ai/settings/api-keys',
            docs: 'https://docs.together.ai/docs/introduction',
            models: 'https://docs.together.ai/docs/chat-models',
        },
    },
    'dmxapi': {
        api: {
            url: 'https://www.dmxapi.cn',
        },
        websites: {
            official: 'https://www.dmxapi.cn/register?aff=E12q',
            apiKey: 'https://www.dmxapi.cn/register?aff=E12q',
            docs: 'https://dmxapi.cn/models.html#code-block',
            models: 'https://www.dmxapi.cn/pricing',
        },
    },
    'perplexity': {
        api: {
            url: 'https://api.perplexity.ai/',
        },
        websites: {
            official: 'https://perplexity.ai/',
            apiKey: 'https://www.perplexity.ai/settings/api',
            docs: 'https://docs.perplexity.ai/home',
            models: 'https://docs.perplexity.ai/guides/model-cards',
        },
    },
    'infini': {
        api: {
            url: 'https://cloud.infini-ai.com/maas',
        },
        websites: {
            official: 'https://cloud.infini-ai.com/',
            apiKey: 'https://cloud.infini-ai.com/iam/secret/key',
            docs: 'https://docs.infini-ai.com/gen-studio/api/maas.html#/operations/chatCompletions',
            models: 'https://cloud.infini-ai.com/genstudio/model',
        },
    },
    'github': {
        api: {
            url: 'https://models.inference.ai.azure.com/',
        },
        websites: {
            official: 'https://github.com/marketplace/models',
            apiKey: 'https://github.com/settings/tokens',
            docs: 'https://docs.github.com/en/github-models',
            models: 'https://github.com/marketplace/models',
        },
    },
    'copilot': {
        api: {
            url: 'https://api.githubcopilot.com/',
        },
    },
    'yi': {
        api: {
            url: 'https://api.lingyiwanwu.com',
        },
        websites: {
            official: 'https://platform.lingyiwanwu.com/',
            apiKey: 'https://platform.lingyiwanwu.com/apikeys',
            docs: 'https://platform.lingyiwanwu.com/docs',
            models: 'https://platform.lingyiwanwu.com/docs#%E6%A8%A1%E5%9E%8B',
        },
    },
    'zhipu': {
        api: {
            url: 'https://open.bigmodel.cn/api/paas/v4/',
        },
        websites: {
            official: 'https://open.bigmodel.cn/',
            apiKey: 'https://open.bigmodel.cn/usercenter/apikeys',
            docs: 'https://open.bigmodel.cn/dev/howuse/introduction',
            models: 'https://open.bigmodel.cn/modelcenter/square',
        },
    },
    'moonshot': {
        api: {
            url: 'https://api.moonshot.cn',
        },
        websites: {
            official: 'https://moonshot.ai/',
            apiKey: 'https://platform.moonshot.cn/console/api-keys',
            docs: 'https://platform.moonshot.cn/docs/',
            models: 'https://platform.moonshot.cn/docs/intro#%E6%A8%A1%E5%9E%8B%E5%88%97%E8%A1%A8',
        },
    },
    'baichuan': {
        api: {
            url: 'https://api.baichuan-ai.com',
        },
        websites: {
            official: 'https://www.baichuan-ai.com/',
            apiKey: 'https://platform.baichuan-ai.com/console/apikey',
            docs: 'https://platform.baichuan-ai.com/docs',
            models: 'https://platform.baichuan-ai.com/price',
        },
    },
    'modelscope': {
        api: {
            url: 'https://api-inference.modelscope.cn/v1/',
        },
        websites: {
            official: 'https://modelscope.cn',
            apiKey: 'https://modelscope.cn/my/myaccesstoken',
            docs: 'https://modelscope.cn/docs/model-service/API-Inference/intro',
            models: 'https://modelscope.cn/models',
        },
    },
    'xirang': {
        api: {
            url: 'https://wishub-x1.ctyun.cn',
        },
        websites: {
            official: 'https://www.ctyun.cn',
            apiKey: 'https://huiju.ctyun.cn/service/serviceGroup',
            docs: 'https://www.ctyun.cn/products/ctxirang',
            models: 'https://huiju.ctyun.cn/modelSquare/',
        },
    },
    'dashscope': {
        api: {
            url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/',
        },
        websites: {
            official: 'https://www.aliyun.com/product/bailian',
            apiKey: 'https://bailian.console.aliyun.com/?tab=model#/api-key',
            docs: 'https://help.aliyun.com/zh/model-studio/getting-started/',
            models: 'https://bailian.console.aliyun.com/?tab=model#/model-market',
        },
    },
    'stepfun': {
        api: {
            url: 'https://api.stepfun.com',
        },
        websites: {
            official: 'https://platform.stepfun.com/',
            apiKey: 'https://platform.stepfun.com/interface-key',
            docs: 'https://platform.stepfun.com/docs/overview/concept',
            models: 'https://platform.stepfun.com/docs/llm/text',
        },
    },
    'doubao': {
        api: {
            url: 'https://ark.cn-beijing.volces.com/api/v3/',
        },
        websites: {
            official: 'https://console.volcengine.com/ark/',
            apiKey: 'https://www.volcengine.com/experience/ark?utm_term=202502dsinvite&ac=DSASUQY5&rc=DB4II4FC',
            docs: 'https://www.volcengine.com/docs/82379/1182403',
            models: 'https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint',
        },
    },
    'minimax': {
        api: {
            url: 'https://api.minimax.chat/v1/',
        },
        websites: {
            official: 'https://platform.minimaxi.com/',
            apiKey: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
            docs: 'https://platform.minimaxi.com/document/Announcement',
            models: 'https://platform.minimaxi.com/document/Models',
        },
    },

    'openrouter': {
        api: {
            url: 'https://openrouter.ai/api/v1/',
        },
        websites: {
            official: 'https://openrouter.ai/',
            apiKey: 'https://openrouter.ai/settings/keys',
            docs: 'https://openrouter.ai/docs/quick-start',
            models: 'https://openrouter.ai/docs/models',
        },
    },
    // OrcaRouter is an OpenAI-compatible AI gateway. Authentication and
    // inference use *different* origins: keys are obtained on
    // www.orcarouter.ai, inference runs against api.orcarouter.ai/v1.
    'orcarouter': {
        api: {
            url: 'https://api.orcarouter.ai/v1',
        },
        websites: {
            official: 'https://www.orcarouter.ai/',
            // Where the user creates a key and can revoke every key issued to
            // this app in one click.
            apiKey: 'https://www.orcarouter.ai/console/authorized-apps',
            // The catalog browser. The machine-readable catalog is
            // `GET https://api.orcarouter.ai/v1/models`.
            models: 'https://www.orcarouter.ai/models',
        },
    },
    'orcarouter-oauth': {
        api: {
            url: 'https://api.orcarouter.ai/v1',
        },
        websites: {
            official: 'https://www.orcarouter.ai/',
            apiKey: 'https://www.orcarouter.ai/console/authorized-apps',
            models: 'https://www.orcarouter.ai/models',
        },
    },
    'groq': {
        api: {
            url: 'https://api.groq.com/openai',
        },
        websites: {
            official: 'https://groq.com/',
            apiKey: 'https://console.groq.com/keys',
            docs: 'https://console.groq.com/docs/quickstart',
            models: 'https://console.groq.com/docs/models',
        },
    },
    'ollama': {
        api: {
            url: 'http://localhost:11434',
        },
        websites: {
            official: 'https://ollama.com/',
            docs: 'https://github.com/ollama/ollama/tree/main/docs',
            models: 'https://ollama.com/library',
        },
    },
    'lmstudio': {
        api: {
            url: 'http://localhost:1234',
        },
        websites: {
            official: 'https://lmstudio.ai/',
            docs: 'https://lmstudio.ai/docs',
            models: 'https://lmstudio.ai/models',
        },
    },
    'anthropic': {
        api: {
            url: 'https://api.anthropic.com/',
        },
        websites: {
            official: 'https://anthropic.com/',
            apiKey: 'https://console.anthropic.com/settings/keys',
            docs: 'https://docs.anthropic.com/en/docs',
            models: 'https://docs.anthropic.com/en/docs/about-claude/models',
        },
    },
    'grok': {
        api: {
            url: 'https://api.x.ai',
        },
        websites: {
            official: 'https://x.ai/',
            docs: 'https://docs.x.ai/',
            models: 'https://docs.x.ai/docs#getting-started',
        },
    },
    'hyperbolic': {
        api: {
            url: 'https://api.hyperbolic.xyz',
        },
        websites: {
            official: 'https://app.hyperbolic.xyz',
            apiKey: 'https://app.hyperbolic.xyz/settings',
            docs: 'https://docs.hyperbolic.xyz',
            models: 'https://app.hyperbolic.xyz/models',
        },
    },
    'mistral': {
        api: {
            url: 'https://api.mistral.ai',
        },
        websites: {
            official: 'https://mistral.ai',
            apiKey: 'https://console.mistral.ai/api-keys/',
            docs: 'https://docs.mistral.ai',
            models: 'https://docs.mistral.ai/getting-started/models/models_overview',
        },
    },
    'jina': {
        api: {
            url: 'https://api.jina.ai',
        },
        websites: {
            official: 'https://jina.ai',
            apiKey: 'https://jina.ai/',
            docs: 'https://jina.ai',
            models: 'https://jina.ai',
        },
    },
    'aihubmix': {
        api: {
            url: 'https://aihubmix.com/v1',
        },
        websites: {
            official: 'https://aihubmix.com?aff=SJyh',
            apiKey: 'https://aihubmix.com?aff=SJyh',
            docs: 'https://doc.aihubmix.com/',
            models: 'https://aihubmix.com/models',
        },
    },
    'fireworks': {
        api: {
            url: 'https://api.fireworks.ai/inference',
        },
        websites: {
            official: 'https://fireworks.ai/',
            apiKey: 'https://fireworks.ai/account/api-keys',
            docs: 'https://docs.fireworks.ai/getting-started/introduction',
            models: 'https://fireworks.ai/dashboard/models',
        },
    },
    'zhinao': {
        api: {
            url: 'https://api.360.cn',
        },
        websites: {
            official: 'https://ai.360.com/',
            apiKey: 'https://ai.360.com/platform/keys',
            docs: 'https://ai.360.com/platform/docs/overview',
            models: 'https://ai.360.com/platform/limit',
        },
    },
    'hunyuan': {
        api: {
            url: 'https://api.hunyuan.cloud.tencent.com',
        },
        websites: {
            official: 'https://cloud.tencent.com/product/hunyuan',
            apiKey: 'https://console.cloud.tencent.com/hunyuan/api-key',
            docs: 'https://cloud.tencent.com/document/product/1729/111007',
            models: 'https://cloud.tencent.com/document/product/1729/104753',
        },
    },
    'nvidia': {
        api: {
            url: 'https://integrate.api.nvidia.com',
        },
        websites: {
            official: 'https://build.nvidia.com/explore/discover',
            apiKey: 'https://build.nvidia.com/meta/llama-3_1-405b-instruct',
            docs: 'https://docs.api.nvidia.com/nim/reference/llm-apis',
            models: 'https://build.nvidia.com/nim',
        },
    },
    'azure-openai': {
        api: {
            url: '',
        },
        websites: {
            official: 'https://azure.microsoft.com/en-us/products/ai-services/openai-service',
            apiKey: 'https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI',
            docs: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
            models: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models',
        },
    },
    'baidu-cloud': {
        api: {
            url: 'https://qianfan.baidubce.com/v2/',
        },
        websites: {
            official: 'https://cloud.baidu.com/',
            apiKey: 'https://console.bce.baidu.com/iam/#/iam/apikey/list',
            docs: 'https://cloud.baidu.com/doc/index.html',
            models: 'https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Fm2vrveyu',
        },
    },
    'tencent-cloud-ti': {
        api: {
            url: 'https://api.lkeap.cloud.tencent.com',
        },
        websites: {
            official: 'https://cloud.tencent.com/product/ti',
            apiKey: 'https://console.cloud.tencent.com/lkeap/api',
            docs: 'https://cloud.tencent.com/document/product/1772',
            models: 'https://console.cloud.tencent.com/tione/v2/aimarket',
        },
    },
    'gpustack': {
        api: {
            url: '',
        },
        websites: {
            official: 'https://gpustack.ai/',
            docs: 'https://docs.gpustack.ai/latest/',
            models: 'https://docs.gpustack.ai/latest/overview/#supported-models',
        },
    },
    'voyageai': {
        api: {
            url: 'https://api.voyageai.com',
        },
        websites: {
            official: 'https://www.voyageai.com/',
            apiKey: 'https://dashboard.voyageai.com/organization/api-keys',
            docs: 'https://docs.voyageai.com/docs',
            models: 'https://docs.voyageai.com/docs',
        },
    },
    'qiniu': {
        api: {
            url: 'https://api.qnaigc.com',
        },
        websites: {
            official: 'https://qiniu.com',
            apiKey: 'https://portal.qiniu.com/ai-inference/api-key?cps_key=1h4vzfbkxobiq',
            docs: 'https://developer.qiniu.com/aitokenapi',
            models: 'https://developer.qiniu.com/aitokenapi/12883/model-list',
        },
    },
    'gongjiyun': {
        api: {
            url: 'https://api.gongjiyun.cn',
        },
        websites: {
            official: 'https://www.gongjiyun.com/',
            apiKey: 'https://console.suanli.cn/auth/login?invite_code=BShI2j8aFu',
            docs: 'https://console.suanli.cn/auth/login?invite_code=BShI2j8aFu',
            models: 'https://console.suanli.cn/auth/login?invite_code=BShI2j8aFu',
        },
    },
};
