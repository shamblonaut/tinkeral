import type { ProviderError } from "@/services/api/base";
import type {
  Conversation,
  FunctionCallingMode,
  Message,
  ModelInfo,
  ModelParameters,
} from "@/types";

export interface ConversationCoreState {
  conversations: Conversation[];
  activeConversationId: string | null;
  availableModels: ModelInfo[];
  isLoading: boolean;
  error: string | ProviderError | null;

  loadConversations: () => Promise<void>;
  loadModels: () => Promise<void>;
  ensureActiveConversation: () => Promise<string>;
  setActiveConversation: (id: string) => void;
  createConversation: (
    modelId: string,
    params: ModelParameters,
    systemPrompt?: string,
    options?: { isTemporary?: boolean },
  ) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  duplicateConversation: (id: string) => Promise<string>;
}

export interface ConversationChatState {
  isStreaming: boolean;
  abortController: AbortController | null;
  setDraft: (conversationId: string, msg: string) => Promise<void>;

  sendMessage: (content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  abortGeneration: () => void;
  updateMessage: (
    conversationId: string,
    messageId: string,
    content: string,
  ) => Promise<void>;
  executeChat: (
    conversationId: string,
    userMessage?: Message,
    titleUpdate?: string,
  ) => Promise<void>;
  setParameters: (
    params: Partial<ModelParameters>,
    mode?: "merge" | "replace",
  ) => Promise<void>;
  setSystemPrompt: (systemPrompt: string) => Promise<void>;
  toggleFunctionAttachment: (functionId: string) => Promise<void>;
  setFunctionCallingMode: (mode: FunctionCallingMode) => Promise<void>;
}

export interface ConversationSearchState {
  searchQuery: string;
  isSearching: boolean;
  setSearchQuery: (query: string) => void;
  setIsSearching: (isSearching: boolean) => void;
}

export interface ConversationSelectionState {
  isSelectionMode: boolean;
  selectedIds: string[];
  toggleSelectionMode: () => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  deleteSelectedConversations: () => Promise<void>;
}

export type ConversationState = ConversationCoreState &
  ConversationChatState &
  ConversationSearchState &
  ConversationSelectionState;
