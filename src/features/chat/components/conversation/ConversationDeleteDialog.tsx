import { DeleteConfirmationDialog } from "@/shared/components";

interface ConversationDeleteDialogProps {
  open: boolean;
  conversationToDelete: string | null;
  selectedCount: number;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: () => Promise<void>;
}

export function ConversationDeleteDialog({
  open,
  conversationToDelete,
  selectedCount,
  onOpenChange,
  onConfirmDelete,
}: ConversationDeleteDialogProps) {
  const title =
    conversationToDelete === "bulk"
      ? `Delete ${selectedCount} Conversations`
      : "Delete Conversation";

  const description =
    conversationToDelete === "bulk"
      ? `Are you sure you want to delete ${selectedCount} selected conversations? This action cannot be undone.`
      : "Are you sure you want to delete this conversation? This action cannot be undone.";

  return (
    <DeleteConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      onConfirm={onConfirmDelete}
    />
  );
}
