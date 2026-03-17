import {
  CheckSquare,
  Loader2,
  Plus,
  Search,
  Square,
  Trash2,
  X,
} from "lucide-react";

import { Button, Input } from "@/components/ui";

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
          <div className="animate-in fade-in slide-in-from-top-1 flex w-full items-center justify-between gap-2 duration-200">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onToggleSelectionMode}
                title="Cancel selection"
                aria-label="Cancel selection"
              >
                <X className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">
                {selectedCount} selected
              </span>
            </div>

            <div className="flex items-center gap-1">
              {selectedCount > 0 && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onBulkDelete}
                  title="Delete selected"
                  aria-label="Delete selected functions"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground h-8 w-8"
                onClick={() => {
                  if (allFilteredSelected) {
                    onClearSelection();
                    return;
                  }
                  onSelectAllFiltered(filteredIds);
                }}
                title={allFilteredSelected ? "Deselect All" : "Select All"}
                aria-label={
                  allFilteredSelected
                    ? "Deselect all filtered functions"
                    : "Select all filtered functions"
                }
              >
                {allFilteredSelected ? (
                  <CheckSquare className="text-primary h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
        <Input
          type="search"
          placeholder="Search functions..."
          value={searchInput}
          onChange={(event) => {
            onSearchInputChange(event.target.value);
          }}
          aria-label="Search functions"
          className="h-8 pr-8 pl-8 text-xs focus-visible:ring-1"
        />
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
          {isSearching && (
            <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
          )}
          {searchInput && !isSearching && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-transparent"
              onClick={onClearSearch}
              aria-label="Clear function search"
            >
              <X className="text-muted-foreground h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
