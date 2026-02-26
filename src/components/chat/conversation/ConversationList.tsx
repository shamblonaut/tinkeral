import {
  CheckSquare,
  ChevronDown,
  Plus,
  Square,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { ConversationItem, SearchInput } from "@/components/chat";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ScrollArea,
} from "@/components/ui";
import { DEFAULT_MODEL_ID, getModelDefaultParameters } from "@/lib/models";
import { cn } from "@/lib/utils";
import { useConversationStore, useSettingsStore } from "@/stores";

interface ConversationListProps {
  className?: string;
  onSelect?: () => void; // Optional callback for mobile to close the sheet
}

export function ConversationList({
  className,
  onSelect,
}: ConversationListProps) {
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

  const [conversationToDelete, setConversationToDelete] = useState<
    string | null
  >(null);

  const { settings } = useSettingsStore();

  const [menuWidth, setMenuWidth] = useState<number | undefined>(undefined);
  const buttonGroupRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setMenuWidth(node.getBoundingClientRect().width);
    }
  }, []);

  const handleCreate = async (options: { isTemporary?: boolean } = {}) => {
    const defaultModel = settings?.defaultModel || DEFAULT_MODEL_ID;
    const params = getModelDefaultParameters(defaultModel);
    await createConversation(defaultModel, params, undefined, options);
    onSelect?.();
  };

  const handleSelect = useCallback(
    (id: string) => {
      setActiveConversation(id);
      onSelect?.();
    },
    [setActiveConversation, onSelect],
  );

  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversationToDelete(id);
  }, []);

  // Stable callback for toggling selection
  const handleToggleSelection = useCallback(
    (id: string) => {
      toggleSelection(id);
    },
    [toggleSelection],
  );

  const confirmDelete = async () => {
    if (conversationToDelete) {
      if (conversationToDelete === "bulk") {
        await deleteSelectedConversations();
      } else {
        await deleteConversation(conversationToDelete);
      }
      setConversationToDelete(null);
    }
  };

  const filteredConversations = useMemo(() => {
    return conversations
      .filter((conv) => conv.persisted !== false)
      .filter((conv) =>
        conv.title.toLowerCase().includes(searchQuery.toLowerCase()),
      );
  }, [conversations, searchQuery]);

  return (
    <div className={cn("bg-sidebar flex h-full flex-col", className)}>
      <div className="space-y-3 border-b p-4">
        <div className="flex min-h-9 items-center gap-2">
          {!isSelectionMode ? (
            <>
              <div className="flex w-full items-center" ref={buttonGroupRef}>
                <Button
                  onClick={() => handleCreate()}
                  className="h-9 flex-1 justify-start gap-2 rounded-r-none pr-2"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                  New Conversation
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-9 w-9 rounded-l-none border-l-0 px-0"
                    >
                      <ChevronDown className="h-4 w-4" />
                      <span className="sr-only">More options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" style={{ width: menuWidth }}>
                    <DropdownMenuItem
                      onClick={() => handleCreate({ isTemporary: true })}
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      Temporary Chat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Button
                onClick={toggleSelectionMode}
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Select conversations"
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-1 flex w-full items-center justify-between gap-2 duration-200">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggleSelectionMode}
                  title="Cancel selection"
                >
                  <X className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  {selectedIds.length} selected
                </span>
              </div>

              <div className="flex items-center gap-1">
                {selectedIds.length > 0 && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setConversationToDelete("bulk")}
                    title="Delete selected"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground h-8 w-8"
                  onClick={
                    selectedIds.length === filteredConversations.length &&
                    filteredConversations.length > 0
                      ? deselectAll
                      : selectAll
                  }
                  title={
                    selectedIds.length === filteredConversations.length &&
                    filteredConversations.length > 0
                      ? "Deselect All"
                      : "Select All"
                  }
                >
                  {selectedIds.length === filteredConversations.length &&
                  filteredConversations.length > 0 ? (
                    <CheckSquare className="text-primary h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <SearchInput />
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1 p-2">
          {filteredConversations.length === 0 && !isLoading && !isSearching && (
            <div className="text-muted-foreground p-2 text-center text-sm">
              {searchQuery
                ? `No matching results for "${searchQuery}"`
                : "No conversations yet."}
            </div>
          )}

          {!isSearching &&
            filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={activeConversationId === conv.id}
                onSelect={handleSelect}
                onDelete={handleDelete}
                isSelectionMode={isSelectionMode}
                isSelected={selectedIds.includes(conv.id)}
                onToggleSelection={handleToggleSelection}
              />
            ))}
        </div>
      </ScrollArea>
      <Dialog
        open={conversationToDelete !== null}
        onOpenChange={(open: boolean) => !open && setConversationToDelete(null)}
      >
        <DialogContent className="max-w-[75vw]">
          <DialogHeader>
            <DialogTitle>
              {conversationToDelete === "bulk"
                ? `Delete ${selectedIds.length} Conversations`
                : "Delete Conversation"}
            </DialogTitle>
            <DialogDescription className="text-left">
              {conversationToDelete === "bulk"
                ? `Are you sure you want to delete ${selectedIds.length} selected conversations? This action cannot be undone.`
                : "Are you sure you want to delete this conversation? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConversationToDelete(null)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
