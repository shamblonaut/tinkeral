import { useConversationStore, useSettingsStore } from "@/stores";
import { useEffect, useMemo } from "react";

export function useModelSelection(onSelect?: () => void) {
  const {
    availableModels,
    loadModels,
    activeConversationId,
    conversations,
    createConversation,
  } = useConversationStore();

  const { settings } = useSettingsStore();

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId,
  );

  const currentModelId =
    activeConversation?.modelId || settings?.defaultModel || "gemma-3-1b-it";

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const selectedModel = availableModels.find((m) => m.id === currentModelId);

  const sortedModels = useMemo(() => {
    return [...availableModels].sort((a, b) => {
      if (a.id === currentModelId) return -1;
      if (b.id === currentModelId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [availableModels, currentModelId]);

  const handleSelect = async (modelId: string) => {
    onSelect?.();
    const defaultParams = settings?.defaultParameters || {
      temperature: 0.7,
      maxTokens: 1024,
      topP: 0.9,
    };
    await createConversation(modelId, defaultParams);
  };

  return {
    sortedModels,
    selectedModel,
    currentModelId,
    handleSelect,
  };
}
