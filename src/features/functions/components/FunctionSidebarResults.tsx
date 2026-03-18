import {
  CheckSquare,
  Code2,
  Copy,
  Edit2,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CompactMetadataCard,
  CompactMetadataCardItem,
  ExpandableSelectableItemCard,
  ItemActionsRow,
} from "@/features/chat";
import {
  Button,
  Input,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui";
import { cn, formatRelativeTime, formatSmartDate } from "@/shared/lib/utils";

import type { FunctionDefinition } from "../types";

interface FunctionSidebarResultsProps {
  filteredFunctions: FunctionDefinition[];
  isLoading: boolean;
  isSearching: boolean;
  searchQuery: string;
  selectedFunctionId: string | null;
  isSelectionMode: boolean;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onRename: (id: string, nextName: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  onShowImportExamples: () => void;
}

interface FunctionListItemProps {
  fn: FunctionDefinition;
  isActive: boolean;
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onRename: (id: string, nextName: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
}

function FunctionListItem({
  fn,
  isActive,
  isSelectionMode,
  isSelected,
  onSelect,
  onToggleSelection,
  onDelete,
  onRename,
  onDuplicate,
}: FunctionListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(fn.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const parameterCount = Object.keys(fn.parameters.properties).length;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRename = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(fn.name);
      setIsEditing(false);
      return;
    }

    if (trimmed !== fn.name) {
      await onRename(fn.id, trimmed);
    }

    setIsEditing(false);
  }, [fn.id, fn.name, name, onRename]);

  const handleStartEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setName(fn.name);
    setIsEditing(true);
    setIsExpanded(true);
  };

  return (
    <ExpandableSelectableItemCard
      onClick={() => {
        if (isSelectionMode) {
          onToggleSelection(fn.id);
        } else if (!isEditing) {
          onSelect(fn.id);
        }
      }}
      onKeyDown={(e) => {
        if (isEditing) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (isSelectionMode) {
            onToggleSelection(fn.id);
          } else {
            onSelect(fn.id);
          }
        }
      }}
      onDoubleClick={() => {
        if (!isSelectionMode && !isEditing) {
          onSelect(fn.id);
        }
      }}
      role="button"
      tabIndex={0}
      ariaPressed={isSelectionMode ? isSelected : isActive}
      ariaLabel={
        isSelectionMode
          ? `${isSelected ? "Deselect" : "Select"} function ${fn.name}`
          : `Open function ${fn.name}`
      }
      isActive={isActive}
      isExpanded={isExpanded}
      onToggleExpanded={() => setIsExpanded((prev) => !prev)}
      expandButtonAriaExpanded={isExpanded}
      leadingContent={
        isSelectionMode ? (
          isSelected ? (
            <CheckSquare className="text-primary h-4 w-4 shrink-0" />
          ) : (
            <Square className="text-muted-foreground h-4 w-4 shrink-0" />
          )
        ) : (
          <Code2 className="h-4 w-4 shrink-0" />
        )
      }
      titleContent={
        isEditing ? (
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void handleRename()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleRename();
              }
              if (e.key === "Escape") {
                setName(fn.name);
                setIsEditing(false);
              }
            }}
            className="bg-background h-6 px-1 py-0 text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate text-sm font-medium">{fn.name}</span>
        )
      }
      metadataContent={
        <>
          <span className="truncate opacity-70">
            {parameterCount} parameter{parameterCount === 1 ? "" : "s"}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0 cursor-help opacity-50">
                {formatRelativeTime(fn.updatedAt)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Created: {new Date(fn.createdAt).toLocaleString()}</p>
              <p>Updated: {new Date(fn.updatedAt).toLocaleString()}</p>
            </TooltipContent>
          </Tooltip>
        </>
      }
      detailsContent={
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 pt-1">
            <ItemActionsRow
              actions={[
                {
                  id: "rename",
                  label: "Rename",
                  icon: <Edit2 className="h-3 w-3" />,
                  onClick: handleStartEditing,
                },
                {
                  id: "duplicate",
                  label: "Duplicate",
                  icon: <Copy className="h-3 w-3" />,
                  onClick: (event) => {
                    event.stopPropagation();
                    void onDuplicate(fn.id);
                  },
                },
                {
                  id: "delete",
                  label: "Delete",
                  icon: <Trash2 className="h-3 w-3" />,
                  destructive: true,
                  onClick: (event) => {
                    event.stopPropagation();
                    onDelete(fn.id, event);
                  },
                },
              ]}
            />

            <CompactMetadataCard>
              <CompactMetadataCardItem
                label="Description"
                value={fn.description || "No description"}
                className="col-span-2 flex flex-col gap-0.5"
                valueClassName={cn(
                  "truncate font-medium",
                  !fn.description && "italic opacity-60",
                )}
              />
              <CompactMetadataCardItem label="Params" value={parameterCount} />
              <CompactMetadataCardItem
                label="Timeout"
                value={`${fn.timeout ?? 5000} ms`}
              />
              <CompactMetadataCardItem
                label="Created"
                value={formatSmartDate(fn.createdAt)}
              />
              <CompactMetadataCardItem
                label="Updated"
                value={formatSmartDate(fn.updatedAt)}
              />
            </CompactMetadataCard>
          </div>
        </div>
      }
    />
  );
}

export function FunctionSidebarResults({
  filteredFunctions,
  isLoading,
  isSearching,
  searchQuery,
  selectedFunctionId,
  isSelectionMode,
  selectedIds,
  onSelect,
  onToggleSelection,
  onDelete,
  onRename,
  onDuplicate,
  onShowImportExamples,
}: FunctionSidebarResultsProps) {
  return (
    <ScrollArea className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-1 p-2">
        {filteredFunctions.length === 0 && !isLoading && !isSearching && (
          <div className="text-muted-foreground p-2 text-center text-sm">
            {searchQuery
              ? `No matching results for "${searchQuery}"`
              : "No functions yet."}
          </div>
        )}

        {!isSearching &&
          filteredFunctions.map((fn) => (
            <FunctionListItem
              key={fn.id}
              fn={fn}
              isActive={selectedFunctionId === fn.id}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds.includes(fn.id)}
              onSelect={onSelect}
              onToggleSelection={onToggleSelection}
              onDelete={onDelete}
              onRename={onRename}
              onDuplicate={onDuplicate}
            />
          ))}

        {!isSearching && !searchQuery && (
          <div className="mt-4 px-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 border-dashed text-xs font-normal"
              onClick={onShowImportExamples}
            >
              <Sparkles className="h-3 w-3" />
              Import Example Functions
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
