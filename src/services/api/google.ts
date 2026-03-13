import {
  ApiError,
  FinishReason as APIFinishReason,
  type FunctionCall as APIFunctionCall,
  GoogleGenAI,
  type Content,
  type GenerateContentConfig,
  type GenerateContentResponse,
} from "@google/genai";

import { getModelById, getUnknownModel, KNOWN_MODELS } from "@/lib/models";
import type {
  ChatRequest,
  ChatResponse,
  ErrorType,
  FinishReason,
  FunctionCall,
  LLMProvider,
  Message,
  ModelInfo,
  StreamChunk,
} from "@/types";
import { ProviderError } from "./base";
import {
  mapFunctionCallingModeToGoogleToolConfig,
  mapFunctionResultToGoogleResponse,
  mapFunctionsToGoogleTools,
} from "./functionMapping";

export class GoogleAPIClient implements LLMProvider {
  readonly id = "google";
  readonly name = "Google";

  private client: GoogleGenAI | null = null;
  private apiKey: string | null = null;

  private constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new GoogleGenAI({ apiKey });
  }

  static async createClient(apiKey: string): Promise<GoogleAPIClient> {
    await this.validateKey(apiKey).then((valid) => {
      if (!valid) {
        throw new Error("Invalid API key");
      }
    });

    return new GoogleAPIClient(apiKey);
  }

  static async validateKey(apiKey: string): Promise<boolean> {
    const client = new GoogleGenAI({ apiKey });

    // Use list models to validate key without consuming quota
    return await client.models
      .list()
      .then(() => true)
      .catch((error) => {
        if (!(error instanceof ApiError)) {
          throw error;
        }

        return false;
      });
  }

  async getModels(): Promise<ModelInfo[]> {
    return KNOWN_MODELS;
  }

  async getModel(id: string): Promise<ModelInfo> {
    const model = getModelById(id);
    if (model) {
      return model;
    }
    return getUnknownModel(id);
  }

  async countTokens(contents: string, modelId: string): Promise<number> {
    const client = this.getClient();
    return client.models
      .countTokens({ model: modelId, contents })
      .then((response) => response.totalTokens ?? 0);
  }

  async chat(
    request: ChatRequest,
    signal?: AbortSignal,
  ): Promise<ChatResponse> {
    try {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const client = this.getClient();
      const contents = this.mapMessagesToContent(request.messages);
      const config = this.buildGenerateContentConfig(request);

      // Create a race between the API call and the abort signal
      const responsePromise = client.models.generateContent({
        model: request.model,
        contents: contents,
        config: config,
      });

      if (signal) {
        let abortHandler: (() => void) | null = null;

        const abortPromise = new Promise<never>((_, reject) => {
          abortHandler = () =>
            reject(new DOMException("Aborted", "AbortError"));
          signal.addEventListener("abort", abortHandler);
        });

        try {
          // Use Promise.race to allow abortion
          const response = await Promise.race([responsePromise, abortPromise]);

          const functionCall = this.getMappedFunctionCall(response);
          const finishReason = this.mapFinishReasonWithFunctionCall(
            response.candidates?.[0]?.finishReason,
            functionCall,
          );

          // Handle result as usual
          if (!response || (!response.text && !functionCall)) {
            throw new Error("Empty response from Google API");
          }

          return {
            message: {
              id: crypto.randomUUID(),
              role: "model",
              content: response.text || "",
              timestamp: Date.now(),
              functionCall,
              metadata: {
                model: request.model,
                finishReason,
                usage: response.usageMetadata
                  ? {
                    inputTokens: response.usageMetadata.promptTokenCount,
                    outputTokens: response.usageMetadata.candidatesTokenCount,
                    totalTokens: response.usageMetadata.totalTokenCount,
                    thinkingTokens: response.usageMetadata.thoughtsTokenCount,
                    cachedTokens:
                      response.usageMetadata.cachedContentTokenCount,
                  }
                  : undefined,
              },
            },
            model: request.model,
            finishReason,
          };
        } finally {
          if (abortHandler) {
            signal.removeEventListener("abort", abortHandler);
          }
        }
      }

      const response = await responsePromise;
      const functionCall = this.getMappedFunctionCall(response);
      const finishReason = this.mapFinishReasonWithFunctionCall(
        response.candidates?.[0]?.finishReason,
        functionCall,
      );

      if (!response || (!response.text && !functionCall)) {
        throw new Error("Empty response from Google API");
      }

      return {
        message: {
          id: crypto.randomUUID(),
          role: "model",
          content: response.text || "",
          timestamp: Date.now(),
          functionCall,
          metadata: {
            model: request.model,
            finishReason,
            usage: response.usageMetadata
              ? {
                inputTokens: response.usageMetadata.promptTokenCount || 0,
                outputTokens:
                  response.usageMetadata.candidatesTokenCount || 0,
                totalTokens: response.usageMetadata.totalTokenCount || 0,
                thinkingTokens:
                  response.usageMetadata.thoughtsTokenCount || 0,
                cachedTokens:
                  response.usageMetadata.cachedContentTokenCount || 0,
              }
              : undefined,
          },
        },
        model: request.model,
        finishReason,
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async *streamChat(
    request: ChatRequest,
    signal?: AbortSignal,
  ): AsyncIterableIterator<StreamChunk> {
    try {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const client = this.getClient();
      const contents = this.mapMessagesToContent(request.messages);
      const config = this.buildGenerateContentConfig(request);

      const streamingResp = await client.models.generateContentStream({
        model: request.model,
        contents: contents,
        config: config,
      });

      for await (const chunk of streamingResp) {
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const functionCall = this.getMappedFunctionCall(chunk);

        yield {
          delta: chunk.text || "",
          finishReason: this.mapFinishReasonWithFunctionCall(
            chunk.candidates?.[0]?.finishReason,
            functionCall,
          ),
          functionCall,
          usage: chunk.usageMetadata
            ? {
              inputTokens: chunk.usageMetadata.promptTokenCount || 0,
              outputTokens: chunk.usageMetadata.candidatesTokenCount || 0,
              totalTokens: chunk.usageMetadata.totalTokenCount || 0,
              thinkingTokens: chunk.usageMetadata.thoughtsTokenCount || 0,
              cachedTokens: chunk.usageMetadata.cachedContentTokenCount || 0,
            }
            : undefined,
        };
      }
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  normalizeError(error: unknown): ProviderError {
    if (error instanceof DOMException && error.name === "AbortError") {
      return new ProviderError({
        type: "unknown",
        provider: "google",
        message: "Request cancelled by user",
        userMessage: "Request cancelled",
        retriable: false,
        originalError: error,
      });
    }

    let message =
      error instanceof Error ? error.message : "An unknown error occurred";

    const { message: nestedErrorMessage, code: nestedCode } =
      this.getNestedErrorMessage(message);
    message = nestedErrorMessage;

    // Use nested code if available, otherwise check for status/code on the error object
    const err = error as { status?: number; code?: number };
    const statusCode = nestedCode || err?.status || err?.code || 0;

    let type: ErrorType = "unknown";
    let retriable = false;

    // Map Google API error codes/messages to ErrorType
    if (
      statusCode === 401 ||
      statusCode === 403 ||
      message.includes("API key")
    ) {
      type = "auth";
    } else if (statusCode === 429) {
      if (message.includes("quota") || message.includes("Quota")) {
        type = "quota";
      } else {
        type = "rate_limit";
      }
      retriable = true;
    } else if (statusCode === 404 || message.includes("not found")) {
      type = "model_unavailable";
    } else if (statusCode >= 500) {
      type = "server";
      retriable = true;
    } else if (statusCode === 400) {
      if (message.includes("safety") || message.includes("Safety")) {
        type = "content_filter";
      } else if (
        message.includes("context length") ||
        message.includes("too many tokens")
      ) {
        type = "context_length";
      } else {
        type = "validation";
      }
    }

    // Network errors usually manifest as TypeError: fetch failed
    if (error instanceof TypeError && message.toLowerCase().includes("fetch")) {
      type = "network";
      retriable = true;
    }

    return new ProviderError({
      type,
      provider: "google",
      message,
      retriable: retriable || ProviderError.isRetriableType(type),
      originalError: error,
      statusCode: statusCode || undefined,
    });
  }

  private getClient(): GoogleGenAI {
    if (!this.apiKey || !this.client) {
      throw new Error("Client was not intialized properly");
    }

    return this.client;
  }

  private mapMessagesToContent(messages: Message[]): Content[] {
    return messages
      .map((message) => {
        const parts: NonNullable<Content["parts"]> = [];

        if (message.functionCall?.name) {
          parts.push({
            functionCall: {
              name: message.functionCall.name,
              args: message.functionCall.arguments,
            },
          });
        }

        if (message.functionResult?.name) {
          parts.push({
            functionResponse: mapFunctionResultToGoogleResponse(
              message.functionResult,
            ),
          });
        }

        if (!parts.length && message.content.trim()) {
          parts.push({ text: message.content });
        }

        return {
          role: message.role === "model" ? "model" : "user",
          parts,
        };
      })
      .filter((message) => message.parts.length > 0);
  }

  private buildGenerateContentConfig(
    request: ChatRequest,
  ): GenerateContentConfig {
    const config: GenerateContentConfig = {
      maxOutputTokens: request.parameters.maxTokens,
      temperature: request.parameters.temperature,
      topP: request.parameters.topP,
      topK: request.parameters.topK,
      stopSequences: request.parameters.stopSequences,
    };

    if (request.systemPrompt?.trim()) {
      config.systemInstruction = request.systemPrompt;
    }

    if (request.functions?.length) {
      config.tools = mapFunctionsToGoogleTools(request.functions);
      config.toolConfig = mapFunctionCallingModeToGoogleToolConfig(
        request.functionCallingMode,
      );
    }

    return config;
  }

  private mapFinishReason(reason: APIFinishReason | undefined): FinishReason {
    switch (reason) {
      case "STOP":
        return "stop";
      case "MAX_TOKENS":
        return "length";
      case "SAFETY":
        return "content_filter";
      case "RECITATION":
        return "content_filter";
      default:
        return "unknown";
    }
  }

  private mapFinishReasonWithFunctionCall(
    reason: APIFinishReason | undefined,
    functionCall?: FunctionCall,
  ): FinishReason {
    if (functionCall?.name) {
      return "function_call";
    }

    return this.mapFinishReason(reason);
  }

  private getMappedFunctionCall(
    response: GenerateContentResponse,
  ): FunctionCall | undefined {
    const functionCall = this.getFirstFunctionCall(response);

    if (!functionCall || !functionCall.name) {
      return undefined;
    }

    return {
      name: functionCall.name,
      arguments: functionCall.args || {},
    };
  }

  private getFirstFunctionCall(
    response: GenerateContentResponse,
  ): APIFunctionCall | undefined {
    if (response.functionCalls?.length) {
      return response.functionCalls[0];
    }

    return response.candidates?.[0]?.content?.parts?.find((part) =>
      Boolean(part.functionCall)
    )?.functionCall;
  }

  private getNestedErrorMessage(message: string): {
    message: string;
    code?: number;
  } {
    try {
      // 1. Extract potential JSON using Regex (matches everything between the first { and last })
      const jsonMatch = message.match(/\{.*\}/s);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const errorData = parsed.error || parsed; // Handle {error: {...}} or flat {...}

        if (errorData.message) {
          // Check if the extracted message is itself another JSON string
          const nested = this.getNestedErrorMessage(errorData.message);
          return {
            message: nested.message,
            code: errorData.code || nested.code,
          };
        }
      }
    } catch {
      // If parsing fails at any level, we've reached the "leaf" string
    }

    return { message };
  }
}
