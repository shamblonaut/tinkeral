import { CheckSquare, Plus } from "lucide-react";

import { SelectableListModeBar } from "@/components/chat/conversation/SelectableListModeBar";
import { Button, SearchField } from "@/components/ui";

interface FunctionSidebarToolbarProps {
  isSelectionMode: boolean;
  selectedCount: number;
  allFilteredSelected: boolean;
  filteredIds: string[];
  searchInput: string;
  isSearching: boolean;
  onCreate: () => void;
  onToggleSelectionMode: () => void;
  onBulkDelete: () => void;
  onSelectAllFiltered: (ids: string[]) => void;
  onClearSelection: () => void;
  onSearchInputChange: (value: string) => void;
  onClearSearch: () => void;
}

export function FunctionSidebarToolbar({
  isSelectionMode,
  selectedCount,
  allFilteredSelected,
  filteredIds,
  searchInput,
  isSearching,
  onCreate,
  onToggleSelectionMode,
  onBulkDelete,
  onSelectAllFiltered,
  onClearSelection,
  onSearchInputChange,
  onClearSearch,
}: FunctionSidebarToolbarProps) {
  return (
    <div className="space-y-3 border-b p-4">
      <div className="flex min-h-9 items-center gap-2">
        {!isSelectionMode ? (
          <>
            <Button
              onClick={onCreate}
              className="h-9 flex-1 justify-start gap-2"
              variant="outline"
              aria-label="Create new function"
            >
              <Plus className="h-4 w-4" />
              New Function
            </Button>

            <Button
              onClick={onToggleSelectionMode}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Select functions"
              aria-label="Select functions"
            >
              <CheckSquare className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <SelectableListModeBar
            selectedCount={selectedCount}
            allFilteredSelected={allFilteredSelected}
            onCancelSelection={onToggleSelectionMode}
            onBulkDelete={onBulkDelete}
            onSelectAll={() => onSelectAllFiltered(filteredIds)}
            onDeselectAll={onClearSelection}
            cancelSelectionAriaLabel="Cancel selection"
            deleteSelectedAriaLabel="Delete selected functions"
            selectAllAriaLabel="Select all filtered functions"
            deselectAllAriaLabel="Deselect all filtered functions"
          />
        )}
      </div>

      <SearchField
        placeholder="Search functions..."
        value={searchInput}
        isSearching={isSearching}
        onChange={onSearchInputChange}
        onClear={onClearSearch}
        ariaLabel="Search functions"
        clearAriaLabel="Clear function search"
      />
    </div>
  );
}
