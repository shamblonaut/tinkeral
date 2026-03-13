import { Bot, User } from "lucide-react";
import { memo, useCallback, useState } from "react";
import { toast } from "sonner";

import {
  FunctionCallDisplay,
  FunctionResultDisplay,
  MessageActions,
  MessageContent,
  TokenUsageDisplay,
} from "@/components/chat";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/stores";
import type { Message as MessageType } from "@/types";

interface MessageProps {
  message: MessageType;
  isStreaming?: boolean;
}

export const Message = memo(function Message({
  message,
  isStreaming,
}: MessageProps) {
  const isFunctionCallMessage = Boolean(message.functionCall);
  const isFunctionResultMessage = Boolean(message.functionResult);
  const isFunctionMessage = isFunctionCallMessage || isFunctionResultMessage;
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isCopied, setIsCopied] = useState(false);

  const { deleteMessage, retryMessage, editMessage } = useConversationStore();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setIsCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setIsCopied(false), 2000);
  }, [message.content]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(message.content);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditContent(message.content);
  };

  const handleSave = async () => {
    if (editContent.trim() === message.content.trim()) {
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    await editMessage(message.id, editContent);
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    await deleteMessage(message.id);
    setShowDeleteDialog(false);
  };

  const handleRetry = () => {
    retryMessage(message.id);
  };

  if (isSystem) {
    return (
      <div className="flex w-full justify-center p-4">
        <span className="text-muted-foreground text-xs italic">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-background group relative flex w-full gap-4 p-4 transition-colors",
        isUser && !isFunctionMessage ? "flex-row-reverse" : "flex-row",
      )}
    >
      <Avatar className="hidden h-8 w-8 shrink-0 md:block">
        {isUser ? (
          <>
            <AvatarImage src="" alt="User" />
            <AvatarFallback className="bg-primary text-primary-foreground">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </>
        ) : (
          <>
            <AvatarImage src="" alt="Model" />
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          </>
        )}
      </Avatar>

      <div
        className={cn(
          "relative flex max-w-full flex-col gap-1 md:max-w-[80%]",
          isUser && !isFunctionMessage ? "items-end" : "items-start",
          isEditing && "w-full",
        )}
      >
        <div className="flex items-center gap-2 px-2">
          {isUser && !isFunctionMessage ? (
            <>
              <TokenUsageDisplay
                usage={message.metadata?.usage}
                role={message.role}
                contentLength={message.content.length}
              />
              <span className="text-muted-foreground text-[10px]">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="text-xs font-medium opacity-70">You</span>
            </>
          ) : (
            <>
              <span className="text-xs font-medium opacity-70">
                {message.metadata?.model || "Model"}
              </span>
              <span className="text-muted-foreground text-[10px]">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <TokenUsageDisplay
                usage={message.metadata?.usage}
                role={message.role}
                contentLength={
                  message.content.length +
                  (message.functionCall || message.functionResult ? 1 : 0)
                }
              />
            </>
          )}
        </div>

        {message.functionCall ? (
          <FunctionCallDisplay functionCall={message.functionCall} />
        ) : message.functionResult ? (
          <FunctionResultDisplay functionResult={message.functionResult} />
        ) : (
          <MessageContent
            content={message.content}
            isUser={isUser}
            isEditing={isEditing}
            isStreaming={isStreaming}
            editContent={editContent}
            onEditContentChange={setEditContent}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}

        {!isEditing && !isStreaming && !isFunctionMessage && (
          <div className="flex h-8 items-center pt-1">
            <MessageActions
              isUser={isUser}
              isCopied={isCopied}
              onCopy={handleCopy}
              onEdit={handleEdit}
              onRetry={handleRetry}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Message</DialogTitle>
            <DialogDescription className="text-left">
              Are you sure you want to delete this message? This will also
              remove all subsequent messages in this thread. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
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
});
