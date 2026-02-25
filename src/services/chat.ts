import { GoogleAPIClient } from "@/services/api";
import type { ProviderError } from "@/services/api/base";
import { RateLimiter } from "@/services/rateLimiter";
import type { FinishReason, Message, ModelParameters } from "@/types";

export interface ChatRequest {
  messages: Message[];
  modelId: string;
  parameters: ModelParameters;
  systemPrompt?: string;
  apiKey: string;
}

export interface ChatCallbacks {
  onChunk: (content: string) => void;
  onFinish: (finalContent: string, metadata: ChatMetadata) => void;
  onError: (error: string | ProviderError, partialContent?: string) => void;
}

export interface ChatMetadata {
  finishReason?: FinishReason;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export class ChatService {
  static async executeChat(
    request: ChatRequest,
    callbacks: ChatCallbacks,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    const { messages, modelId, parameters, systemPrompt, apiKey } = request;
    const { onChunk, onFinish, onError } = callbacks;
    const rateLimiter = new RateLimiter();

    const attempt = async (): Promise<void> => {
      let fullContent = "";

      try {
        if (!apiKey) {
          throw new Error("API key not found for Google provider");
        }

        const client = await GoogleAPIClient.createClient(apiKey);
        const stream = client.streamChat(
          {
            messages,
            model: modelId,
            parameters,
            systemPrompt,
          },
          abortSignal,
        );

        let lastMetadata: ChatMetadata = {};
        let lastUpdate = Date.now();

        for await (const chunk of stream) {
          if (abortSignal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          fullContent += chunk.delta;

          if (chunk.finishReason || chunk.usage) {
            lastMetadata = {
              finishReason: chunk.finishReason as FinishReason,
              usage: chunk.usage,
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
