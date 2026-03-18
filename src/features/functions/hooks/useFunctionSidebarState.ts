import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { useDebounce } from "@/shared/hooks";
import { useUIStore } from "@/shared/store/ui";

import { useFunctionsStore } from "../store";

interface UseFunctionSidebarStateOptions {
  onSelect?: () => void;
}

export function useFunctionSidebarState({
  onSelect,
}: UseFunctionSidebarStateOptions) {
  const {
    functions,
    isLoading,
    ensureFunctionsLoaded,
    createFunction,
    updateFunction,
    deleteFunction,
  } = useFunctionsStore(
    useShallow((state) => ({
      functions: state.functions,
      isLoading: state.isLoading,
      ensureFunctionsLoaded: state.ensureFunctionsLoaded,
      createFunction: state.createFunction,
      updateFunction: state.updateFunction,
      deleteFunction: state.deleteFunction,
    })),
  );

  const { selectedFunctionId, selectFunction } = useUIStore(
    useShallow((state) => ({
      selectedFunctionId: state.selectedFunctionId,
      selectFunction: state.selectFunction,
    })),
  );

  const [searchInput, setSearchInput] = useState("");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [functionToDelete, setFunctionToDelete] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const debouncedSearchQuery = useDebounce(searchInput, 300);
  const searchQuery = debouncedSearchQuery;
  const isSearching = searchInput !== debouncedSearchQuery;

  useEffect(() => {
    void ensureFunctionsLoaded();
  }, [ensureFunctionsLoaded]);

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
      if (!source) {
        return;
      }

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

  return {
    functions,
    filteredFunctions,
    isLoading,
    searchInput,
    searchQuery,
    isSearching,
    isSelectionMode,
    selectedIds,
    selectedFunctionId,
    functionToDelete,
    showImportDialog,
    allFilteredSelected,
    setSearchInput,
    setSelectedIds,
    setFunctionToDelete,
    setShowImportDialog,
    handleCreate,
    handleSelect,
    handleRename,
    handleDuplicate,
    handleDelete,
    toggleSelection,
    toggleSelectionMode,
    confirmDelete,
  };
}
