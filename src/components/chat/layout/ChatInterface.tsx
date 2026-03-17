import { WifiOff, Zap } from "lucide-react";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";

import { SettingsModal } from "@/components/chat/settings/SettingsModal";
import features from "@/config/features";
import {
  FunctionEditorMain,
  FunctionEditorProvider,
  FunctionSidebar,
} from "@/features/functions";
import { useConversationStore, useUIStore } from "@/stores";
import { useFunctionsStore } from "@/stores/functions";

import { FunctionAttachmentBar } from "../functions/FunctionAttachmentBar";
import { FunctionErrorBoundary } from "../functions/FunctionErrorBoundary";
import { ChatInput } from "../message/ChatInput";
import { MessageList } from "../message/MessageList";
import { ChatSettings } from "../settings/ChatSettings";
import { ChatHeader } from "./ChatHeader";
import { ConversationSidebar } from "./ConversationSidebar";

export function ChatInterface() {
  const {
    activeConversationId,
    conversations,
    sendMessage,
    isLoading,
    isStreaming,
    error,
    abortGeneration,
    ensureActiveConversation,
  } = useConversationStore();

  const {
    platformView,
    setPlatformView,
    toggleChatSettings,
    isChatSettingsOpen,
    isSidebarOpen,
    toggleSidebar,
    selectedFunctionId,
    selectFunction,
  } = useUIStore();

  const conversation = conversations.find(
    (c: { id: string }) => c.id === activeConversationId,
  );
  const messages = conversation?.messages || [];
  const attachedFunctionCount = conversation?.functionIds?.length || 0;

  const selectedFn = useFunctionsStore((state) =>
    selectedFunctionId
      ? state.functions.find((f) => f.id === selectedFunctionId)
      : undefined,
  );

  useEffect(() => {
    if (error) {
      const message =
        typeof error === "object"
          ? error.userMessage || error.message || "An unexpected error occurred"
          : String(error || "");
      toast.error(message);
    }
  }, [error]);

  useEffect(() => {
    if (!activeConversationId && !isLoading) {
      void ensureActiveConversation();
    }
  }, [activeConversationId, isLoading, ensureActiveConversation]);

  const handleSend = (content: string) => {
    sendMessage(content).catch((err: unknown) => {
      console.error("SendMessage failed", err);
    });
  };

  const handleFunctionSave = useCallback(
    (savedId: string) => {
      selectFunction(savedId);
    },
    [selectFunction],
  );

  useEffect(() => {
    if (!features.functionCalling && platformView === "functions") {
      setPlatformView("chat");
    }
  }, [platformView, setPlatformView]);

  return (
    <div className="bg-background flex h-svh flex-col md:flex-row">
      {platformView === "chat" ? (
        <ConversationSidebar />
      ) : (
        <FunctionErrorBoundary
          title="Function sidebar unavailable"
          description="The function management sidebar hit an error and can be retried."
        >
          <FunctionSidebar />
        </FunctionErrorBoundary>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatHeader
          platformView={platformView}
          setPlatformView={setPlatformView}
          showFunctionsView={features.functionCalling}
          attachedFunctionCount={attachedFunctionCount}
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
          isSettingsOpen={isChatSettingsOpen}
          toggleSettings={toggleChatSettings}
          showSettingsToggle={platformView === "chat"}
        />

        {platformView === "chat" && (
          <>
            {conversation?.isTemporary && (
              <div className="bg-muted/50 flex items-center justify-center gap-2 border-b py-1 text-xs text-amber-500">
                <Zap className="h-3 w-3" />
                <span className="font-medium">Temporary Chat</span>
              </div>
            )}

            {!navigator.onLine && (
              <div className="bg-destructive/10 text-destructive flex items-center justify-center gap-2 border-b py-1 text-xs">
                <WifiOff className="h-3 w-3" />
                <span className="font-medium">
                  You are currently offline. Some features may not work.
                </span>
              </div>
            )}

            {features.functionCalling && (
              <FunctionErrorBoundary
                title="Function attachments unavailable"
                description="The function attachment bar encountered an error."
              >
                <FunctionAttachmentBar />
              </FunctionErrorBoundary>
            )}
          </>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {platformView === "chat" ? (
              <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="flex-1 overflow-hidden">
                    <MessageList
                      messages={messages}
                      isStreaming={isStreaming}
                      className="h-full px-4"
                    />
                  </div>
                  <ChatInput
                    onSend={handleSend}
                    disabled={isLoading || isStreaming}
                    isStreaming={isStreaming}
                    onStop={abortGeneration}
                  />
                </div>
                <ChatSettings />
              </div>
            ) : (
              <FunctionErrorBoundary
                title="Function editor unavailable"
                description="The function editor encountered an error and can be retried."
              >
                <FunctionEditorProvider
                  key={selectedFunctionId ?? "__new__"}
                  initialValues={selectedFn}
                  onSave={handleFunctionSave}
                  onCancel={() => selectFunction(null)}
                >
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <FunctionEditorMain />
                  </div>
                </FunctionEditorProvider>
              </FunctionErrorBoundary>
            )}
          </div>
        </div>
      </div>

      <SettingsModal />
    </div>
  );
}
