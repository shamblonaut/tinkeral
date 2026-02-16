import { useConversationStore, useSettingsStore } from "@/stores";
import { DEFAULT_PARAMETERS } from "@/types";
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
    activeConversation?.modelId ||
    settings?.defaultModel ||
    "gemini-2.5-flash-lite";

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
    const defaultParams = settings?.defaultParameters || DEFAULT_PARAMETERS;
    await createConversation(modelId, defaultParams);
  };

  return {
    sortedModels,
    selectedModel,
    currentModelId,
    handleSelect,
  };
}
