import {
  CheckSquare,
  ChevronDown,
  Loader2,
  Plus,
  Search,
  Square,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ConversationItem } from "@/components/chat";
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
  Input,
  ScrollArea,
} from "@/components/ui";
import { useDebounce } from "@/hooks";
import { getModelDefaultParameters } from "@/lib/models";
import { cn } from "@/lib/utils";
import { useConversationStore, useSettingsStore } from "@/stores";

interface ConversationListProps {
  className?: string;
  onSelect?: () => void; // Optional callback for mobile to close the sheet
}

function SearchInput() {
  const searchQuery = useConversationStore((state) => state.searchQuery);
  const setSearchQuery = useConversationStore((state) => state.setSearchQuery);
  const isSearching = useConversationStore((state) => state.isSearching);
  const setIsSearching = useConversationStore((state) => state.setIsSearching);

  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Update isSearching immediately when local input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchQuery(value);
    if (value !== searchQuery) {
      setIsSearching(true);
    }
  };

  const debouncedSearchQuery = useDebounce(localSearchQuery, 300);

  useEffect(() => {
    setSearchQuery(debouncedSearchQuery);
    setIsSearching(false);
  }, [debouncedSearchQuery, setSearchQuery, setIsSearching]);

  // Sync local search query if store changes (e.g. from clear button or external reset)
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  return (
    <div className="relative">
      <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
      <Input
        placeholder="Search conversations..."
        value={localSearchQuery}
        onChange={handleInputChange}
        className="h-8 pr-8 pl-8 text-xs focus-visible:ring-1"
      />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
        {isSearching && (
          <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
        )}
        {searchQuery && !isSearching && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-transparent"
            onClick={() => setSearchQuery("")}
          >
            <X className="text-muted-foreground h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function ConversationList({
  className,
  onSelect,
}: ConversationListProps) {
  const conversations = useConversationStore((state) => state.conversations);
  const activeConversationId = useConversationStore(
    (state) => state.activeConversationId,
  );
  const setActiveConversation = useConversationStore(
    (state) => state.setActiveConversation,
  );
  const createConversation = useConversationStore(
    (state) => state.createConversation,
  );
  const deleteConversation = useConversationStore(
    (state) => state.deleteConversation,
  );
  const isLoading = useConversationStore((state) => state.isLoading);
  const searchQuery = useConversationStore((state) => state.searchQuery);
  const isSearching = useConversationStore((state) => state.isSearching);

  // Selection state
  const isSelectionMode = useConversationStore(
    (state) => state.isSelectionMode,
  );
  const selectedIds = useConversationStore((state) => state.selectedIds);
  const toggleSelectionMode = useConversationStore(
    (state) => state.toggleSelectionMode,
  );
  const toggleSelection = useConversationStore(
    (state) => state.toggleSelection,
  );
  const selectAll = useConversationStore((state) => state.selectAll);
  const deselectAll = useConversationStore((state) => state.deselectAll);
  const deleteSelectedConversations = useConversationStore(
    (state) => state.deleteSelectedConversations,
  );

  const [conversationToDelete, setConversationToDelete] = useState<
    string | null
  >(null);

  const { settings } = useSettingsStore();

  /* Removed unused activeConversation */

  const [menuWidth, setMenuWidth] = useState<number | undefined>(undefined);
  const buttonGroupRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setMenuWidth(node.getBoundingClientRect().width);
    }
  }, []);

  const handleCreate = async (options: { isTemporary?: boolean } = {}) => {
    // Force create new conversation even if current one is empty/ephemeral
    // The store's createConversation handles cleaning up empty/ephemeral ones if needed
    // or we can explicitly force it here if store prevents it.
    // Based on store logic viewed earlier, it removes current ephemeral if exists.

    const defaultModel = settings?.defaultModel || "gemini-2.5-flash-lite";
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
              <div
                className="flex w-full items-center gap-px"
                ref={buttonGroupRef}
              >
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
                      className="h-9 w-9 rounded-l-none px-0"
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
