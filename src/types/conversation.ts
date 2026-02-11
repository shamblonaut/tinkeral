export type MessageRole = "user" | "model" | "system";

export type FinishReason =
  | "stop"
  | "length"
  | "function_call"
  | "content_filter"
  | "unknown";

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
    finishReason?: FinishReason;
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

export interface ConversationSummary {
  readonly id: string;
  title: string;
  modelId: string;
  lastMessage?: string;
  updatedAt: number;
  messageCount: number;
}

export const DEFAULT_PARAMETERS: ModelParameters = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.95,
};
