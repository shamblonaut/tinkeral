import { useCallback, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useSettingsStore } from "@/features/settings";
import {
  DEFAULT_MODEL_ID,
  getModelDefaultParameters,
} from "@/shared/lib/models";

import { useConversationStore } from "../store";

interface UseConversationListStateOptions {
  onSelect?: () => void;
}

export function useConversationListState({
  onSelect,
}: UseConversationListStateOptions) {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    createConversation,
    deleteConversation,
    isLoading,
    searchQuery,
    isSearching,
    isSelectionMode,
    selectedIds,
    toggleSelectionMode,
    toggleSelection,
    selectAll,
    deselectAll,
    deleteSelectedConversations,
  } = useConversationStore(
    useShallow((state) => ({
      conversations: state.conversations,
      activeConversationId: state.activeConversationId,
      setActiveConversation: state.setActiveConversation,
      createConversation: state.createConversation,
      deleteConversation: state.deleteConversation,
      isLoading: state.isLoading,
      searchQuery: state.searchQuery,
      isSearching: state.isSearching,
      isSelectionMode: state.isSelectionMode,
      selectedIds: state.selectedIds,
      toggleSelectionMode: state.toggleSelectionMode,
      toggleSelection: state.toggleSelection,
      selectAll: state.selectAll,
      deselectAll: state.deselectAll,
      deleteSelectedConversations: state.deleteSelectedConversations,
    })),
  );

  const { settings } = useSettingsStore();

  const [conversationToDelete, setConversationToDelete] = useState<
    string | null
  >(null);
  const [menuWidth, setMenuWidth] = useState<number | undefined>(undefined);

  const buttonGroupRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setMenuWidth(node.getBoundingClientRect().width);
    }
  }, []);

  const handleCreate = useCallback(
    async (options: { isTemporary?: boolean } = {}) => {
      const defaultModel = settings?.defaultModel || DEFAULT_MODEL_ID;
      const params = getModelDefaultParameters(defaultModel);
      await createConversation(defaultModel, params, undefined, options);
      onSelect?.();
    },
    [createConversation, onSelect, settings?.defaultModel],
  );

  const handleSelect = useCallback(
    (id: string) => {
      setActiveConversation(id);
      onSelect?.();
    },
    [onSelect, setActiveConversation],
  );

  const handleDelete = useCallback((id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setConversationToDelete(id);
  }, []);

  const handleToggleSelection = useCallback(
    (id: string) => {
      toggleSelection(id);
    },
    [toggleSelection],
  );

  const confirmDelete = useCallback(async () => {
    if (!conversationToDelete) {
      return;
    }

    if (conversationToDelete === "bulk") {
      await deleteSelectedConversations();
    } else {
      await deleteConversation(conversationToDelete);
    }

    setConversationToDelete(null);
  }, [conversationToDelete, deleteConversation, deleteSelectedConversations]);

  const filteredConversations = useMemo(() => {
    return conversations
      .filter((conversation) => conversation.persisted !== false)
      .filter((conversation) =>
        conversation.title.toLowerCase().includes(searchQuery.toLowerCase()),
      );
  }, [conversations, searchQuery]);

  const isAllFilteredSelected =
    selectedIds.length === filteredConversations.length &&
    filteredConversations.length > 0;

  return {
    activeConversationId,
    conversationToDelete,
    filteredConversations,
    isAllFilteredSelected,
    isLoading,
    isSearching,
    isSelectionMode,
    menuWidth,
    searchQuery,
    selectedIds,
    buttonGroupRef,
    confirmDelete,
    deselectAll,
    handleCreate,
    handleDelete,
    handleSelect,
    handleToggleSelection,
    selectAll,
    setConversationToDelete,
    toggleSelectionMode,
  };
}
