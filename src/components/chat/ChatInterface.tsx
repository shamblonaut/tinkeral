import { Toaster } from "@/components/ui/sonner";
import { useConversationStore } from "@/stores/conversation";
import { useEffect } from "react";
import { toast } from "sonner";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

export function ChatInterface() {
  const {
    activeConversationId,
    conversations,
    sendMessage,
    isLoading,
    isStreaming,
    error,
    createConversation,
  } = useConversationStore();

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const messages = conversation?.messages || [];

  // Create a default conversation if none exists
  useEffect(() => {
    if (!activeConversationId && !isLoading && conversations.length === 0) {
      createConversation("gemma-3-27b-it", {
        temperature: 0.7,
        maxTokens: 1024,
        topP: 0.9,
      }).catch(console.error);
    }
  }, [
    activeConversationId,
    isLoading,
    conversations.length,
    createConversation,
  ]);

  // Handle errors
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleSend = (content: string) => {
    sendMessage(content).catch((err) => {
      // Error handling is done via store error state, but we can also log here
      console.error("SendMessage failed", err);
    });
  };

  return (
    <div className="bg-background flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-xl font-bold">🧩 Tinkeral</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          className="h-full px-4"
        />
      </div>
      <ChatInput onSend={handleSend} disabled={isLoading || isStreaming} />
      <Toaster />
    </div>
  );
}
