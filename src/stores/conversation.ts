import { create } from "zustand";
import { conversations } from "../db/operations";
import {
  type Conversation,
  type Message,
  type ModelParameters,
} from "../db/schema";

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
  ) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  addMessage: (conversationId: string, message: Message) => Promise<void>;
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
      const allConversations = await conversations.getAll();
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

  createConversation: async (modelId: string, params: ModelParameters) => {
    set({ isLoading: true, error: null });
    try {
      const newConversation: Omit<Conversation, "id"> = {
        title: "New Conversation",
        modelId,
        parameters: params,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const id = await conversations.create(newConversation);
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
      await conversations.delete(id);
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

  addMessage: async (conversationId: string, message: Message) => {
    const state = get();
    const conversation = state.conversations.find(
      (c) => c.id === conversationId,
    );

    if (!conversation) {
      console.error("Conversation not found");
      return;
    }

    const updatedConversation = {
      ...conversation,
      messages: [...conversation.messages, message],
      updatedAt: Date.now(),
    };

    try {
      await conversations.update(conversationId, {
        messages: updatedConversation.messages,
      });

      set((state) => ({
        conversations: state.conversations
          .map((c) => (c.id === conversationId ? updatedConversation : c))
          .sort((a, b) => b.updatedAt - a.updatedAt),
      }));
    } catch (error) {
      console.error("Failed to add message:", error);
      set({ error: "Failed to add message" });
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
      await conversations.update(conversationId, {
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
