import type { StateCreator } from "zustand";

import { PersistenceService } from "@/services/persistence";

import type { ConversationSelectionState, ConversationState } from "./types";

export const createSelectionSlice: StateCreator<
  ConversationState,
  [],
  [],
  ConversationSelectionState
> = (set, get) => ({
  isSelectionMode: false,
  selectedIds: [],

  toggleSelectionMode: () => {
    set((state) => ({
      isSelectionMode: !state.isSelectionMode,
      selectedIds: [],
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
      const persistedIds = currentConversations
        .filter((c) => selectedIds.includes(c.id) && c.persisted !== false)
        .map((c) => c.id);

      await Promise.all(
        persistedIds.map((id) =>
          PersistenceService.deleteConversation(id, true),
        ),
      );

      set((state) => {
        const newConversations = state.conversations.filter(
          (c) => !selectedIds.includes(c.id),
        );

        const newActiveId = selectedIds.includes(
          state.activeConversationId || "",
        )
          ? null
          : state.activeConversationId;

        return {
          conversations: newConversations,
          activeConversationId: newActiveId,
          selectedIds: [],
          isSelectionMode: false,
        };
      });
    } catch (error) {
      console.error("Failed to delete selected conversations:", error);
      set({ error: "Failed to delete selected conversations" });
    }
  },
});
