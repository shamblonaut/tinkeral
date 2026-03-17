import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[75vw]">
        <DialogHeader>
          <DialogTitle>
            {conversationToDelete === "bulk"
              ? `Delete ${selectedCount} Conversations`
              : "Delete Conversation"}
          </DialogTitle>
          <DialogDescription className="text-left">
            {conversationToDelete === "bulk"
              ? `Are you sure you want to delete ${selectedCount} selected conversations? This action cannot be undone.`
              : "Are you sure you want to delete this conversation? This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void onConfirmDelete()}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
