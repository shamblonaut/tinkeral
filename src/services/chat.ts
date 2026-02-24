import { GoogleAPIClient } from "@/services/api";
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
  onError: (error: unknown, partialContent?: string) => void;
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
        if (now - lastUpdate >= 16) {
          onChunk(fullContent);
          lastUpdate = now;
        }
      }

      onFinish(fullContent, lastMetadata);
    } catch (error) {
      onError(error, fullContent);
    }
  }
}
