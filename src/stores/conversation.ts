import { create } from "zustand";

import { conversations as conversationsDb, type Conversation } from "@/db";
import { GoogleAPIClient } from "@/services/api";
import { useSettingsStore } from "@/stores";
import type { Message, ModelParameters } from "@/types";

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  abortController: AbortController | null;

  // Actions
  loadConversations: () => Promise<void>;
  setActiveConversation: (id: string) => void;
  createConversation: (
    modelId: string,
    params: ModelParameters,
    systemPrompt?: string,
  ) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  abortGeneration: () => void;
  updateMessage: (
    conversationId: string,
    messageId: string,
    content: string,
  ) => Promise<void>;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isLoading: false,
  isStreaming: false,
  error: null,
  abortController: null,

  loadConversations: async () => {
    set({ isLoading: true, error: null });
    try {
      const allConversations = await conversationsDb.getAll();
      // Sort by updatedAt descending
      allConversations.sort((a, b) => b.updatedAt - a.updatedAt);
      set({ conversations: allConversations, isLoading: false });
    } catch (error) {
      console.error("Failed to load conversations:", error);
      set({ error: "Failed to load conversations", isLoading: false });
    }
  },

  setActiveConversation: (id: string) => {
    set({ activeConversationId: id });
  },

  createConversation: async (
    modelId: string,
    params: ModelParameters,
    systemPrompt?: string,
  ) => {
    set({ isLoading: true, error: null });
    try {
      const newConversation: Omit<Conversation, "id"> = {
        title: "New Conversation",
        modelId,
        parameters: params,
        systemPrompt,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const id = await conversationsDb.create(newConversation);
      const createdConversation = { ...newConversation, id };

      set((state) => ({
        conversations: [createdConversation, ...state.conversations],
        activeConversationId: id,
        isLoading: false,
      }));

      return id;
    } catch (error) {
      console.error("Failed to create conversation:", error);
      set({ error: "Failed to create conversation", isLoading: false });
      throw error;
    }
  },

  deleteConversation: async (id: string) => {
    try {
      await conversationsDb.delete(id);
      set((state) => {
        const newConversations = state.conversations.filter((c) => c.id !== id);
        return {
          conversations: newConversations,
          activeConversationId:
            state.activeConversationId === id
              ? null
              : state.activeConversationId,
        };
      });
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      set({ error: "Failed to delete conversation" });
    }
  },

  sendMessage: async (content: string) => {
    let { activeConversationId, conversations } = get();

    // 1. Check for active conversation, auto-create if needed
    if (!activeConversationId) {
      console.log("No active conversation, creating new one...");
      try {
        const { settings } = useSettingsStore.getState();
        const modelId = settings?.defaultModel || "gemma-3-1b-it";
        const params = settings?.defaultParameters || {
          temperature: 0.7,
          maxTokens: 1024,
          topP: 0.9,
        };

        const newId = await get().createConversation(modelId, params);

        // Update local variables with new state
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
    if (!conversation) {
      console.error("Conversation not found");
      return;
    }

    // 2. Add user message
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

    const abortController = new AbortController();

    // Optimistic update
    set((state) => ({
      conversations: state.conversations
        .map((c) =>
          c.id === activeConversationId ? conversationWithUserMsg : c,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
      isLoading: true,
      isStreaming: true,
      error: null,
      abortController,
    }));

    // Persist user message
    try {
      await conversationsDb.update(activeConversationId, {
        messages: conversationWithUserMsg.messages,
      });
    } catch (err) {
      console.error("Failed to persist user message:", err);
      // Continue anyway, we can retry persistence later
    }

    // Variables needed for error handling
    let assistantMessageId: string | undefined;
    let fullContent = "";

    // 2. Prepare for API call
    try {
      // Get settings from store state (synchronous)
      const { settings } = useSettingsStore.getState();

      if (!settings) {
        throw new Error("Settings not initialized");
      }

      const apiKey = settings.apiKeys["google"]; // Hardcoded provider for now as per MVP
      if (!apiKey) {
        throw new Error("API key not found for Google provider");
      }

      const client = await GoogleAPIClient.createClient(apiKey);

      // 3. Create placeholder assistant message
      assistantMessageId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "model",
        content: "",
        timestamp: Date.now(),
        metadata: {
          model: conversation.modelId,
        },
      };

      // Update state with empty assistant message
      set((state) => {
        const currentConv = state.conversations.find(
          (c) => c.id === activeConversationId,
        );
        if (!currentConv) return {};

        const updatedConv = {
          ...currentConv,
          messages: [...currentConv.messages, assistantMessage],
        };

        return {
          conversations: state.conversations.map((c) =>
            c.id === activeConversationId ? updatedConv : c,
          ),
          activeConversationId, // Force update
        };
      });

      // 4. Stream response
      const stream = client.streamChat(
        {
          messages: conversationWithUserMsg.messages,
          model: conversation.modelId,
          parameters: conversation.parameters,
          systemPrompt: conversation.systemPrompt,
        },
        abortController.signal,
      );

      let lastUpdate = Date.now();
      let lastMetadata = {};

      for await (const chunk of stream) {
        fullContent += chunk.delta;

        // Collect metadata if present (usually in final chunk)
        if (chunk.finishReason || chunk.usage) {
          lastMetadata = {
            finishReason: chunk.finishReason,
            tokens: chunk.usage?.totalTokens,
          };
        }

        // Throttle updates to ~60fps (16ms)
        const now = Date.now();
        if (now - lastUpdate >= 16) {
          set((state) => {
            const currentConv = state.conversations.find(
              (c) => c.id === activeConversationId,
            );
            if (!currentConv) return {};

            const updatedMessages = currentConv.messages.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: fullContent,
                  }
                : m,
            );

            return {
              conversations: state.conversations.map((c) =>
                c.id === activeConversationId
                  ? { ...c, messages: updatedMessages }
                  : c,
              ),
            };
          });
          lastUpdate = now;
        }
      }

      // 5. Finalize update with complete content and metadata
      set((state) => {
        const currentConv = state.conversations.find(
          (c) => c.id === activeConversationId,
        );
        if (!currentConv) return {};

        const updatedMessages = currentConv.messages.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: fullContent,
                metadata: {
                  ...m.metadata,
                  ...lastMetadata,
                },
              }
            : m,
        );

        const updatedConv = {
          ...currentConv,
          messages: updatedMessages,
        };

        return {
          conversations: state.conversations.map((c) =>
            c.id === activeConversationId ? updatedConv : c,
          ),
          isLoading: false,
          isStreaming: false,
          abortController: null,
        };
      });

      // 6. Persist final conversation state
      const finalConversation = get().conversations.find(
        (c) => c.id === activeConversationId,
      );
      if (finalConversation) {
        await conversationsDb.update(activeConversationId, {
          messages: finalConversation.messages,
          updatedAt: Date.now(),
        });
      }
    } catch (error: unknown) {
      console.error("Chat generation failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to generate response";

      // Attempt to save partial content if any
      if (fullContent) {
        set((state) => {
          const currentConv = state.conversations.find(
            (c) => c.id === activeConversationId,
          );
          if (!currentConv) return {};

          const updatedMessages = currentConv.messages.map((m) =>
            m.id === assistantMessageId ? { ...m, content: fullContent } : m,
          );

          return {
            conversations: state.conversations.map((c) =>
              c.id === activeConversationId
                ? { ...c, messages: updatedMessages }
                : c,
            ),
          };
        });
      }

      // Check if it was an abort error
      const isAborted =
        error instanceof DOMException && error.name === "AbortError";

      set({
        error: isAborted ? null : errorMessage, // Don't show error if aborted
        isLoading: false,
        isStreaming: false,
        abortController: null,
      });

      if (!isAborted) {
        // Error is already set in state
      }
    }
  },

  abortGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      // State cleanup is handled in the catch block of sendMessage
      // But we can optimistically update here too
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
    const state = get();
    const conversation = state.conversations.find(
      (c) => c.id === conversationId,
    );

    if (!conversation) {
      console.error("Conversation not found");
      return;
    }

    const updatedMessages = conversation.messages.map((m) =>
      m.id === messageId ? { ...m, content } : m,
    );

    const updatedConversation = {
      ...conversation,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };

    try {
      await conversationsDb.update(conversationId, {
        messages: updatedMessages,
      });

      set((state) => ({
        conversations: state.conversations
          .map((c) => (c.id === conversationId ? updatedConversation : c))
          .sort((a, b) => b.updatedAt - a.updatedAt),
      }));
    } catch (error) {
      console.error("Failed to update message:", error);
      set({ error: "Failed to update message" });
    }
  },
}));
