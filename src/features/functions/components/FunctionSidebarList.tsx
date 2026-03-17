import { cn } from "@/lib/utils";
import { ExampleFunctionsDialog } from "./ExampleFunctionsDialog";
import { FunctionDeleteDialog } from "./FunctionDeleteDialog";
import { FunctionSidebarResults } from "./FunctionSidebarResults";
import { FunctionSidebarToolbar } from "./FunctionSidebarToolbar";
import { useFunctionSidebarState } from "./useFunctionSidebarState";

interface FunctionSidebarListProps {
  className?: string;
  onSelect?: () => void;
}

export function FunctionSidebarList({
  className,
  onSelect,
}: FunctionSidebarListProps) {
  const {
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
  } = useFunctionSidebarState({ onSelect });

  return (
    <div className={cn("bg-sidebar flex h-full flex-col", className)}>
      <FunctionSidebarToolbar
        isSelectionMode={isSelectionMode}
        selectedCount={selectedIds.length}
        allFilteredSelected={allFilteredSelected}
        filteredIds={filteredFunctions.map((fn) => fn.id)}
        searchInput={searchInput}
        isSearching={isSearching}
        onCreate={handleCreate}
        onToggleSelectionMode={toggleSelectionMode}
        onBulkDelete={() => setFunctionToDelete("bulk")}
        onSelectAllFiltered={setSelectedIds}
        onClearSelection={() => setSelectedIds([])}
        onSearchInputChange={setSearchInput}
        onClearSearch={() => setSearchInput("")}
      />

      <FunctionSidebarResults
        filteredFunctions={filteredFunctions}
        isLoading={isLoading}
        isSearching={isSearching}
        searchQuery={searchQuery}
        selectedFunctionId={selectedFunctionId}
        isSelectionMode={isSelectionMode}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        onToggleSelection={toggleSelection}
        onDelete={handleDelete}
        onRename={handleRename}
        onDuplicate={handleDuplicate}
        onShowImportExamples={() => setShowImportDialog(true)}
      />

      <ExampleFunctionsDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />

      <FunctionDeleteDialog
        functionToDelete={functionToDelete}
        selectedCount={selectedIds.length}
        onClose={() => setFunctionToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
