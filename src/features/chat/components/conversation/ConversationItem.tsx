import { CheckSquare, MessageSquare, Square } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

import { type Conversation } from "@/db";
import {
  Input,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui";
import { useMediaQuery } from "@/shared/hooks";
import { KNOWN_MODELS } from "@/shared/lib/models";
import { cn, formatRelativeTime } from "@/shared/lib/utils";

import { ConversationItemDetails, ExpandableSelectableItemCard } from "..";
import { useConversationStore } from "../../store";

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
    <ExpandableSelectableItemCard
      onClick={() => {
        if (isSelectionMode) {
          onToggleSelection?.(conversation.id);
        } else if (!isEditing) {
          onSelect(conversation.id);
        }
      }}
      isActive={isActive}
      isExpanded={isExpanded}
      onToggleExpanded={() => setIsExpanded(!isExpanded)}
      expandButtonContainerClassName={cn(
        "transition-opacity",
        isDesktop && !isExpanded
          ? "opacity-0 group-hover:opacity-100"
          : "opacity-100",
      )}
      leadingContent={
        isSelectionMode ? (
          isSelected ? (
            <CheckSquare className="text-primary h-4 w-4 shrink-0" />
          ) : (
            <Square className="text-muted-foreground h-4 w-4 shrink-0" />
          )
        ) : (
          <MessageSquare className="h-4 w-4 shrink-0" />
        )
      }
      titleContent={
        isEditing ? (
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
        )
      }
      metadataContent={
        <>
          <span className="truncate opacity-70">{modelName}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0 cursor-help opacity-50">
                {formatRelativeTime(conversation.updatedAt)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>
                Created: {new Date(conversation.createdAt).toLocaleString()}
              </p>
              <p>
                Updated: {new Date(conversation.updatedAt).toLocaleString()}
              </p>
            </TooltipContent>
          </Tooltip>
        </>
      }
      detailsContent={
        <ConversationItemDetails
          conversation={conversation}
          modelName={modelName}
          onRename={startEditing}
          onDuplicate={duplicateConversation}
          onDelete={onDelete}
        />
      }
    />
  );
});
