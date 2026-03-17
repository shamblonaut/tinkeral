import {
  CheckSquare,
  Code2,
  Copy,
  Edit2,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { useDebounce } from "@/hooks";
import { cn, formatRelativeTime, formatSmartDate } from "@/lib/utils";
import { useFunctionsStore } from "@/stores/functions";
import { useUIStore } from "@/stores/ui";
import type { FunctionDefinition } from "@/types";
import { ExampleFunctionsDialog } from "./ExampleFunctionsDialog";

interface FunctionSidebarListProps {
  className?: string;
  onSelect?: () => void;
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

export function FunctionSidebarList({
  className,
  onSelect,
}: FunctionSidebarListProps) {
  const {
    functions,
    isLoading,
    loadFunctions,
    createFunction,
    updateFunction,
    deleteFunction,
  } = useFunctionsStore();

  const { selectedFunctionId, selectFunction } = useUIStore();

  const [searchInput, setSearchInput] = useState("");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [functionToDelete, setFunctionToDelete] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const debouncedSearchQuery = useDebounce(searchInput, 300);
  const searchQuery = debouncedSearchQuery;
  const isSearching = searchInput !== debouncedSearchQuery;

  useEffect(() => {
    void loadFunctions();
  }, [loadFunctions]);

  const filteredFunctions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return functions;
    }

    return functions.filter((fn) => {
      return (
        fn.name.toLowerCase().includes(query) ||
        fn.description.toLowerCase().includes(query)
      );
    });
  }, [functions, searchQuery]);

  const handleCreate = useCallback(() => {
    selectFunction(null);
    onSelect?.();
  }, [onSelect, selectFunction]);

  const handleSelect = useCallback(
    (id: string) => {
      selectFunction(id);
      if (!isSelectionMode) {
        onSelect?.();
      }
    },
    [isSelectionMode, onSelect, selectFunction],
  );

  const handleRename = useCallback(
    async (id: string, nextName: string) => {
      try {
        await updateFunction(id, { name: nextName });
        toast.success("Function renamed.");
      } catch {
        toast.error("Failed to rename function.");
      }
    },
    [updateFunction],
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      const source = functions.find((fn) => fn.id === id);
      if (!source) return;

      const nextNameBase = `${source.name} Copy`;
      let nextName = nextNameBase;
      let copyIndex = 2;

      while (functions.some((fn) => fn.name === nextName)) {
        nextName = `${nextNameBase} ${copyIndex}`;
        copyIndex += 1;
      }

      try {
        await createFunction({
          name: nextName,
          description: source.description,
          parameters: source.parameters,
          implementation: source.implementation,
          timeout: source.timeout,
          allowedAPIs: source.allowedAPIs,
        });
        toast.success("Function duplicated.");
      } catch {
        toast.error("Failed to duplicate function.");
      }
    },
    [createFunction, functions],
  );

  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFunctionToDelete(id);
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => !prev);
    setSelectedIds([]);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!functionToDelete) {
      return;
    }

    if (functionToDelete === "bulk") {
      const deleting = selectedIds;
      try {
        await Promise.all(deleting.map((id) => deleteFunction(id)));
        if (selectedFunctionId && deleting.includes(selectedFunctionId)) {
          selectFunction(null);
        }
        setSelectedIds([]);
        toast.success("Selected functions deleted.");
      } catch {
        toast.error("Failed to delete selected functions.");
      }
      setFunctionToDelete(null);
      return;
    }

    try {
      await deleteFunction(functionToDelete);
      if (selectedFunctionId === functionToDelete) {
        selectFunction(null);
      }
      toast.success("Function deleted.");
    } catch {
      toast.error("Failed to delete function.");
    }

    setFunctionToDelete(null);
  }, [
    deleteFunction,
    functionToDelete,
    selectFunction,
    selectedFunctionId,
    selectedIds,
  ]);

  const allFilteredSelected =
    filteredFunctions.length > 0 &&
    selectedIds.length === filteredFunctions.length;

  return (
    <div className={cn("bg-sidebar flex h-full flex-col", className)}>
      <div className="space-y-3 border-b p-4">
        <div className="flex min-h-9 items-center gap-2">
          {!isSelectionMode ? (
            <>
              <Button
                onClick={handleCreate}
                className="h-9 flex-1 justify-start gap-2"
                variant="outline"
                aria-label="Create new function"
              >
                <Plus className="h-4 w-4" />
                New Function
              </Button>

              <Button
                onClick={toggleSelectionMode}
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
                  onClick={toggleSelectionMode}
                  title="Cancel selection"
                  aria-label="Cancel selection"
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
                    onClick={() => setFunctionToDelete("bulk")}
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
                      setSelectedIds([]);
                      return;
                    }
                    setSelectedIds(filteredFunctions.map((fn) => fn.id));
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
            onChange={(e) => {
              setSearchInput(e.target.value);
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
                onClick={() => {
                  setSearchInput("");
                }}
                aria-label="Clear function search"
              >
                <X className="text-muted-foreground h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

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
                onSelect={handleSelect}
                onToggleSelection={toggleSelection}
                onDelete={handleDelete}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
              />
            ))}

          {!isSearching && !searchQuery && (
            <div className="mt-4 px-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 border-dashed text-xs font-normal"
                onClick={() => setShowImportDialog(true)}
              >
                <Sparkles className="h-3 w-3" />
                Import Example Functions
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      <ExampleFunctionsDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />

      <Dialog
        open={functionToDelete !== null}
        onOpenChange={(open) => !open && setFunctionToDelete(null)}
      >
        <DialogContent className="max-w-[75vw]">
          <DialogHeader>
            <DialogTitle>
              {functionToDelete === "bulk"
                ? `Delete ${selectedIds.length} Functions`
                : "Delete Function"}
            </DialogTitle>
            <DialogDescription className="text-left">
              {functionToDelete === "bulk"
                ? `Are you sure you want to delete ${selectedIds.length} selected functions? This action cannot be undone.`
                : "Are you sure you want to delete this function? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFunctionToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
