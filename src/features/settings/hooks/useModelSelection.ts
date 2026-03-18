import { useEffect } from "react";

import { useConversationStore } from "@/features/chat";
import {
  DEFAULT_MODEL_ID,
  getModelDefaultParameters,
} from "@/shared/lib/models";

import { useSettingsStore } from "../store";

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

    updateSettings({ defaultModel: modelId });

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
