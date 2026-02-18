import { getModelDefaultParameters } from "@/lib/models";
import { useConversationStore, useSettingsStore } from "@/stores";
import { useEffect } from "react";

export function useModelSelection(onSelect?: () => void) {
  const {
    availableModels,
    loadModels,
    activeConversationId,
    conversations,
    createConversation,
  } = useConversationStore();

  const { settings, updateSettings } = useSettingsStore();

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

  // const models = useMemo(() => {
  //   return [...availableModels].sort((a, b) => {
  //     if (a.id === currentModelId) return -1;
  //     if (b.id === currentModelId) return 1;
  //     return 0; // Maintain original order for others
  //   });
  // }, [availableModels, currentModelId]);

  const handleSelect = async (modelId: string) => {
    onSelect?.();
    const defaultParams = getModelDefaultParameters(modelId);

    // Persist as default model
    updateSettings({ defaultModel: modelId });

    await createConversation(modelId, defaultParams);
  };

  return {
    models: availableModels,
    selectedModel,
    currentModelId,
    handleSelect,
  };
}
