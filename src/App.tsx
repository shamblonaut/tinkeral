import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  ChatInterface,
  LoadingScreen,
  useConversationStore,
} from "@/features/chat";
import { useFunctionsStore } from "@/features/functions";
import { APIKeyModal, useSettingsStore } from "@/features/settings";
import { Toaster, TooltipProvider } from "@/shared/components/ui";

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const { loadConversations, loadModels, ensureActiveConversation } =
    useConversationStore(
      useShallow((state) => ({
        loadConversations: state.loadConversations,
        loadModels: state.loadModels,
        ensureActiveConversation: state.ensureActiveConversation,
      })),
    );
  const { ensureFunctionsLoaded } = useFunctionsStore(
    useShallow((state) => ({
      ensureFunctionsLoaded: state.ensureFunctionsLoaded,
    })),
  );
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
        await ensureFunctionsLoaded();
        await loadConversations();
        await ensureActiveConversation();
        setIsInitialized(true);
      } catch (error) {
        console.error("Initialization failed:", error);
        setIsInitialized(true);
      }
    };

    init();
  }, [
    loadSettings,
    loadConversations,
    loadModels,
    ensureFunctionsLoaded,
    ensureActiveConversation,
  ]);

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
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        {!hasGoogleKey ? <APIKeyModal /> : <ChatInterface />}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
