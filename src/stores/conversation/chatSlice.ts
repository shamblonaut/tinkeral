import type { StateCreator } from "zustand";

import { DEFAULT_MODEL_ID, getModelDefaultParameters } from "@/lib/models";
import { ChatService, type ChatMetadata } from "@/services/chat";
import { PersistenceService } from "@/services/persistence";
import { useSettingsStore } from "@/stores";
import {
  DEFAULT_PARAMETERS,
  type Message,
  type ModelParameters,
} from "@/types";
import type { ConversationChatState, ConversationState } from "./types";
import {
  deleteMessageAndFollowing,
  prepareMessagesForEdit,
  prepareMessagesForRetry,
} from "./utils";

export const createChatSlice: StateCreator<
  ConversationState,
  [],
  [],
  ConversationChatState
> = (set, get) => ({
  isStreaming: false,
  abortController: null,

  setDraft: async (conversationId: string, msg: string) => {
    set((state) => {
      const currentConv = state.conversations.find(
        (c) => c.id === conversationId,
      );
      if (!currentConv || currentConv.isTemporary) return {};

      const updatedConv = {
        ...currentConv,
        draft: msg,
        updatedAt: Date.now(),
      };

      return {
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? updatedConv : c,
        ),
      };
    });

    const finalConv = get().conversations.find((c) => c.id === conversationId);
    if (finalConv) {
      await PersistenceService.updateConversation(finalConv);
    }
  },

  sendMessage: async (content: string) => {
    let { activeConversationId, conversations } = get();

    if (!activeConversationId) {
      try {
        const { settings } = useSettingsStore.getState();
        const modelId = settings?.defaultModel || DEFAULT_MODEL_ID;
        const params = getModelDefaultParameters(modelId);
        const newId = await get().createConversation(modelId, params);
        activeConversationId = newId;
        conversations = get().conversations;
      } catch (error) {
        console.error("Failed to auto-create conversation:", error);
        return;
      }
    }

    const conversation = conversations.find(
      (c) => c.id === activeConversationId,
    );
    if (!conversation) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: Date.now(),
    };

    const conversationWithUserMsg = {
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
        content.length > 40 ? content.substring(0, 37) + "..." : content;
      conversationWithUserMsg.title = titleUpdate;
    }

    set((state) => ({
      conversations: state.conversations
        .map((c) =>
          c.id === activeConversationId ? conversationWithUserMsg : c,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    }));

    await get().executeChat(activeConversationId, userMessage, titleUpdate);
  },

  executeChat: async (
    conversationId: string,
    userMessage?: Message,
    titleUpdate?: string,
  ) => {
    const { conversations } = get();
    const conversation = conversations.find((c) => c.id === conversationId);
    if (!conversation) return;

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
      if (!settings) throw new Error("Settings not initialized");

      const apiKey = settings.apiKeys["google"];
      if (!apiKey) throw new Error("API key not found for Google provider");

      assistantMessageId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "model",
        content: "",
        timestamp: Date.now(),
        metadata: { model: conversation.modelId },
      };

      set((state: ConversationState) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, messages: [...c.messages, assistantMessage] }
            : c,
        ),
      }));

      await ChatService.executeChat(
        {
          messages: conversation.messages,
          modelId: conversation.modelId,
          parameters: conversation.parameters,
          systemPrompt: conversation.systemPrompt,
          apiKey,
        },
        {
          onChunk: (content: string) => {
            set((state: ConversationState) => ({
              conversations: state.conversations.map((c) =>
                c.id === conversationId
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantMessageId ? { ...m, content } : m,
                      ),
                    }
                  : c,
              ),
            }));
          },
          onFinish: async (fullContent: string, lastMetadata: ChatMetadata) => {
            set((state: ConversationState) => {
              const currentConv = state.conversations.find(
                (c) => c.id === conversationId,
              );
              if (!currentConv) return {};

              const updatedMessages = currentConv.messages.map((m) => {
                if (m.id === assistantMessageId) {
                  return {
                    ...m,
                    content: fullContent,
                    metadata: { ...m.metadata, ...lastMetadata },
                  };
                }
                if (
                  userMessage &&
                  m.id === userMessage.id &&
                  lastMetadata.usage?.inputTokens
                ) {
                  return {
                    ...m,
                    metadata: {
                      ...m.metadata,
                      usage: { inputTokens: lastMetadata.usage.inputTokens },
                    },
                  };
                }
                return m;
              });

              return {
                conversations: state.conversations.map((c) =>
                  c.id === conversationId
                    ? {
                        ...c,
                        messages: updatedMessages,
                        metadata: {
                          ...c.metadata,
                          totalTokens: lastMetadata.usage?.totalTokens,
                        },
                      }
                    : c,
                ),
                isLoading: false,
                isStreaming: false,
                abortController: null,
              };
            });

            // Persist final state
            const finalConv = get().conversations.find(
              (c) => c.id === conversationId,
            );
            if (finalConv) {
              if (finalConv.persisted === false && !finalConv.isTemporary) {
                // Initial persist on first successful response
                const wasPersisted =
                  await PersistenceService.saveNewConversation(
                    finalConv,
                    titleUpdate,
                  );
                if (wasPersisted) {
                  set((state) => ({
                    conversations: state.conversations.map((c) =>
                      c.id === conversationId ? { ...c, persisted: true } : c,
                    ),
                  }));
                }
              } else {
                // Just an update
                await PersistenceService.updateConversation(finalConv);
              }
            }
          },
          onError: (error, partialContent) => {
            if (partialContent) {
              set((state) => ({
                conversations: state.conversations.map((c) =>
                  c.id === conversationId
                    ? {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === assistantMessageId
                            ? { ...m, content: partialContent }
                            : m,
                        ),
                      }
                    : c,
                ),
              }));
            }
            const isAborted =
              error instanceof DOMException && error.name === "AbortError";

            if (!isAborted && !partialContent && userMessage) {
              void get().setDraft(conversationId, userMessage.content);
              // Fire and forget deleteMessage to clean up the conversation
              void get().deleteMessage(userMessage.id);
            }

            set({
              error: isAborted ? null : error,
              isLoading: false,
              isStreaming: false,
              abortController: null,
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
        error: (error as Error).message,
        isLoading: false,
        isStreaming: false,
        abortController: null,
      });
    }
  },

  deleteMessage: async (messageId: string) => {
    const { activeConversationId, conversations } = get();
    if (!activeConversationId) return;

    const conversation = conversations.find(
      (c) => c.id === activeConversationId,
    );
    if (!conversation) return;

    const updatedMessages = deleteMessageAndFollowing(
      conversation.messages,
      messageId,
    );
    const updatedConversation = {
      ...conversation,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === activeConversationId ? updatedConversation : c,
      ),
    }));

    await PersistenceService.updateConversation(updatedConversation);
  },

  retryMessage: async (messageId: string) => {
    const { activeConversationId, conversations } = get();
    if (!activeConversationId) return;

    const conversation = conversations.find(
      (c) => c.id === activeConversationId,
    );
    if (!conversation) return;

    const retryInfo = prepareMessagesForRetry(conversation.messages, messageId);
    if (!retryInfo) return;

    const { updatedMessages, userMessage } = retryInfo;
    const updatedConversation = {
      ...conversation,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === activeConversationId ? updatedConversation : c,
      ),
    }));

    // Instead of executing the chat again, move the message back to input
    if (userMessage) {
      void get().setDraft(activeConversationId, userMessage.content);
    }
    await PersistenceService.updateConversation(updatedConversation);
  },

  editMessage: async (messageId: string, content: string) => {
    const { activeConversationId, conversations } = get();
    if (!activeConversationId) return;

    const conversation = conversations.find(
      (c) => c.id === activeConversationId,
    );
    if (!conversation) return;

    const editInfo = prepareMessagesForEdit(
      conversation.messages,
      messageId,
      content,
    );
    if (!editInfo) return;

    const { updatedMessages, editedMessage } = editInfo;
    const updatedConversation = {
      ...conversation,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === activeConversationId ? updatedConversation : c,
      ),
    }));

    if (editedMessage.role === "user") {
      await get().executeChat(activeConversationId, editedMessage);
    } else {
      await PersistenceService.updateConversation(updatedConversation);
    }
  },

  abortGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({
        isLoading: false,
        isStreaming: false,
        abortController: null,
      });
    }
  },

  updateMessage: async (
    conversationId: string,
    messageId: string,
    content: string,
  ) => {
    set((state) => {
      const currentConv = state.conversations.find(
        (c) => c.id === conversationId,
      );
      if (!currentConv) return {};

      const updatedMessages = currentConv.messages.map((m) =>
        m.id === messageId ? { ...m, content } : m,
      );

      const updatedConv = {
        ...currentConv,
        messages: updatedMessages,
        updatedAt: Date.now(),
      };

      return {
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? updatedConv : c,
        ),
      };
    });

    const finalConv = get().conversations.find((c) => c.id === conversationId);
    if (finalConv) {
      await PersistenceService.updateConversation(finalConv);
    }
  },

  setParameters: async (
    params: Partial<ModelParameters>,
    mode: "merge" | "replace" = "merge",
  ) => {
    const { activeConversationId } = get();
    if (!activeConversationId) return;

    set((state) => {
      const currentConv = state.conversations.find(
        (c) => c.id === activeConversationId,
      );
      if (!currentConv) return {};

      const updatedParams: ModelParameters =
        mode === "merge"
          ? { ...currentConv.parameters, ...params }
          : { ...DEFAULT_PARAMETERS, ...params };

      const updatedConv = {
        ...currentConv,
        parameters: updatedParams,
        updatedAt: Date.now(),
      };

      return {
        conversations: state.conversations.map((c) =>
          c.id === activeConversationId ? updatedConv : c,
        ),
      };
    });

    const finalConv = get().conversations.find(
      (c) => c.id === activeConversationId,
    );
    if (finalConv) {
      await PersistenceService.updateConversation(finalConv);
    }
  },

  setSystemPrompt: async (systemPrompt: string) => {
    const { activeConversationId } = get();
    if (!activeConversationId) return;

    set((state) => {
      const currentConv = state.conversations.find(
        (c) => c.id === activeConversationId,
      );
      if (!currentConv) return {};

      const updatedConv = {
        ...currentConv,
        systemPrompt,
        updatedAt: Date.now(),
      };

      return {
        conversations: state.conversations.map((c) =>
          c.id === activeConversationId ? updatedConv : c,
        ),
      };
    });

    const finalConv = get().conversations.find(
      (c) => c.id === activeConversationId,
    );
    if (finalConv) {
      await PersistenceService.updateConversation(finalConv);
    }
  },
});
