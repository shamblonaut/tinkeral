import type { ProviderError } from "@/services/api/base";
import { GoogleAPIClient } from "@/services/api/google";
import { RateLimiter } from "@/services/rateLimiter";
import type {
  FinishReason,
  FunctionCallingMode,
  FunctionDefinition,
  Message,
  ModelParameters,
  ChatRequest as ProviderChatRequest,
  TokenUsage,
} from "@/types";

/**
 * Service-level chat request.
 *
 * Extends the provider `ChatRequest` semantics but adds `apiKey`
 * (needed to construct the client) and uses `modelId` for clarity.
 */
export interface ChatServiceRequest {
  messages: Message[];
  modelId: string;
  parameters: ModelParameters;
  systemPrompt?: string;
  apiKey: string;
  functions?: FunctionDefinition[];
  functionCallingMode?: FunctionCallingMode;
}

export interface ChatCallbacks {
  onChunk: (content: string) => void;
  onFinish: (finalContent: string, metadata: ChatMetadata) => void;
  onError: (error: string | ProviderError, partialContent?: string) => void;
}

export interface ChatMetadata {
  finishReason?: FinishReason;
  usage?: TokenUsage;
}

export class ChatService {
  static async executeChat(
    request: ChatServiceRequest,
    callbacks: ChatCallbacks,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    const {
      messages,
      modelId,
      parameters,
      systemPrompt,
      apiKey,
      functions,
      functionCallingMode,
    } = request;
    const { onChunk, onFinish, onError } = callbacks;
    const rateLimiter = new RateLimiter();

    const attempt = async (): Promise<void> => {
      let fullContent = "";

      try {
        if (!apiKey) {
          throw new Error("API key not found for Google provider");
        }

        const client = await GoogleAPIClient.createClient(apiKey);

        const providerRequest: ProviderChatRequest = {
          messages,
          model: modelId,
          parameters,
          systemPrompt,
          ...(functions?.length ? { functions, functionCallingMode } : {}),
        };

        const stream = client.streamChat(providerRequest, abortSignal);

        const lastMetadata: ChatMetadata = {};
        let lastUpdate = Date.now();

        for await (const chunk of stream) {
          if (abortSignal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          fullContent += chunk.delta;

          if (chunk.finishReason) {
            lastMetadata.finishReason = chunk.finishReason as FinishReason;
          }

          if (chunk.usage) {
            const lastUsage = lastMetadata.usage || {};
            lastMetadata.usage = {
              inputTokens:
                Math.max(
                  chunk.usage.inputTokens || 0,
                  lastUsage.inputTokens || 0,
                ) || undefined,
              outputTokens:
                Math.max(
                  chunk.usage.outputTokens || 0,
                  lastUsage.outputTokens || 0,
                ) || undefined,
              totalTokens:
                Math.max(
                  chunk.usage.totalTokens || 0,
                  lastUsage.totalTokens || 0,
                ) || undefined,
              thinkingTokens:
                Math.max(
                  chunk.usage.thinkingTokens || 0,
                  lastUsage.thinkingTokens || 0,
                ) || undefined,
              cachedTokens:
                Math.max(
                  chunk.usage.cachedTokens || 0,
                  lastUsage.cachedTokens || 0,
                ) || undefined,
            };
          }

          const now = Date.now();
          if (process.env.NODE_ENV === "test" || now - lastUpdate >= 16) {
            onChunk(fullContent);
            lastUpdate = now;
          }
        }

        await onFinish(fullContent, lastMetadata);
      } catch (error) {
        // Don't retry if aborted
        if (
          abortSignal?.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          onError(error as ProviderError | string, fullContent);
          return;
        }

        const delay = rateLimiter.getRetryDelay(error);
        if (delay !== null) {
          console.warn(`Chat attempt failed, retrying in ${delay}ms...`, error);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return attempt();
        }

        onError(error as ProviderError | string, fullContent);
      }
    };

    return attempt();
  }
}
