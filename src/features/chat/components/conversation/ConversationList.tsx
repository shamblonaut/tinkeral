import { ScrollArea } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

import {
  ConversationDeleteDialog,
  ConversationItem,
  ConversationListToolbar,
} from "..";
import { useConversationListState } from "../../hooks";

interface ConversationListProps {
  className?: string;
  onSelect?: () => void; // Optional callback for mobile to close the sheet
}

export function ConversationList({
  className,
  onSelect,
}: ConversationListProps) {
  const {
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
  } = useConversationListState({ onSelect });

  return (
    <div className={cn("bg-sidebar flex h-full flex-col", className)}>
      <ConversationListToolbar
        isSelectionMode={isSelectionMode}
        selectedCount={selectedIds.length}
        isAllFilteredSelected={isAllFilteredSelected}
        menuWidth={menuWidth}
        buttonGroupRef={buttonGroupRef}
        onCreateConversation={handleCreate}
        onToggleSelectionMode={toggleSelectionMode}
        onBulkDelete={() => setConversationToDelete("bulk")}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
      />

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
      <ConversationDeleteDialog
        open={conversationToDelete !== null}
        conversationToDelete={conversationToDelete}
        selectedCount={selectedIds.length}
        onOpenChange={(open) => !open && setConversationToDelete(null)}
        onConfirmDelete={confirmDelete}
      />
    </div>
  );
}
