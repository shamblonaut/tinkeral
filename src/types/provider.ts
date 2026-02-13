import type { FunctionDefinition } from "@/db/schema";
import type { ProviderError } from "@/services/api/base";
import type { FinishReason, Message } from "./conversation";

/**
 * Information about a specific model
 */
export interface ModelInfo {
  readonly id: string; // e.g., 'gemini-pro'
  readonly name: string; // Display name
  readonly provider: string; // Provider id
  description?: string; // Brief description

  readonly contextWindow: number;
  readonly maxOutputTokens: number;
  capabilities: ModelCapabilities;
  isRecommended?: boolean; // Show in "popular" list
}

/**
 * Model capabilities - what features it supports
 */
export interface ModelCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  systemPrompt: boolean;
  vision: boolean;

  // Parameter ranges
  temperatureRange: [number, number];
  topPRange: [number, number];
  supportsTopK: boolean;
}

/**
 * Parameters that control model behavior.
 * Provider-specific parameters use optional fields.
 */
export interface ModelParameters {
  temperature: number; // 0.0 - 2.0 (provider dependent)
  maxTokens: number; // Max completion tokens
  topP: number; // 0.0 - 1.0
  topK?: number; // Google-specific
  frequencyPenalty?: number; // OpenAI-specific
  presencePenalty?: number; // OpenAI-specific
  stopSequences?: string[];
}

/**
 * Request to send to LLM provider
 */
export interface ChatRequest {
  messages: Message[];
  model: string;
  parameters: ModelParameters;
  systemPrompt?: string;
  functions?: FunctionDefinition[];
  stream?: boolean;
}

/**
 * Complete response from LLM provider
 */
export interface ChatResponse {
  message: Message;
  usage: TokenUsage;
  model: string;
  finishReason: FinishReason;
}

/**
 * Function call requested by the model
 */
export interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Single chunk in a streaming response
 */
export interface StreamChunk {
  delta: string; // New text content
  finishReason?: FinishReason;
  usage?: TokenUsage; // Only in final chunk
  functionCall?: Partial<FunctionCall>;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Error classification
 */
export type ErrorType =
  | "network" // Connection failed, timeout
  | "auth" // Invalid API key, permission denied
  | "rate_limit" // Too many requests
  | "validation" // Invalid request parameters
  | "server" // Provider server error (5xx)
  | "quota" // Quota exceeded
  | "model_unavailable" // Model doesn't exist or is disabled
  | "content_filter" // Content policy violation
  | "context_length" // Context too long
  | "unknown"; // Unexpected error

/**
 * Provider-agnostic interface for LLM APIs.
 * All providers must implement this interface.
 */
export interface LLMProvider {
  readonly id: string; // e.g., 'google', 'openai'
  readonly name: string; // e.g., 'Google'

  // Available models
  getModels(): Promise<ModelInfo[]>;

  /**
   * Get detailed information for a specific model.
   */
  getModel(id: string): Promise<ModelInfo>;

  /**
   * Send a chat request and get complete response.
   * Use for non-streaming scenarios.
   */
  chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>;

  /**
   * Send a chat request and stream response.
   * Returns async iterator of chunks.
   */
  streamChat(
    request: ChatRequest,
    signal?: AbortSignal,
  ): AsyncIterableIterator<StreamChunk>;

  /**
   * Estimate token count for the content.
   */
  countTokens(contents: string, modelId: string): Promise<number>;

  /**
   * Normalize provider-specific errors to common format.
   */
  normalizeError(error: unknown): ProviderError;
}
