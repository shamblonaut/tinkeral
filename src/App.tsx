import { useEffect } from "react";

import { ChatInterface } from "@/components/chat";
import { useConversationStore, useSettingsStore } from "@/stores";

function App() {
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const loadConversations = useConversationStore(
    (state) => state.loadConversations,
  );

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

  return <ChatInterface />;
}

export default App;
