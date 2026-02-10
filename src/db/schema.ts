export type MessageRole = "user" | "model" | "system";

export interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface FunctionResult {
  name: string;
  result: unknown;
  error?: string;
}

export interface Message {
  readonly id: string;
  role: MessageRole;
  content: string;
  readonly timestamp: number;
  metadata?: {
    model?: string;
    tokens?: number;
    finishReason?: "stop" | "length" | "function_call" | "content_filter";
  };
  functionCall?: FunctionCall;
  functionResult?: FunctionResult;
}

export interface ModelParameters {
  temperature: number;
  maxTokens: number;
  topP: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

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

export interface UIPreferences {
  theme: "light" | "dark" | "system";
  fontSize: "small" | "medium" | "large";
  codeTheme: string;
  showTokenCount: boolean;
  showCostEstimate: boolean;
}

export interface AppSettings {
  readonly id: "app-settings";
  apiKeys: Record<string, string>;
  defaultModel: string;
  defaultParameters: ModelParameters;
  uiPreferences: UIPreferences;
}

export interface JSONSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
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
