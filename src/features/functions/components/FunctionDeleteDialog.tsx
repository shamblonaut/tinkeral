import { DeleteConfirmationDialog } from "@/shared/components";

interface FunctionDeleteDialogProps {
  functionToDelete: string | null;
  selectedCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function FunctionDeleteDialog({
  functionToDelete,
  selectedCount,
  onClose,
  onConfirm,
}: FunctionDeleteDialogProps) {
  const title =
    functionToDelete === "bulk"
      ? `Delete ${selectedCount} Functions`
      : "Delete Function";

  const description =
    functionToDelete === "bulk"
      ? `Are you sure you want to delete ${selectedCount} selected functions? This action cannot be undone.`
      : "Are you sure you want to delete this function? This action cannot be undone.";

  return (
    <DeleteConfirmationDialog
      open={functionToDelete !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      description={description}
      onConfirm={onConfirm}
    />
  );
}
