import { TranslationKey } from '@/contexts/LanguageContext';
import { ChatMessage } from '@/types';

export interface WindowState {
    position: { x: number; y: number };
    size: { width: number; height: number };
    isVisible: boolean;
    isPinned: boolean;
}

export interface HeaderActionsProps {
    isPinned: boolean;
    togglePin: () => void;
    onCancel: () => void;
    pinTooltip: string;
    closeTooltip: string;
    feedbackTooltip: string;
}

export interface ChatInterfaceProps {
    initialText?: string;
}

export interface MessageBubbleProps {
    message: ChatMessage;
    isStreaming: boolean;
    t: (key: TranslationKey) => string;
    copyToClipboard: (text: string) => void;
    regenerateResponse: () => void;
}

export interface EmptyChatProps {
    t: (key: TranslationKey) => string;
    handleExampleClick: (text: string) => void;
}

export interface Prompt {
    key: string;
    name: string;
    content: string;
}
