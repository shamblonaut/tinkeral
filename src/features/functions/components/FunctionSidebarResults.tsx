import {
  CheckSquare,
  Code2,
  Copy,
  Edit2,
  MoreVertical,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Button,
  Input,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { cn, formatRelativeTime, formatSmartDate } from "@/lib/utils";
import type { FunctionDefinition } from "@/types";

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
    <div
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
      aria-pressed={isSelectionMode ? isSelected : isActive}
      aria-label={
        isSelectionMode
          ? `${isSelected ? "Deselect" : "Select"} function ${fn.name}`
          : `Open function ${fn.name}`
      }
      className={cn(
        "group relative flex cursor-pointer flex-col gap-1 rounded-lg p-3 transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
        isExpanded && "bg-muted/30 hover:bg-muted/40",
      )}
    >
      <div className="flex items-center gap-2 pr-8">
        {isSelectionMode ? (
          isSelected ? (
            <CheckSquare className="text-primary h-4 w-4 shrink-0" />
          ) : (
            <Square className="text-muted-foreground h-4 w-4 shrink-0" />
          )
        ) : (
          <Code2 className="h-4 w-4 shrink-0" />
        )}

        {isEditing ? (
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
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pl-6 text-[11px]">
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
      </div>

      <div className="absolute top-2 right-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 transition-all",
            isActive ? "hover:bg-accent-foreground/10" : "hover:bg-accent",
            isExpanded && "bg-accent rotate-90",
          )}
          aria-expanded={isExpanded}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded((prev) => !prev);
          }}
        >
          <MoreVertical className="h-3.5 w-3.5" />
          <span className="sr-only">Toggle details</span>
        </Button>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity,margin] duration-200 ease-in-out",
          isExpanded
            ? "mt-2 grid-rows-[1fr] opacity-100"
            : "mt-0 grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 pt-1">
            <div className="grid grid-cols-3 gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-0 text-[11px] font-normal"
                onClick={handleStartEditing}
              >
                <Edit2 className="h-3 w-3" />
                Rename
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-0 text-[11px] font-normal"
                onClick={(e) => {
                  e.stopPropagation();
                  void onDuplicate(fn.id);
                }}
              >
                <Copy className="h-3 w-3" />
                Duplicate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 gap-1.5 px-0 text-[11px] font-normal"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(fn.id, e);
                }}
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            </div>

            <div className="bg-muted/50 text-accent-foreground/70 rounded-md border p-2 text-[10px] leading-tight">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                <div className="col-span-2 flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold tracking-wider uppercase opacity-40">
                    Description
                  </span>
                  <span
                    className={cn(
                      "truncate font-medium",
                      !fn.description && "italic opacity-60",
                    )}
                  >
                    {fn.description || "No description"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold tracking-wider uppercase opacity-40">
                    Params
                  </span>
                  <span className="font-medium">{parameterCount}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold tracking-wider uppercase opacity-40">
                    Timeout
                  </span>
                  <span className="font-medium">{fn.timeout ?? 5000} ms</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold tracking-wider uppercase opacity-40">
                    Created
                  </span>
                  <span className="font-medium">
                    {formatSmartDate(fn.createdAt)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold tracking-wider uppercase opacity-40">
                    Updated
                  </span>
                  <span className="font-medium">
                    {formatSmartDate(fn.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
