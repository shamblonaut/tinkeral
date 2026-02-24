import { Zap } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import {
  ChatHeader,
  ChatInput,
  ChatSettings,
  ConversationSidebar,
  MessageList,
} from "@/components/chat";
import { DEFAULT_MODEL_ID, getModelDefaultParameters } from "@/lib/models";
import { useConversationStore, useSettingsStore, useUIStore } from "@/stores";

export function ChatInterface() {
  const {
    activeConversationId,
    conversations,
    sendMessage,
    isLoading,
    isStreaming,
    error,
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

  // Handle errors
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Auto-create new conversation if none selected
  // This handles cases like deleting the last conversation
  useEffect(() => {
    if (!activeConversationId && !isLoading) {
      const createNew = async () => {
        const { settings } = useSettingsStore.getState();
        const defaultModel = settings?.defaultModel || DEFAULT_MODEL_ID;
        const params = getModelDefaultParameters(defaultModel);
        await useConversationStore
          .getState()
          .createConversation(defaultModel, params);
      };
      createNew();
    }
  }, [activeConversationId, isLoading]);

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
        <ChatHeader
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
          isChatSettingsOpen={isChatSettingsOpen}
          toggleChatSettings={toggleChatSettings}
        />

        {conversation?.isTemporary && (
          <div className="bg-muted/50 flex items-center justify-center gap-2 border-b py-1 text-xs text-amber-500">
            <Zap className="h-3 w-3" />
            <span className="font-medium">Temporary Chat</span>
          </div>
        )}

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
