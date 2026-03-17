import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";

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
  return (
    <Dialog
      open={functionToDelete !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-[75vw]">
        <DialogHeader>
          <DialogTitle>
            {functionToDelete === "bulk"
              ? `Delete ${selectedCount} Functions`
              : "Delete Function"}
          </DialogTitle>
          <DialogDescription className="text-left">
            {functionToDelete === "bulk"
              ? `Are you sure you want to delete ${selectedCount} selected functions? This action cannot be undone.`
              : "Are you sure you want to delete this function? This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void onConfirm()}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
