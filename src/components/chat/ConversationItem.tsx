import { MessageSquare, Trash2 } from "lucide-react";

import { Button } from "@/components/ui";
import { type Conversation } from "@/db";
import { KNOWN_MODELS } from "@/lib/models";
import { cn, formatRelativeTime } from "@/lib/utils";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: ConversationItemProps) {
  const model = KNOWN_MODELS.find((m) => m.id === conversation.modelId);
  const modelName = model?.name || conversation.modelId;

  return (
    <div
      onClick={() => onSelect(conversation.id)}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-1 rounded-lg p-3 transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
      )}
    >
      <div className="flex items-center gap-2 pr-6">
        <MessageSquare className="h-4 w-4 shrink-0" />
        <span className="truncate text-sm font-medium">
          {conversation.title || "New Conversation"}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 pl-6 text-[11px]">
        <span className="truncate opacity-70">{modelName}</span>
        <span className="shrink-0 opacity-50">
          {formatRelativeTime(conversation.updatedAt)}
        </span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => onDelete(conversation.id, e)}
        className={cn(
          "absolute top-2 right-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100",
          isActive ? "hover:bg-accent-foreground/10" : "hover:bg-accent",
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="sr-only">Delete conversation</span>
      </Button>
    </div>
  );
}
