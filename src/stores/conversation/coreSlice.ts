import type { StateCreator } from "zustand";

import { conversations as conversationsDb } from "@/db";
import { PersistenceService } from "@/services/persistence";
import { useSettingsStore } from "@/stores";
import type { Conversation, ModelParameters } from "@/types";

import type { ConversationCoreState, ConversationState } from "./types";
import { cleanupEmptyDrafts } from "./utils";

export const createCoreSlice: StateCreator<
  ConversationState,
  [],
  [],
  ConversationCoreState
> = (set, get) => ({
  conversations: [],
  activeConversationId: null,
  availableModels: [],
  isLoading: false,
  error: null,

  loadConversations: async () => {
    set({ isLoading: true, error: null });
    try {
      const allConversations = await conversationsDb.getAll();
      const currentConversations = get().conversations;
      const ephemeralConversations = currentConversations.filter(
        (c) => c.persisted === false,
      );

      const combinedConversations = [
        ...allConversations,
        ...ephemeralConversations,
      ];
      combinedConversations.sort((a, b) => b.updatedAt - a.updatedAt);

      set({ conversations: combinedConversations, isLoading: false });
    } catch (error) {
      console.error("Failed to load conversations:", error);
      set({ error: "Failed to load conversations", isLoading: false });
    }
  },

  loadModels: async () => {
    try {
      const { settings: currentSettings } = useSettingsStore.getState();
      const apiKey = currentSettings?.apiKeys["google"];
      if (!apiKey) return;

      // Import dynamically to avoid circular dependency if any
      const { GoogleAPIClient } = await import("@/services/api");
      const client = await GoogleAPIClient.createClient(apiKey);
      const models = await client.getModels();
      set({ availableModels: models });
    } catch (error) {
      console.error("Failed to load models:", error);
    }
  },

  setActiveConversation: (id: string) => {
    set((state) => {
      let cleanedConversations = state.conversations;
      if (state.activeConversationId !== id) {
        cleanedConversations = cleanupEmptyDrafts(state.conversations, id);
      }

      return {
        conversations: cleanedConversations,
        activeConversationId: id,
      };
    });
  },

  createConversation: async (
    modelId: string,
    params: ModelParameters,
    systemPrompt?: string,
    options: { isTemporary?: boolean } = {},
  ) => {
    set({ isLoading: true, error: null });
    try {
      const id = crypto.randomUUID();
      const newConversation: Conversation = {
        id,
        title: "New Conversation",
        modelId,
        parameters: params,
        systemPrompt,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        persisted: false,
        isTemporary: options.isTemporary,
      };

      set((state) => {
        const cleanedConversations = cleanupEmptyDrafts(
          state.conversations,
          id,
        );

        return {
          conversations: [newConversation, ...cleanedConversations],
          activeConversationId: id,
          isLoading: false,
        };
      });

      return id;
    } catch (error) {
      console.error("Failed to create conversation:", error);
      set({ error: "Failed to create conversation", isLoading: false });
      throw error;
    }
  },

  deleteConversation: async (id: string) => {
    try {
      const conversation = get().conversations.find((c) => c.id === id);
      await PersistenceService.deleteConversation(id, conversation?.persisted);

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

  renameConversation: async (id: string, title: string) => {
    try {
      const conversation = get().conversations.find((c) => c.id === id);
      if (conversation && !conversation.isTemporary) {
        await PersistenceService.updateTitle(id, title);
      }

      set((state) => ({
        conversations: state.conversations
          .map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c,
          )
          .sort((a, b) => b.updatedAt - a.updatedAt),
      }));
    } catch (error) {
      console.error("Failed to rename conversation:", error);
      set({ error: "Failed to rename conversation" });
    }
  },

  duplicateConversation: async (id: string) => {
    const state = get();
    const conversation = state.conversations.find((c) => c.id === id);
    if (!conversation) throw new Error("Conversation not found");

    try {
      const createdConversation =
        await PersistenceService.duplicateConversation(conversation);

      set((state) => ({
        conversations: [createdConversation, ...state.conversations],
        activeConversationId: createdConversation.id,
      }));

      return createdConversation.id;
    } catch (error) {
      console.error("Failed to duplicate conversation:", error);
      set({ error: "Failed to duplicate conversation" });
      throw error;
    }
  },
});
