import { ArrowDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Message } from "@/components/chat";
import { ScrollArea } from "@/components/ui";
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
  const contentRef = useRef<HTMLDivElement>(null);

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

  // Use ResizeObserver on the content container to detect height changes
  // Only auto-scroll if the user was already at the bottom
  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    // We only create one observer that lives as long as the component mounts
    const observer = new ResizeObserver(() => {
      // If we are currently autoscrolling, maintain the bottom
      if (shouldAutoScroll) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });

    observer.observe(content);

    return () => {
      observer.disconnect();
    };
  }, [shouldAutoScroll]);

  const scrollToBottom = () => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
      setShouldAutoScroll(true);
    }
  };

  if (messages.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="mb-6 text-5xl">🧩</div>
        <h3 className="mb-2 text-lg font-semibold">Welcome to Tinkeral</h3>
        <p className="text-sm">
          Start a conversation by typing a message below.
        </p>
      </div>
    );
  }

  return (
    <div className="group relative flex h-full flex-1 flex-col overflow-hidden">
      <ScrollArea viewportRef={viewportRef} className={className}>
        <div ref={contentRef} className="flex flex-col py-4">
          {messages.map((message, index) => (
            <Message
              key={message.id}
              message={message}
              isStreaming={isStreaming && index === messages.length - 1}
            />
          ))}
        </div>
      </ScrollArea>

      {!shouldAutoScroll && (
        <button
          onClick={scrollToBottom}
          className="bg-background text-foreground hover:bg-muted focus:ring-ring absolute right-8 bottom-6 z-10 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
