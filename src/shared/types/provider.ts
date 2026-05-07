import type { FunctionDefinition } from "@/db/schema";
import type {
  FinishReason,
  FunctionCall,
  Message,
  ModelParameters,
  TokenUsage,
} from "./conversation";
import type { ProviderErrorLike } from "./error";

/**
 * Information about a specific model
 */
export interface ModelInfo {
  readonly id: string;
  readonly name: string;
  readonly provider: string; // 'google'
  readonly family: "gemini" | "gemma" | "imagen" | "veo" | "lyria" | "other";
  readonly tier?: "flash" | "pro" | "ultra" | "nano" | "fast" | "lite";
  readonly stage: "stable" | "preview" | "experimental" | "legacy";

  readonly description: string;

  // Technical Limits
  readonly contextWindow: {
    readonly input: number;
    readonly output: number;
  };

  // Features (Boolean Map)
  readonly capabilities: {
    // Input Modalities
    readonly imageInput: boolean;
    readonly videoInput: boolean;
    readonly audioInput: boolean;

    // Output Modalities
    readonly textGeneration: boolean;
    readonly imageGeneration: boolean;
    readonly videoGeneration: boolean;
    readonly speechGeneration: boolean; // TTS

    // Tools & Features
    readonly functionCalling: boolean;
    readonly codeExecution: boolean;
    readonly systemInstruction: boolean;
    readonly thinking?: boolean; // specialized thinking/reasoning
    readonly embedding?: boolean; // Can create embeddings
  };

  readonly defaultParameters?: Partial<ModelParameters>;
  readonly isRecommended?: boolean;
}

/**
 * Model capabilities - what features it supports
 * @deprecated Use ModelInfo.capabilities instead
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
 * Function calling mode — controls how the model uses attached tools.
 *
 * - `AUTO`  – Model decides whether to call a function (default).
 * - `ANY`   – Model must call at least one function.
 * - `NONE`  – Function declarations are sent for context but calls are disabled.
 */
export type FunctionCallingMode = "AUTO" | "ANY" | "NONE";

/**
 * Request to send to LLM provider
 */
export interface ChatRequest {
  messages: Message[];
  model: string;
  parameters: ModelParameters;
  systemPrompt?: string;
  functions?: FunctionDefinition[];
  functionCallingMode?: FunctionCallingMode;
  stream?: boolean;
}

/**
 * Complete response from LLM provider
 */
export interface ChatResponse {
  message: Message;
  model: string;
  finishReason: FinishReason;
}

/**
 * Single chunk in a streaming response
 */
export interface StreamChunk {
  delta: string; // New text content
  finishReason?: FinishReason;
  usage?: TokenUsage; // Only in final chunk
  functionCall?: Partial<FunctionCall>;
  thoughtSignature?: string;
}

export type { ErrorType } from "./error";

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
  normalizeError(error: unknown): ProviderErrorLike;
}
