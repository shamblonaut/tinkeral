import { Check, Copy, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui";

interface MessageActionsProps {
  isUser: boolean;
  isCopied: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onRetry: () => void;
  onDelete: () => void;
}

export function MessageActions({
  isUser,
  isCopied,
  onCopy,
  onEdit,
  onRetry,
  onDelete,
}: MessageActionsProps) {
  if (!isUser) return null;

  return (
    <div className="flex items-center justify-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onCopy}
        title="Copy message"
      >
        {isCopied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onEdit}
        title="Edit message"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onRetry}
        title="Regenerate response"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hover:text-destructive h-7 w-7"
        onClick={onDelete}
        title="Delete message"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
