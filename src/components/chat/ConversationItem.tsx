import {
  CheckSquare,
  Copy,
  Edit2,
  MessageSquare,
  MoreVertical,
  Square,
  Trash2,
} from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

import {
  Button,
  Input,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { type Conversation } from "@/db";
import { useMediaQuery } from "@/hooks";
import { KNOWN_MODELS } from "@/lib/models";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useConversationStore } from "@/stores";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  // New props for selection
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
}

export const ConversationItem = memo(function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection,
}: ConversationItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const renameConversation = useConversationStore(
    (state) => state.renameConversation,
  );
  const duplicateConversation = useConversationStore(
    (state) => state.duplicateConversation,
  );
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const model = KNOWN_MODELS.find((m) => m.id === conversation.modelId);
  const modelName = model?.name || conversation.modelId;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRename = async () => {
    if (title.trim() && title !== conversation.title) {
      await renameConversation(conversation.id, title.trim());
    } else {
      setTitle(conversation.title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      setTitle(conversation.title);
      setIsEditing(false);
    }
  };

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTitle(conversation.title);
    setIsEditing(true);
    setIsExpanded(true); // Ensure expanded when editing
  };

  return (
    <div
      onClick={() => {
        if (isSelectionMode) {
          onToggleSelection?.(conversation.id);
        } else if (!isEditing) {
          onSelect(conversation.id);
        }
      }}
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
          <MessageSquare className="h-4 w-4 shrink-0" />
        )}
        {isEditing ? (
          <Input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            className="bg-background h-6 px-1 py-0 text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate text-sm font-medium">
            {conversation.title || "New Conversation"}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pl-6 text-[11px]">
        <span className="truncate opacity-70">{modelName}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0 cursor-help opacity-50">
              {formatRelativeTime(conversation.updatedAt)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Created: {new Date(conversation.createdAt).toLocaleString()}</p>
            <p>Updated: {new Date(conversation.updatedAt).toLocaleString()}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <div
        className={cn(
          "absolute top-2 right-2 transition-opacity",
          isDesktop && !isExpanded
            ? "opacity-0 group-hover:opacity-100"
            : "opacity-100",
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 transition-all",
            isActive ? "hover:bg-accent-foreground/10" : "hover:bg-accent",
            isExpanded && "bg-accent rotate-90",
          )}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
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
                onClick={startEditing}
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
                  duplicateConversation(conversation.id);
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
                  onDelete(conversation.id, e);
                }}
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            </div>

            <div className="bg-muted/50 text-accent-foreground/70 rounded-md border p-2 text-[10px] leading-tight">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold tracking-wider uppercase opacity-40">
                    Model
                  </span>
                  <span className="truncate font-medium">{modelName}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold tracking-wider uppercase opacity-40">
                    Messages
                  </span>
                  <span className="font-medium">
                    {conversation.messages.length}
                  </span>
                </div>
                <div className="col-span-2 flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold tracking-wider uppercase opacity-40">
                    Created
                  </span>
                  <span className="font-medium">
                    {new Date(conversation.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="col-span-2 flex flex-col gap-0.5">
                  <span className="text-[9px] font-semibold tracking-wider uppercase opacity-40">
                    Updated
                  </span>
                  <span className="font-medium">
                    {new Date(conversation.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
