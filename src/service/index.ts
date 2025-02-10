import { IMessage } from '@/typings';
import { requestAIStream, requestApi } from '@/utils';
import { SERVICE_MAP } from '@/utils/constant';
import storage from '@/utils/storage';

export const validateApiKey = async () => {
    const { selectedModel, selectedProvider } = await storage.getConfig();

    if (!selectedProvider || !(selectedProvider in SERVICE_MAP)) {
        throw new Error('请选择服务商');
    }

    const url = SERVICE_MAP[selectedProvider as keyof typeof SERVICE_MAP].chat;
    const data = {
        model: selectedModel,
        messages: [{ role: 'user', content: 'test' }],
        stream: false,
    };
    return requestApi(url, 'POST', data);
};

export const chat = async (messages: IMessage[]) => {
    const { selectedModel, selectedProvider } = await storage.getConfig();

    if (!selectedProvider || !(selectedProvider in SERVICE_MAP)) {
        throw new Error('请选择服务商');
    }
    const url = SERVICE_MAP[selectedProvider as keyof typeof SERVICE_MAP].chat;
    const data = {
        model: selectedModel,
        messages: [{ role: 'system', content: '你是一个 AI 助手，请回答用户的问题' }, ...messages],
        stream: true,
    };
    console.log('data', data);
    return requestApi(url, 'POST', data);
};

export const chatAIStream = async (
    messages: IMessage[],
    onData: (chunk: { data: string; done: boolean }) => void,
) => {
    const { selectedModel, selectedProvider } = await storage.getConfig();

    if (!selectedProvider || !(selectedProvider in SERVICE_MAP)) {
        throw new Error('请选择服务商');
    }
    const url = SERVICE_MAP[selectedProvider as keyof typeof SERVICE_MAP].chat;
    const data = {
        model: selectedModel,
        messages: [{ role: 'system', content: '你是一个 AI 助手，请回答用户的问题' }, ...messages],
        stream: true,
    };
    console.log('data', data);
    return requestAIStream(url, 'POST', data, onData);
};
