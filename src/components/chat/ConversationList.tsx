import { Loader2, Plus, Search, X } from "lucide-react";
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

  const [conversationToDelete, setConversationToDelete] = useState<
    string | null
  >(null);

  const { settings } = useSettingsStore();

  const handleCreate = async () => {
    const defaultModel = settings?.defaultModel || "gemini-2.5-flash-lite";
    const params = getModelDefaultParameters(defaultModel);
    await createConversation(defaultModel, params);
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

  const confirmDelete = async () => {
    if (conversationToDelete) {
      await deleteConversation(conversationToDelete);
      setConversationToDelete(null);
    }
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) =>
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [conversations, searchQuery]);

  return (
    <div className={cn("bg-sidebar flex h-full flex-col", className)}>
      <div className="space-y-3 border-b p-4">
        <Button
          onClick={handleCreate}
          className="h-9 w-full justify-start gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>
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
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription className="text-left">
              Are you sure you want to delete this conversation? This action
              cannot be undone.
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
