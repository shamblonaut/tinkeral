import { create } from "zustand";
import { conversations as conversationsDb } from "../db/operations";
import type { Conversation } from "../db/schema";
import { GoogleAPIClient } from "../services/api/google";
import type { Message, ModelParameters } from "../types/conversation";
import { useSettingsStore } from "./settings";

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;

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
  error: null,

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
    const state = get();
    const { activeConversationId, conversations } = state;

    if (!activeConversationId) {
      console.error("No active conversation");
      return;
    }

    const conversation = conversations.find(
      (c) => c.id === activeConversationId,
    );
    if (!conversation) {
      console.error("Conversation not found");
      return;
    }

    // 1. Add user message
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

    // Optimistic update
    set((state) => ({
      conversations: state.conversations
        .map((c) =>
          c.id === activeConversationId ? conversationWithUserMsg : c,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
      isLoading: true,
      error: null,
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
      const assistantMessageId = crypto.randomUUID();
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

      // 4. Generate response
      const response = await client.chat({
        messages: conversationWithUserMsg.messages,
        model: conversation.modelId,
        parameters: conversation.parameters,
        systemPrompt: conversation.systemPrompt,
      });

      set((state) => {
        const currentConv = state.conversations.find(
          (c) => c.id === activeConversationId,
        );
        if (!currentConv) return {};

        const updatedMessages = currentConv.messages.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: response.message.content,
                metadata: {
                  ...m.metadata,
                  ...response.message.metadata,
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
        };
      });

      // 5. Finalize and persist
      const finalConversation = get().conversations.find(
        (c) => c.id === activeConversationId,
      );
      if (finalConversation) {
        await conversationsDb.update(activeConversationId, {
          messages: finalConversation.messages,
          updatedAt: Date.now(),
        });
      }

      set({ isLoading: false });
    } catch (error: unknown) {
      console.error("Chat generation failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to generate response";
      set({
        error: errorMessage,
        isLoading: false,
      });
      console.log(errorMessage);

      // Add error message to chat if needed, or just show toast (handled by UI via error state)
    }
  },

  abortGeneration: () => {
    // Implement abort logic later
    console.warn("Abort not implemented yet");
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
