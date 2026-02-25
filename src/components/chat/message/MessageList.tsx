import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Message } from "@/components/chat";
import { Button, ScrollArea } from "@/components/ui";
import { useConversationStore } from "@/stores";
import type { Message as MessageType } from "@/types";

interface MessageListProps {
  messages: MessageType[];
  isStreaming: boolean;
  className?: string;
}

export function MessageList({
  messages,
  isStreaming,
  className,
}: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const { error, retryMessage } = useConversationStore();

  // Auto-scroll to bottom when messages change
  // Track if user is at bottom to sticky scroll
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const handleScroll = () => {
    const viewport = viewportRef.current;
    if (viewport) {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      // If user is within 50px of bottom, sticky scroll
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setShouldAutoScroll(isAtBottom);
    }
  };

  // Add scroll listener
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.addEventListener("scroll", handleScroll);
      return () => viewport.removeEventListener("scroll", handleScroll);
    }
  }, []);

  // Auto-scroll to bottom when messages change IF we were already at bottom
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport && shouldAutoScroll) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isStreaming, shouldAutoScroll]);

  const handleRetry = () => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      retryMessage(lastMessage.id);
    }
  };

  if (messages.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center p-8 text-center">
        <h3 className="mb-2 text-lg font-semibold">Welcome to Tinkeral</h3>
        <p className="text-sm">
          Start a conversation by typing a message below.
        </p>
      </div>
    );
  }

  const errorMessage: string =
    error && typeof error === "object"
      ? error.userMessage || error.message || "An error occurred"
      : String(error || "");

  return (
    <ScrollArea viewportRef={viewportRef} className={className}>
      <div className="flex flex-col py-4">
        {messages.map((message, index) => (
          <Message
            key={message.id}
            message={message}
            isStreaming={isStreaming && index === messages.length - 1}
          />
        ))}

        {!!error && !isStreaming && (
          <div className="border-destructive/20 bg-destructive/5 mx-4 my-2 flex flex-col items-center gap-3 rounded-lg border p-4 text-center">
            <div className="text-destructive flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4" />
              <span>{errorMessage}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="border-destructive/20 hover:bg-destructive/10 hover:text-destructive h-8 gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry Message
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
