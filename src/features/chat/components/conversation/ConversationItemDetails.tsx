import { Copy, Edit2, Trash2 } from "lucide-react";

import { type Conversation } from "@/db";
import { KNOWN_MODELS } from "@/shared/lib/models";
import { calculateConversationTokens } from "@/shared/lib/tokens";
import { formatSmartDate } from "@/shared/lib/utils";

import {
  CompactMetadataCard,
  CompactMetadataCardItem,
  ItemActionsRow,
} from "..";

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

  const actions = [
    {
      id: "rename",
      label: "Rename",
      icon: <Edit2 className="h-3 w-3" />,
      onClick: onRename,
    },
    {
      id: "duplicate",
      label: "Duplicate",
      icon: <Copy className="h-3 w-3" />,
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onDuplicate(conversation.id);
      },
    },
    {
      id: "delete",
      label: "Delete",
      icon: <Trash2 className="h-3 w-3" />,
      destructive: true,
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onDelete(conversation.id, event);
      },
    },
  ];

  return (
    <div className="overflow-hidden">
      <div className="flex flex-col gap-3 pt-1">
        <ItemActionsRow actions={actions} />

        <CompactMetadataCard>
          <CompactMetadataCardItem
            label="Model"
            value={modelName}
            className="col-span-2 flex flex-col gap-0.5"
            valueClassName="truncate font-medium"
          />
          <CompactMetadataCardItem
            label="Messages"
            value={conversation.messages.length}
          />
          <CompactMetadataCardItem
            label="Tokens"
            value={(() => {
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
                  {!isExact && "*"}
                  {total}
                  {model?.contextWindow && (
                    <span
                      className="ml-1 opacity-50"
                      title={`Percentage of total context window used (${model.contextWindow.input.toLocaleString()} tokens)`}
                    >
                      ({((total / model.contextWindow.input) * 100).toFixed(2)}
                      %)
                    </span>
                  )}
                </span>
              );
            })()}
          />
          <CompactMetadataCardItem
            label="Created"
            value={formatSmartDate(conversation.createdAt)}
            className="col-span-1 flex flex-col gap-0.5"
            valueClassName="truncate font-medium"
          />
          <CompactMetadataCardItem
            label="Updated"
            value={formatSmartDate(conversation.updatedAt)}
            className="col-span-1 flex flex-col gap-0.5"
            valueClassName="truncate font-medium"
          />
        </CompactMetadataCard>
      </div>
    </div>
  );
}
