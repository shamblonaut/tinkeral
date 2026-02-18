import { Plus } from "lucide-react";

import { ConversationItem } from "@/components/chat";
import { Button, ScrollArea } from "@/components/ui";
import { getModelDefaultParameters } from "@/lib/models";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/stores";

interface ConversationListProps {
  className?: string;
  onSelect?: () => void; // Optional callback for mobile to close the sheet
}

export function ConversationList({
  className,
  onSelect,
}: ConversationListProps) {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    createConversation,
    deleteConversation,
    isLoading,
  } = useConversationStore();

  const handleCreate = async () => {
    const defaultModel = "gemini-2.5-flash-lite";
    const params = getModelDefaultParameters(defaultModel);
    await createConversation(defaultModel, params);
    onSelect?.();
  };

  const handleSelect = (id: string) => {
    setActiveConversation(id);
    onSelect?.();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this conversation?")) {
      await deleteConversation(id);
    }
  };

  return (
    <div className={cn("bg-sidebar flex h-full flex-col", className)}>
      <div className="border-b p-4">
        <Button
          onClick={handleCreate}
          className="h-9 w-full justify-start gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1 p-2">
          {conversations.length === 0 && !isLoading && (
            <div className="text-muted-foreground p-4 text-center text-sm">
              No conversations yet.
            </div>
          )}

          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={activeConversationId === conv.id}
              onSelect={handleSelect}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
