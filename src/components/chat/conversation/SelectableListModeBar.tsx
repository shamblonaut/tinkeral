import { CheckSquare, Square, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui";

interface SelectableListModeBarProps {
  selectedCount: number;
  allFilteredSelected: boolean;
  onCancelSelection: () => void;
  onBulkDelete: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  cancelSelectionTitle?: string;
  cancelSelectionAriaLabel?: string;
  deleteSelectedTitle?: string;
  deleteSelectedAriaLabel?: string;
  selectAllTitle?: string;
  deselectAllTitle?: string;
  selectAllAriaLabel?: string;
  deselectAllAriaLabel?: string;
}

export function SelectableListModeBar({
  selectedCount,
  allFilteredSelected,
  onCancelSelection,
  onBulkDelete,
  onSelectAll,
  onDeselectAll,
  cancelSelectionTitle = "Cancel selection",
  cancelSelectionAriaLabel,
  deleteSelectedTitle = "Delete selected",
  deleteSelectedAriaLabel,
  selectAllTitle = "Select All",
  deselectAllTitle = "Deselect All",
  selectAllAriaLabel,
  deselectAllAriaLabel,
}: SelectableListModeBarProps) {
  return (
    <div className="animate-in fade-in slide-in-from-top-1 flex w-full items-center justify-between gap-2 duration-200">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onCancelSelection}
          title={cancelSelectionTitle}
          aria-label={cancelSelectionAriaLabel}
        >
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{selectedCount} selected</span>
      </div>

      <div className="flex items-center gap-1">
        {selectedCount > 0 && (
          <Button
            variant="destructive"
            size="icon"
            className="h-8 w-8"
            onClick={onBulkDelete}
            title={deleteSelectedTitle}
            aria-label={deleteSelectedAriaLabel}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground h-8 w-8"
          onClick={allFilteredSelected ? onDeselectAll : onSelectAll}
          title={allFilteredSelected ? deselectAllTitle : selectAllTitle}
          aria-label={
            allFilteredSelected ? deselectAllAriaLabel : selectAllAriaLabel
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
  );
}
