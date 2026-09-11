import type { Provider } from '@/types';
import type BaseLangChainProvider from './BaseLangChainProvider';
import OpenAiLangChainProvider from './OpenAiLangChainProvider';
import DeepSeekLangChainProvider from './DeepSeekLangChainProvider';
import OllamaLangChainProvider from './OllamaLangChainProvider';
import OrcaRouterLangChainProvider from './OrcaRouterLangChainProvider';
import { isOrcaRouterProvider } from '@/orcarouter/provider';
import type { RootStore } from '@/store';
import { Logger } from '@/utils/logger';

const logger = new Logger('LangChainProviderFactory');

export default class LangChainProviderFactory {
    static create(provider: Provider, rootStore?: RootStore): BaseLangChainProvider {
        const { selectedModel } = provider;

        if (provider.id === 'ollama') {
            logger.info('Creating OllamaLangChainProvider');
            return new OllamaLangChainProvider(provider, rootStore);
        }

        // Must come before the DeepSeek model-id check: OrcaRouter serves
        // `deepseek/...` model ids that would otherwise be routed to the
        // DeepSeek vendor SDK and sent to the wrong host entirely.
        if (isOrcaRouterProvider(provider)) {
            logger.info('Creating OrcaRouterLangChainProvider');
            return new OrcaRouterLangChainProvider(provider, rootStore);
        }

        if (selectedModel?.id.includes('deepseek')) {
            logger.info('Creating DeepSeekLangChainProvider');
            return new DeepSeekLangChainProvider(provider, rootStore);
        }

        logger.info('Creating OpenAiLangChainProvider');
        return new OpenAiLangChainProvider(provider, rootStore);
    }
}
