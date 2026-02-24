import type { StateCreator } from "zustand";

import type { ConversationSearchState, ConversationState } from "./types";

export const createSearchSlice: StateCreator<
  ConversationState,
  [],
  [],
  ConversationSearchState
> = (set) => ({
  searchQuery: "",
  isSearching: false,

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setIsSearching: (isSearching: boolean) => {
    set({ isSearching });
  },
});
