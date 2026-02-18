import { create } from "zustand";

import { conversations as conversationsDb, type Conversation } from "@/db";
import { getModelDefaultParameters } from "@/lib/models";
import { GoogleAPIClient } from "@/services/api";
import { useSettingsStore } from "@/stores";
import { type Message, type ModelInfo, type ModelParameters } from "@/types";

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  availableModels: ModelInfo[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  abortController: AbortController | null;
  searchQuery: string;
  isSearching: boolean;
  isSelectionMode: boolean;
  selectedIds: string[];

  // Actions
  loadConversations: () => Promise<void>;
  loadModels: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setIsSearching: (isSearching: boolean) => void;
  toggleSelectionMode: () => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  deleteSelectedConversations: () => Promise<void>;
  setActiveConversation: (id: string) => void;
  createConversation: (
    modelId: string,
    params: ModelParameters,
    systemPrompt?: string,
    options?: { isTemporary?: boolean },
  ) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  abortGeneration: () => void;
  updateMessage: (
    conversationId: string,
    messageId: string,
    content: string,
  ) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  duplicateConversation: (id: string) => Promise<string>;
  setParameters: (
    params: Partial<ModelParameters>,
    mode?: "merge" | "replace",
  ) => Promise<void>;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  availableModels: [],
  isLoading: false,
  isStreaming: false,
  error: null,
  abortController: null,
  searchQuery: "",
  isSearching: false,
  isSelectionMode: false,
  selectedIds: [],

  loadConversations: async () => {
    set({ isLoading: true, error: null });
    try {
      const allConversations = await conversationsDb.getAll();

      // Preserve ephemeral conversations from current state
      const currentConversations = get().conversations;
      const ephemeralConversations = currentConversations.filter(
        (c) => c.persisted === false,
      );

      // Combine DB conversations with ephemeral ones
      const combinedConversations = [
        ...allConversations,
        ...ephemeralConversations,
      ];

      // Sort by updatedAt descending
      combinedConversations.sort((a, b) => b.updatedAt - a.updatedAt);

      set({ conversations: combinedConversations, isLoading: false });
    } catch (error) {
      console.error("Failed to load conversations:", error);
      set({ error: "Failed to load conversations", isLoading: false });
    }
  },

  loadModels: async () => {
    try {
      const { settings } = useSettingsStore.getState();
      const apiKey = settings?.apiKeys["google"];
      if (!apiKey) return;

      // Create a temporary client just to fetch models
      const client = await GoogleAPIClient.createClient(apiKey);
      const models = await client.getModels();
      set({ availableModels: models });
    } catch (error) {
      console.error("Failed to load models:", error);
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setIsSearching: (isSearching: boolean) => {
    set({ isSearching });
  },

  toggleSelectionMode: () => {
    set((state) => ({
      isSelectionMode: !state.isSelectionMode,
      selectedIds: [], // Clear selection when toggling mode
    }));
  },

  toggleSelection: (id: string) => {
    set((state) => {
      const selectedIds = state.selectedIds.includes(id)
        ? state.selectedIds.filter((selectedId) => selectedId !== id)
        : [...state.selectedIds, id];
      return { selectedIds };
    });
  },

  selectAll: () => {
    set((state) => {
      const filteredIds = state.conversations
        .filter(
          (c) =>
            c.persisted !== false &&
            c.title.toLowerCase().includes(state.searchQuery.toLowerCase()),
        )
        .map((c) => c.id);
      return { selectedIds: filteredIds };
    });
  },

  deselectAll: () => {
    set({ selectedIds: [] });
  },

  deleteSelectedConversations: async () => {
    const { selectedIds, conversations: currentConversations } = get();
    if (selectedIds.length === 0) return;

    try {
      // Delete persisted conversations
      const persistedIds = currentConversations
        .filter((c) => selectedIds.includes(c.id) && c.persisted !== false)
        .map((c) => c.id);

      if (persistedIds.length > 0) {
        await Promise.all(persistedIds.map((id) => conversationsDb.delete(id)));
      }

      set((state) => {
        const newConversations = state.conversations.filter(
          (c) => !selectedIds.includes(c.id),
        );

        // If active conversation was deleted, deselect it
        const newActiveId = selectedIds.includes(
          state.activeConversationId || "",
        )
          ? null
          : state.activeConversationId;

        return {
          conversations: newConversations,
          activeConversationId: newActiveId,
          selectedIds: [],
          isSelectionMode: false, // Exit selection mode after delete
        };
      });
    } catch (error) {
      console.error("Failed to delete selected conversations:", error);
      set({ error: "Failed to delete selected conversations" });
    }
  },

  setActiveConversation: (id: string) => {
    set((state) => {
      // If current conversation is empty and ephemeral, remove it
      // Only if we are switching to a DIFFERENT conversation
      let cleanedConversations = state.conversations;
      if (state.activeConversationId !== id) {
        cleanedConversations = cleanupEmptyDrafts(
          state.conversations,
          state.activeConversationId,
        );
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
        // If current conversation is empty and ephemeral, remove it
        const cleanedConversations = cleanupEmptyDrafts(
          state.conversations,
          state.activeConversationId,
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
      if (conversation && conversation.persisted !== false) {
        await conversationsDb.delete(id);
      }

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
        const modelId = settings?.defaultModel || "gemini-2.5-flash-lite";
        const params = getModelDefaultParameters(modelId);

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

    // 2.1 Auto-generate title if it's a new conversation
    let titleUpdate: string | undefined;
    if (
      conversation.title === "New Conversation" &&
      conversation.messages.length === 0
    ) {
      // Use first 40 chars of message as title
      titleUpdate =
        content.length > 40 ? content.substring(0, 37) + "..." : content;
      conversationWithUserMsg.title = titleUpdate;
    }

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
    // Persist user message and potentially title
    try {
      // Check if conversation is not persisted (was ephemeral)
      // Note: undefined persisted means it IS persisted (legacy/default), only === false means not persisted
      if (conversationWithUserMsg.persisted === false) {
        // First message in new conversation -> Persist everything
        // destruct persisted to exclude it from persisted object (optional, but good for clean DB)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { persisted, isTemporary, ...conversationData } =
          conversationWithUserMsg;

        if (!isTemporary) {
          const persistedConversation = {
            ...conversationData,
            title: titleUpdate || conversation.title,
          };

          await conversationsDb.save(persistedConversation);

          // Update local state to mark as persisted
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === activeConversationId ? { ...c, persisted: true } : c,
            ),
          }));
        }
      } else if (!conversationWithUserMsg.isTemporary) {
        await conversationsDb.update(activeConversationId, {
          messages: conversationWithUserMsg.messages,
          title: titleUpdate || conversation.title,
          updatedAt: conversationWithUserMsg.updatedAt,
        });
      }
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
      if (
        finalConversation &&
        finalConversation.persisted !== false &&
        !finalConversation.isTemporary
      ) {
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

  renameConversation: async (id: string, title: string) => {
    try {
      const conversation = get().conversations.find((c) => c.id === id);
      if (
        conversation &&
        conversation.persisted !== false &&
        !conversation.isTemporary
      ) {
        await conversationsDb.update(id, { title, updatedAt: Date.now() });
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
      const newConversation: Omit<Conversation, "id"> = {
        ...conversation,
        title: `${conversation.title} (Copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const newId = await conversationsDb.create(newConversation);
      const createdConversation = { ...newConversation, id: newId };

      set((state) => ({
        conversations: [createdConversation, ...state.conversations],
        activeConversationId: newId,
      }));

      return newId;
    } catch (error) {
      console.error("Failed to duplicate conversation:", error);
      set({ error: "Failed to duplicate conversation" });
      throw error;
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
      if (conversation.persisted !== false && !conversation.isTemporary) {
        await conversationsDb.update(conversationId, {
          messages: updatedMessages,
        });
      }

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

  setParameters: async (
    params: Partial<ModelParameters>,
    mode: "merge" | "replace" = "merge",
  ) => {
    const { activeConversationId, conversations } = get();
    if (!activeConversationId) return;

    const conversation = conversations.find(
      (c) => c.id === activeConversationId,
    );
    if (!conversation) return;

    const updatedParameters =
      mode === "replace"
        ? (params as ModelParameters)
        : { ...conversation.parameters, ...params };

    const updatedConversation = {
      ...conversation,
      parameters: updatedParameters,
      updatedAt: Date.now(),
    };

    try {
      if (conversation.persisted !== false && !conversation.isTemporary) {
        await conversationsDb.update(activeConversationId, {
          parameters: updatedParameters,
          updatedAt: updatedConversation.updatedAt,
        });
      }

      set((state) => ({
        conversations: state.conversations
          .map((c) => (c.id === activeConversationId ? updatedConversation : c))
          .sort((a, b) => b.updatedAt - a.updatedAt),
      }));
    } catch (error) {
      console.error("Failed to update parameters:", error);
      set({ error: "Failed to update parameters" });
    }
  },
}));

// Helper to remove empty ephemeral conversations
function cleanupEmptyDrafts(
  conversations: Conversation[],
  activeId: string | null,
): Conversation[] {
  if (!activeId) return conversations;

  const activeConv = conversations.find((c) => c.id === activeId);
  if (
    activeConv &&
    activeConv.persisted === false &&
    activeConv.messages.length === 0
  ) {
    return conversations.filter((c) => c.id !== activeId);
  }
  return conversations;
}
