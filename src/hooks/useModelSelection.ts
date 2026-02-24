import { DEFAULT_MODEL_ID, getModelDefaultParameters } from "@/lib/models";
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
    activeConversation?.modelId || settings?.defaultModel || DEFAULT_MODEL_ID;

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const selectedModel = availableModels.find((m) => m.id === currentModelId);

  const handleSelect = async (modelId: string) => {
    onSelect?.();
    const defaultParams = getModelDefaultParameters(modelId);

    // Persist as default model
    updateSettings({ defaultModel: modelId });

    // Check if current conversation is temporary (isTemporary)
    const isTemporary = activeConversation?.isTemporary;

    await createConversation(modelId, defaultParams, undefined, {
      isTemporary,
    });
  };

  return {
    models: availableModels,
    selectedModel,
    currentModelId,
    handleSelect,
  };
}
