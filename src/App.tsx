import { useEffect } from "react";

import { APIKeyModal } from "@/components/auth";
import { ChatInterface } from "@/components/chat";
import { Toaster } from "@/components/ui";
import { useConversationStore, useSettingsStore } from "@/stores";

function App() {
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const loadConversations = useConversationStore(
    (state) => state.loadConversations,
  );
  const settings = useSettingsStore((state) => state.settings);
  const isLoading = useSettingsStore((state) => state.isLoading);

  // Expose stores for debugging
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).settingsStore = useSettingsStore;
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await loadSettings();
        await loadConversations();
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
    <>
      {!hasGoogleKey ? <APIKeyModal /> : <ChatInterface />}
      <Toaster />
    </>
  );
}

export default App;
