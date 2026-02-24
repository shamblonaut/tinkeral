import { useEffect } from "react";

import { APIKeyModal } from "@/components/auth";
import { ChatInterface } from "@/components/chat";
import { Toaster, TooltipProvider } from "@/components/ui";
import { getModelDefaultParameters } from "@/lib/models";
import { useConversationStore, useSettingsStore } from "@/stores";

function App() {
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const loadConversations = useConversationStore(
    (state) => state.loadConversations,
  );
  const settings = useSettingsStore((state) => state.settings);
  const isLoading = useSettingsStore((state) => state.isLoading);

  useEffect(() => {
    const init = async () => {
      try {
        await loadSettings();
        await loadConversations();

        // If no active conversation, create a new ephemeral one
        const conversationStore = useConversationStore.getState();
        if (!conversationStore.activeConversationId) {
          const settingsState = useSettingsStore.getState();
          if (settingsState.settings) {
            const defaultModel = settingsState.settings.defaultModel;
            const defaultParams =
              settingsState.settings.defaultParameters ||
              getModelDefaultParameters(defaultModel);

            await conversationStore.createConversation(
              defaultModel,
              defaultParams,
            );
          }
        }
      } catch (error) {
        console.error("Initialization failed:", error);
      }
    };

    init();
  }, [loadSettings, loadConversations]);

  if (isLoading) {
    return (
      <div className="flex h-svh w-full items-center justify-center">
        <div className="border-primary h-32 w-32 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  // Check if we have a Google API key
  const hasGoogleKey = !!settings?.apiKeys?.google;

  return (
    <TooltipProvider>
      {!hasGoogleKey ? <APIKeyModal /> : <ChatInterface />}
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
