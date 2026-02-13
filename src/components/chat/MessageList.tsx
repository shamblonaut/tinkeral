import { ScrollArea } from "@/components/ui/scroll-area";
import type { Message as MessageType } from "@/types/conversation";
import { useEffect, useRef, useState } from "react";
import { Message } from "./Message";

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
      </div>
    </ScrollArea>
  );
}
