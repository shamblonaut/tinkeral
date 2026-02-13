import type {
  JSONSchema,
  Message,
  ModelParameters,
  UIPreferences,
} from "@/types";

export interface Conversation {
  readonly id: string;
  title: string;
  messages: Message[];
  modelId: string;
  parameters: ModelParameters;
  systemPrompt?: string;
  readonly createdAt: number;
  updatedAt: number;
  metadata?: {
    totalTokens?: number;
    estimatedCost?: number;
  };
}

export interface AppSettings {
  readonly id: "app-settings";
  apiKeys: Record<string, string>;
  defaultModel: string;
  defaultParameters: ModelParameters;
  uiPreferences: UIPreferences;
}

export interface FunctionDefinition {
  readonly id: string;
  name: string;
  description: string;
  parameters: JSONSchema;
  implementation: string;
  readonly createdAt: number;
  updatedAt: number;
  timeout?: number;
  allowedAPIs?: string[];
}
