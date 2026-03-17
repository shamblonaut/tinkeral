import type { StateCreator } from "zustand";

import { conversations as conversationsDb } from "@/db";
import { DEFAULT_MODEL_ID, getModelDefaultParameters } from "@/lib/models";
import { GoogleAPIClient } from "@/services/api/google";
import { PersistenceService } from "@/services/persistence";
import { useFunctionsStore } from "@/stores/functions";
import { useSettingsStore } from "@/stores/settings";
import type { Conversation, ModelParameters } from "@/types";

import type { ConversationCoreState, ConversationState } from "./types";

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

      // Imported statically above
      // const { GoogleAPIClient } = await import("@/services/api/google");
      const client = await GoogleAPIClient.createClient(apiKey);
      const models = await client.getModels();
      set({ availableModels: models });
    } catch (error) {
      console.error("Failed to load models:", error);
    }
  },

  setActiveConversation: (id: string) => {
    set((state) => {
      return {
        conversations: state.conversations,
        activeConversationId: id,
      };
    });
  },

  ensureActiveConversation: async () => {
    const { activeConversationId, conversations } = get();

    if (activeConversationId) {
      const existingConversation = conversations.find(
        (conversation) => conversation.id === activeConversationId,
      );
      if (existingConversation) {
        return activeConversationId;
      }
    }

    const { settings } = useSettingsStore.getState();
    const defaultModel = settings?.defaultModel || DEFAULT_MODEL_ID;
    const defaultParams =
      settings?.defaultParameters || getModelDefaultParameters(defaultModel);

    return get().createConversation(defaultModel, defaultParams);
  },

  createConversation: async (
    modelId: string,
    params: ModelParameters,
    systemPrompt?: string,
    options: { isTemporary?: boolean } = {},
  ) => {
    set({ isLoading: true });
    try {
      // Check for an existing empty conversation of the requested type
      const existingEmpty = get().conversations.find((c) => {
        const isEmpty = c.messages.length === 0;
        const matchesTemporary =
          Boolean(options.isTemporary) === Boolean(c.isTemporary);
        // We only reuse non-persisted ones
        return isEmpty && matchesTemporary && !c.persisted;
      });

      if (existingEmpty) {
        const allFunctions = useFunctionsStore.getState().functions;
        const functionIds = allFunctions.map((f) => f.id);

        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === existingEmpty.id
              ? {
                  ...c,
                  modelId,
                  parameters: params,
                  systemPrompt,
                  updatedAt: Date.now(),
                  functionIds,
                }
              : c,
          ),
          isLoading: false,
        }));
        get().setActiveConversation(existingEmpty.id);
        return existingEmpty.id;
      }

      const id = crypto.randomUUID();
      const allFunctions = useFunctionsStore.getState().functions;
      const functionIds = allFunctions.map((f) => f.id);

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
        functionIds,
      };

      set((state) => {
        return {
          conversations: [newConversation, ...state.conversations],
          activeConversationId: id,
          isLoading: false,
        };
      });

      return id;
    } catch (error) {
      console.error("Failed to create conversation:", error);
      set({ isLoading: false });
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
