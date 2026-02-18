import { Plus } from "lucide-react";
import { useState } from "react";

import { ConversationItem } from "@/components/chat";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ScrollArea,
} from "@/components/ui";
import { getModelDefaultParameters } from "@/lib/models";
import { cn } from "@/lib/utils";
import { useConversationStore, useSettingsStore } from "@/stores";

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

  const [conversationToDelete, setConversationToDelete] = useState<
    string | null
  >(null);

  const { settings } = useSettingsStore();

  const handleCreate = async () => {
    const defaultModel = settings?.defaultModel || "gemini-2.5-flash-lite";
    const params = getModelDefaultParameters(defaultModel);
    await createConversation(defaultModel, params);
    onSelect?.();
  };

  const handleSelect = (id: string) => {
    setActiveConversation(id);
    onSelect?.();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversationToDelete(id);
  };

  const confirmDelete = async () => {
    if (conversationToDelete) {
      await deleteConversation(conversationToDelete);
      setConversationToDelete(null);
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
      <Dialog
        open={conversationToDelete !== null}
        onOpenChange={(open: boolean) => !open && setConversationToDelete(null)}
      >
        <DialogContent className="max-w-[75vw]">
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription className="text-left">
              Are you sure you want to delete this conversation? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConversationToDelete(null)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
