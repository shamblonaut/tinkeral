import {
  DEFAULT_PARAMETERS,
  type ModelInfo,
  type ModelParameters,
} from "@/types";
import { GOOGLE_MODELS } from "./google";

export const DEFAULT_MODEL_ID = "gemini-2.5-flash-lite";

export const KNOWN_MODELS: ModelInfo[] = [...GOOGLE_MODELS];

export function getModelById(id: string): ModelInfo | undefined {
  return KNOWN_MODELS.find((m) => m.id === id);
}

export function getUnknownModel(id: string): ModelInfo {
  return {
    id,
    name: id,
    provider: "google",
    family: "other",
    stage: "experimental",
    description: "Unknown model",
    contextWindow: { input: 8_192, output: 2_048 },
    capabilities: {
      imageInput: false,
      videoInput: false,
      audioInput: false,
      textGeneration: true,
      imageGeneration: false,
      videoGeneration: false,
      speechGeneration: false,
      functionCalling: false,
      codeExecution: false,
      systemInstruction: true,
      thinking: false,
      embedding: false,
    },
  };
}

/**
 * Returns the default parameters for a given model.
 * Merges the model-specific defaults from KNOWN_MODELS with the global DEFAULT_PARAMETERS.
 */
export function getModelDefaultParameters(modelId: string): ModelParameters {
  const model = getModelById(modelId);
  if (!model || !model.defaultParameters) {
    return DEFAULT_PARAMETERS;
  }

  return {
    ...DEFAULT_PARAMETERS,
    ...model.defaultParameters,
  };
}
