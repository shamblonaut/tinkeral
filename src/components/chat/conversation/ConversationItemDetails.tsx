import { Copy, Edit2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui";
import { type Conversation } from "@/db";
import { KNOWN_MODELS } from "@/lib/models";
import { calculateConversationTokens } from "@/lib/tokens";
import { formatSmartDate } from "@/lib/utils";

interface ConversationItemDetailsProps {
  conversation: Conversation;
  modelName: string;
  onRename: (e: React.MouseEvent) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export function ConversationItemDetails({
  conversation,
  modelName,
  onRename,
  onDuplicate,
  onDelete,
}: ConversationItemDetailsProps) {
  const model = KNOWN_MODELS.find((m) => m.id === conversation.modelId);

  return (
    <div className="overflow-hidden">
      <div className="flex flex-col gap-3 pt-1">
        <div className="grid grid-cols-3 gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-0 text-[11px] font-normal"
            onClick={onRename}
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
              onDuplicate(conversation.id);
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
            <div className="col-span-2 flex flex-col gap-0.5">
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
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold tracking-wider uppercase opacity-40">
                Tokens
              </span>
              <span className="font-medium">
                {(() => {
                  const { total, isExact } =
                    calculateConversationTokens(conversation);
                  return (
                    <span
                      title={
                        isExact
                          ? "Exact count from model summary"
                          : "Approximate count based on message history"
                      }
                    >
                      {!isExact && "~"}
                      {total}
                      {model?.contextWindow && (
                        <span
                          className="ml-1 opacity-50"
                          title={`Percentage of total context window used (${model.contextWindow.input.toLocaleString()} tokens)`}
                        >
                          (
                          {((total / model.contextWindow.input) * 100).toFixed(
                            2,
                          )}
                          %)
                        </span>
                      )}
                    </span>
                  );
                })()}
              </span>
            </div>
            <div className="col-span-1 flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold tracking-wider uppercase opacity-40">
                Created
              </span>
              <span className="truncate font-medium">
                {formatSmartDate(conversation.createdAt)}
              </span>
            </div>
            <div className="col-span-1 flex flex-col gap-0.5">
              <span className="text-[9px] font-semibold tracking-wider uppercase opacity-40">
                Updated
              </span>
              <span className="truncate font-medium">
                {formatSmartDate(conversation.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
