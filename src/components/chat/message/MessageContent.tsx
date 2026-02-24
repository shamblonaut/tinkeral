import { Check, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

interface MessageContentProps {
  content: string;
  isUser: boolean;
  isEditing: boolean;
  isStreaming?: boolean;
  editContent: string;
  onEditContentChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function MessageContent({
  content,
  isUser,
  isEditing,
  isStreaming,
  editContent,
  onEditContentChange,
  onSave,
  onCancel,
}: MessageContentProps) {
  return (
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
            onChange={(e) => onEditContentChange(e.target.value)}
            className="text-foreground min-h-[80px] w-full resize-none border-none bg-transparent p-2 shadow-none focus-visible:ring-0"
            autoFocus
          />
          <div className="flex justify-end gap-1.5 p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="hover:bg-background/50 h-7 px-3 text-xs"
            >
              <X className="mr-1 h-3 w-3" /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              className="bg-foreground text-background hover:bg-foreground/90 h-7 px-3 text-xs"
            >
              <Check className="mr-1 h-3 w-3" /> Save & Submit
            </Button>
          </div>
        </div>
      ) : isUser ? (
        <p className="whitespace-pre-wrap">{content}</p>
      ) : !content && isStreaming ? (
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
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
