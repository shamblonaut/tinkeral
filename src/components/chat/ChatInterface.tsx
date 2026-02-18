import { PanelLeft, Settings2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import {
  ChatInput,
  ChatSettings,
  ConversationSidebar,
  MessageList,
} from "@/components/chat";
import { Button } from "@/components/ui";
import { getModelDefaultParameters } from "@/lib/models";
import { cn } from "@/lib/utils";
import { useConversationStore, useSettingsStore, useUIStore } from "@/stores";

export function ChatInterface() {
  const {
    activeConversationId,
    conversations,
    sendMessage,
    isLoading,
    isStreaming,
    error,
    createConversation,
    abortGeneration,
  } = useConversationStore();

  const {
    toggleChatSettings,
    isChatSettingsOpen,
    isSidebarOpen,
    toggleSidebar,
  } = useUIStore();

  const conversation = conversations.find((c) => c.id === activeConversationId);
  const messages = conversation?.messages || [];

  // Create a default conversation if none exists
  useEffect(() => {
    if (!activeConversationId && !isLoading && conversations.length === 0) {
      const { settings } = useSettingsStore.getState();
      const modelId = settings?.defaultModel || "gemini-2.5-flash-lite";
      createConversation(modelId, getModelDefaultParameters(modelId)).catch(
        console.error,
      );
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
    <div className="bg-background flex h-svh flex-col md:flex-row">
      <ConversationSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className={cn(
                "h-8 w-8",
                isSidebarOpen && "bg-accent text-accent-foreground",
              )}
            >
              <PanelLeft className="h-4 w-4" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
            <h1 className="text-xl font-bold">🧩 Tinkeral</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleChatSettings}
              className={cn(
                "h-8 w-8",
                isChatSettingsOpen && "bg-accent text-accent-foreground",
              )}
            >
              <Settings2 className="h-4 w-4" />
              <span className="sr-only">Toggle chat settings</span>
            </Button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <MessageList
                messages={messages}
                isStreaming={isStreaming}
                className="h-full px-4"
              />
            </div>
            <ChatInput
              onSend={handleSend}
              disabled={isLoading && !isStreaming}
              isStreaming={isStreaming}
              onStop={abortGeneration}
            />
          </div>
          <ChatSettings />
        </div>
      </div>
    </div>
  );
}
