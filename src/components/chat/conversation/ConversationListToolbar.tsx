import { CheckSquare, ChevronDown, Plus, Zap } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";

import { SearchInput } from "./SearchInput";
import { SelectableListModeBar } from "./SelectableListModeBar";

interface ConversationListToolbarProps {
  isSelectionMode: boolean;
  selectedCount: number;
  isAllFilteredSelected: boolean;
  menuWidth?: number;
  buttonGroupRef: (node: HTMLDivElement | null) => void;
  onCreateConversation: (options?: { isTemporary?: boolean }) => Promise<void>;
  onToggleSelectionMode: () => void;
  onBulkDelete: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function ConversationListToolbar({
  isSelectionMode,
  selectedCount,
  isAllFilteredSelected,
  menuWidth,
  buttonGroupRef,
  onCreateConversation,
  onToggleSelectionMode,
  onBulkDelete,
  onSelectAll,
  onDeselectAll,
}: ConversationListToolbarProps) {
  return (
    <div className="space-y-3 border-b p-4">
      <div className="flex min-h-9 items-center gap-2">
        {!isSelectionMode ? (
          <>
            <div className="flex w-full items-center" ref={buttonGroupRef}>
              <Button
                onClick={() => void onCreateConversation()}
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
                    onClick={() =>
                      void onCreateConversation({ isTemporary: true })
                    }
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Temporary Chat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button
              onClick={onToggleSelectionMode}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Select conversations"
            >
              <CheckSquare className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <SelectableListModeBar
            selectedCount={selectedCount}
            allFilteredSelected={isAllFilteredSelected}
            onCancelSelection={onToggleSelectionMode}
            onBulkDelete={onBulkDelete}
            onSelectAll={onSelectAll}
            onDeselectAll={onDeselectAll}
          />
        )}
      </div>

      <SearchInput />
    </div>
  );
}
