import { useEffect, useState } from "react";

import { APIKeyModal } from "@/components/auth";
import { ChatInterface, LoadingScreen } from "@/components/chat";
import { Toaster, TooltipProvider } from "@/components/ui";
import { getModelDefaultParameters } from "@/lib/models";
import { useConversationStore, useSettingsStore } from "@/stores";

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const { loadConversations, loadModels } = useConversationStore();
  const settings = useSettingsStore((state) => state.settings);
  const isSettingsLoading = useSettingsStore((state) => state.isLoading);
  const isConversationsLoading = useConversationStore(
    (state) => state.isLoading,
  );

  useEffect(() => {
    const init = async () => {
      try {
        await loadSettings();
        const settingsState = useSettingsStore.getState();
        if (settingsState.settings?.apiKeys["google"]) {
          // Load models in background, don't wait
          loadModels();
        }
        await loadConversations();

        // If no active conversation, create a new ephemeral one
        const conversationStore = useConversationStore.getState();
        if (!conversationStore.activeConversationId) {
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
        setIsInitialized(true);
      } catch (error) {
        console.error("Initialization failed:", error);
        setIsInitialized(true);
      }
    };

    init();
  }, [loadSettings, loadConversations, loadModels]);

  // Determine global loading state and progress
  let progress = 0;
  let loadingMessage = "Initializing...";

  if (!isInitialized) {
    if (isSettingsLoading) {
      progress = 20;
      loadingMessage = "Loading Settings...";
    } else if (!settings) {
      progress = 40;
      loadingMessage = "Preparing App...";
    } else if (isConversationsLoading) {
      progress = 80;
      loadingMessage = "Readying Conversations...";
    } else {
      progress = 100;
      loadingMessage = "Finalizing...";
    }

    return <LoadingScreen message={loadingMessage} progress={progress} />;
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
