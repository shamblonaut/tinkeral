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
