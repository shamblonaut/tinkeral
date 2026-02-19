import {
  Bot,
  Check,
  Copy,
  Pencil,
  RotateCcw,
  Trash2,
  User,
  X,
} from "lucide-react";
import { memo, useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

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
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/stores";
import type { Message as MessageType } from "@/types";
import { TokenUsageDisplay } from "./TokenUsageDisplay";

interface MessageProps {
  message: MessageType;
  isStreaming?: boolean;
}

export const Message = memo(function Message({
  message,
  isStreaming,
}: MessageProps) {
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

  const handleDelete = async () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    await deleteMessage(message.id);
    setShowDeleteDialog(false);
  };

  const handleRetry = async () => {
    await retryMessage(message.id);
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
        "bg-background group hover:bg-muted/30 relative flex w-full gap-4 p-4 transition-colors",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        {isUser ? (
          <>
            <AvatarImage src="" alt="User" />
            <AvatarFallback className="bg-primary text-primary-foreground">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </>
        ) : (
          <>
            <AvatarImage src="/bot-avatar.png" alt="Model" />
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          </>
        )}
      </Avatar>

      <div
        className={cn(
          "relative flex max-w-[80%] flex-col gap-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn("flex items-center gap-2", isUser ? "pl-4" : "pr-4")}
        >
          {isUser ? (
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
                contentLength={message.content.length}
              />
            </>
          )}
        </div>

        <div
          className={cn(
            "prose prose-neutral dark:prose-invert relative w-full text-sm leading-relaxed wrap-break-word transition-colors duration-200",
            isEditing
              ? "bg-muted ring-border/50 rounded-xl px-2 py-1 shadow-inner ring-1"
              : isUser
                ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2 shadow-sm"
                : "bg-muted rounded-2xl rounded-tl-sm px-4 py-2 shadow-sm",
          )}
        >
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="text-foreground min-h-[80px] w-full resize-none border-none bg-transparent p-2 shadow-none focus-visible:ring-0"
                autoFocus
              />
              <div className="flex justify-end gap-1.5 p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="hover:bg-background/50 h-7 px-3 text-xs"
                >
                  <X className="mr-1 h-3 w-3" /> Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="bg-foreground text-background hover:bg-foreground/90 h-7 px-3 text-xs"
                >
                  <Check className="mr-1 h-3 w-3" /> Save & Submit
                </Button>
              </div>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : !message.content && isStreaming ? (
            <div className="flex h-6 items-center gap-1">
              <span className="bg-muted-foreground/40 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
              <span className="bg-muted-foreground/40 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
              <span className="bg-muted-foreground/40 h-1.5 w-1.5 animate-bounce rounded-full" />
            </div>
          ) : (
            <div
              className={cn(
                "relative",
                isStreaming &&
                  "[&>*:last-child]:after:bg-primary [&>*:last-child]:after:ml-1 [&>*:last-child]:after:inline-block [&>*:last-child]:after:h-4 [&>*:last-child]:after:w-2 [&>*:last-child]:after:animate-pulse [&>*:last-child]:after:align-middle [&>*:last-child]:after:content-['']",
              )}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isEditing && !isStreaming && (
          <div className="flex h-8 items-center pt-1">
            {isUser && (
              <div className="flex items-center justify-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleCopy}
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
                  onClick={handleEdit}
                  title="Edit message"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleRetry}
                  title="Regenerate response"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:text-destructive h-7 w-7"
                  onClick={handleDelete}
                  title="Delete message"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
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
