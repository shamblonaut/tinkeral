import type { StoreApi } from "zustand";

import { functions as functionsDb } from "@/db";
import type { FunctionDefinition } from "@/features/functions";
import { useSettingsStore } from "@/features/settings";
import type { ProviderError } from "@/shared/services/api";
import type { FunctionCall, FunctionResult, Message } from "@/shared/types";

import { ChatService, type ChatMetadata } from "../services";
import {
  persistConversationUpdate,
  persistFinalChatConversation,
} from "./chatPersistence";
import type { ConversationState } from "./types";
import { deleteMessageAndFollowing } from "./utils";

type SetConversationState = StoreApi<ConversationState>["setState"];
type GetConversationState = StoreApi<ConversationState>["getState"];

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

function normalizeChatError(error: unknown): string | ProviderError {
  if (typeof error === "string") {
    const trimmed = error.trim();
    return trimmed || "An unexpected error occurred";
  }

  if (error && typeof error === "object") {
    const message =
      "message" in error && typeof error.message === "string"
        ? error.message.trim()
        : "";
    if (message) {
      return error as ProviderError;
    }
  }

  return "An unexpected error occurred";
}

async function loadAttachedFunctions(
  functionIds: string[] | undefined,
): Promise<FunctionDefinition[]> {
  if (!functionIds?.length) {
    return [];
  }

  const loadedFunctions = await Promise.all(
    functionIds.map((functionId) => functionsDb.get(functionId)),
  );

  return loadedFunctions.filter(
    (functionDefinition): functionDefinition is FunctionDefinition =>
      Boolean(functionDefinition),
  );
}

export async function sendMessage(
  set: SetConversationState,
  get: GetConversationState,
  content: string,
): Promise<void> {
  let { activeConversationId, conversations } = get();

  if (!activeConversationId) {
    try {
      activeConversationId = await get().ensureActiveConversation();
      conversations = get().conversations;
    } catch (error) {
      console.error("Failed to auto-create conversation:", error);
      return;
    }
  }

  const conversation = conversations.find(
    (item) => item.id === activeConversationId,
  );
  if (!conversation || !activeConversationId) {
    return;
  }

  const userMessage: Message = {
    id: crypto.randomUUID(),
    role: "user",
    content,
    timestamp: Date.now(),
  };

  const conversationWithUserMessage = {
    ...conversation,
    messages: [...conversation.messages, userMessage],
    updatedAt: Date.now(),
  };

  let titleUpdate: string | undefined;
  if (
    conversation.title === "New Conversation" &&
    conversation.messages.length === 0
  ) {
    titleUpdate =
      content.length > 40 ? `${content.substring(0, 37)}...` : content;
    conversationWithUserMessage.title = titleUpdate;
  }

  set((state) => ({
    conversations: state.conversations
      .map((item) =>
        item.id === activeConversationId ? conversationWithUserMessage : item,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt),
  }));

  await get().executeChat(activeConversationId, userMessage, titleUpdate);
}

export async function executeChat(
  set: SetConversationState,
  get: GetConversationState,
  conversationId: string,
  userMessage?: Message,
  titleUpdate?: string,
): Promise<void> {
  const conversation = get().conversations.find(
    (item) => item.id === conversationId,
  );
  if (!conversation) {
    return;
  }

  const abortController = new AbortController();
  set({
    isLoading: true,
    isStreaming: true,
    error: null,
    abortController,
  });

  let assistantMessageId: string | undefined;

  try {
    const { settings } = useSettingsStore.getState();
    if (!settings) {
      throw new Error("Settings not initialized");
    }

    const apiKey = settings.apiKeys.google;
    if (!apiKey) {
      throw new Error("API key not found for Google provider");
    }

    const attachedFunctions = await loadAttachedFunctions(
      conversation.functionIds,
    );
    const selectedModel = get().availableModels.find(
      (model) => model.id === conversation.modelId,
    );
    const supportsFunctionCalling =
      selectedModel?.capabilities.functionCalling ?? true;
    const enabledFunctions = supportsFunctionCalling ? attachedFunctions : [];

    assistantMessageId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "model",
      content: "",
      timestamp: Date.now(),
      metadata: { model: conversation.modelId },
    };

    set((state) => ({
      conversations: state.conversations.map((item) =>
        item.id === conversationId
          ? { ...item, messages: [...item.messages, assistantMessage] }
          : item,
      ),
    }));

    await ChatService.executeChat(
      {
        messages: conversation.messages,
        modelId: conversation.modelId,
        parameters: conversation.parameters,
        systemPrompt: conversation.systemPrompt,
        apiKey,
        ...(enabledFunctions.length
          ? {
              functions: enabledFunctions,
              functionCallingMode: conversation.functionCallingMode,
            }
          : {}),
      },
      {
        onChunk: (chunk: string, thoughtSignature?: string) => {
          set((state) => ({
            conversations: state.conversations.map((item) =>
              item.id === conversationId
                ? {
                    ...item,
                    messages: item.messages.map((message) =>
                      message.id === assistantMessageId
                        ? {
                            ...message,
                            content: chunk,
                            ...(thoughtSignature ? { thoughtSignature } : {}),
                          }
                        : message,
                    ),
                  }
                : item,
            ),
          }));
        },
        onFunctionCall: (functionCall: FunctionCall) => {
          set((state) => ({
            conversations: state.conversations.map((item) =>
              item.id === conversationId
                ? {
                    ...item,
                    messages: item.messages.map((message) =>
                      message.id === assistantMessageId
                        ? {
                            ...message,
                            functionCall,
                            metadata: {
                              ...message.metadata,
                              finishReason: "function_call",
                            },
                          }
                        : message,
                    ),
                  }
                : item,
            ),
          }));
        },
        onFunctionResult: (functionResult: FunctionResult) => {
          const functionResultMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: "",
            timestamp: Date.now(),
            functionResult,
          };

          const nextAssistantMessageId = crypto.randomUUID();
          const nextAssistantMessage: Message = {
            id: nextAssistantMessageId,
            role: "model",
            content: "",
            timestamp: Date.now(),
            metadata: { model: conversation.modelId },
          };

          set((state) => ({
            conversations: state.conversations.map((item) =>
              item.id === conversationId
                ? {
                    ...item,
                    messages: [
                      ...item.messages,
                      functionResultMessage,
                      nextAssistantMessage,
                    ],
                  }
                : item,
            ),
          }));

          assistantMessageId = nextAssistantMessageId;
        },
        onFinish: async (fullContent: string, metadata: ChatMetadata) => {
          set((state) => {
            const currentConversation = state.conversations.find(
              (item) => item.id === conversationId,
            );
            if (!currentConversation) {
              return {};
            }

            const updatedMessages = currentConversation.messages.map(
              (message) => {
                if (message.id === assistantMessageId) {
                  return {
                    ...message,
                    content: fullContent,
                    metadata: { ...message.metadata, ...metadata },
                  };
                }

                if (
                  userMessage &&
                  message.id === userMessage.id &&
                  metadata.usage?.inputTokens
                ) {
                  return {
                    ...message,
                    metadata: {
                      ...message.metadata,
                      usage: { inputTokens: metadata.usage.inputTokens },
                    },
                  };
                }

                return message;
              },
            );

            return {
              conversations: state.conversations.map((item) =>
                item.id === conversationId
                  ? {
                      ...item,
                      messages: updatedMessages,
                      metadata: {
                        ...item.metadata,
                        totalTokens: metadata.usage?.totalTokens,
                      },
                    }
                  : item,
              ),
              isLoading: false,
              isStreaming: false,
              abortController: null,
            };
          });

          await persistFinalChatConversation(
            set,
            get,
            conversationId,
            titleUpdate,
          );
        },
        onError: (error, partialContent) => {
          if (partialContent) {
            set((state) => ({
              conversations: state.conversations.map((item) =>
                item.id === conversationId
                  ? {
                      ...item,
                      messages: item.messages.map((message) =>
                        message.id === assistantMessageId
                          ? { ...message, content: partialContent }
                          : message,
                      ),
                    }
                  : item,
              ),
            }));
          }

          const isAborted = isAbortError(error);

          const currentConversation = get().conversations.find(
            (item) => item.id === conversationId,
          );
          const hasFunctionResults =
            currentConversation?.messages.some(
              (message) => message.functionResult,
            ) || false;

          if (
            !isAborted &&
            !partialContent &&
            userMessage &&
            !hasFunctionResults
          ) {
            void get().setDraft(conversationId, userMessage.content);
            set((state) => ({
              conversations: state.conversations.map((item) =>
                item.id === conversationId
                  ? {
                      ...item,
                      messages: deleteMessageAndFollowing(
                        item.messages,
                        userMessage.id,
                      ),
                    }
                  : item,
              ),
            }));
            void persistConversationUpdate(get, conversationId);
          }

          set((state) => {
            if (state.abortController !== abortController) {
              return {};
            }

            return {
              error: isAborted ? null : normalizeChatError(error),
              isLoading: false,
              isStreaming: false,
              abortController: null,
            };
          });
        },
      },
      abortController.signal,
    );
  } catch (error) {
    if (userMessage) {
      void get().setDraft(conversationId, userMessage.content);
      void get().deleteMessage(userMessage.id);
    }

    set({
      error: normalizeChatError(error),
      isLoading: false,
      isStreaming: false,
      abortController: null,
    });
  }
}
