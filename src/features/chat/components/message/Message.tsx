import { Bot, User } from "lucide-react";
import { memo, useCallback, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { FunctionErrorBoundary } from "@/features/functions";
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
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import type { Message as MessageType } from "@/shared/types";

import {
  FunctionCallDisplay,
  MessageActions,
  MessageContent,
  TokenUsageDisplay,
} from "..";
import { useConversationStore } from "../../store";

interface MessageProps {
  messageGroup: MessageType[];
  isStreaming?: boolean;
}

export const Message = memo(function Message({
  messageGroup,
  isStreaming,
}: MessageProps) {
  const message = messageGroup[0];
  const isUser = message.role === "user" && !message.functionResult;
  const isSystem = message.role === "system";

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isCopied, setIsCopied] = useState(false);

  const { deleteMessage, retryMessage, editMessage, abortGeneration } =
    useConversationStore(
      useShallow((state) => ({
        deleteMessage: state.deleteMessage,
        retryMessage: state.retryMessage,
        editMessage: state.editMessage,
        abortGeneration: state.abortGeneration,
      })),
    );

  const handleCopy = useCallback(() => {
    const fullContent = messageGroup
      .map((m) => m.content)
      .filter(Boolean)
      .join("\n\n");
    navigator.clipboard.writeText(fullContent);
    setIsCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setIsCopied(false), 2000);
  }, [messageGroup]);

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

  const isFunctionMessage = messageGroup.some(
    (m) => m.functionCall || m.functionResult,
  );

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

        <div
          className={cn(
            "relative w-full rounded-2xl px-4 py-2 shadow-sm transition-colors duration-200",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted rounded-tl-sm",
          )}
        >
          <div className="flex w-full flex-col gap-1">
            {messageGroup.map((m, idx) => {
              const isLastInGroup = idx === messageGroup.length - 1;
              const isFunctionCall = Boolean(m.functionCall);
              const isFunctionResult = Boolean(m.functionResult);

              if (isFunctionResult) return null;

              let pairedResult;
              let status: "executing" | "completed" | "failed" | "cancelled" =
                "completed";

              if (isFunctionCall) {
                pairedResult = messageGroup.find(
                  (candidate) =>
                    candidate.functionResult?.name === m.functionCall?.name,
                )?.functionResult;

                if (pairedResult) {
                  status = pairedResult.error ? "failed" : "completed";
                } else {
                  status = isStreaming ? "executing" : "cancelled";
                }
              }

              return (
                <div key={m.id} className="flex flex-col">
                  {m.content && (
                    <MessageContent
                      content={m.content}
                      isUser={isUser}
                      isEditing={isEditing}
                      isStreaming={
                        isStreaming && isLastInGroup && !isFunctionCall
                      }
                      isEmbedded={true}
                      editContent={editContent}
                      onEditContentChange={setEditContent}
                      onSave={handleSave}
                      onCancel={handleCancel}
                    />
                  )}

                  {isFunctionCall && m.functionCall && (
                    <FunctionErrorBoundary
                      title="Function call message unavailable"
                      description="Rendering this function call failed."
                    >
                      <FunctionCallDisplay
                        functionCall={m.functionCall}
                        functionResult={pairedResult}
                        status={status}
                        onCancel={
                          status === "executing" ? abortGeneration : undefined
                        }
                      />
                    </FunctionErrorBoundary>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {!isEditing && !isStreaming && (
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
