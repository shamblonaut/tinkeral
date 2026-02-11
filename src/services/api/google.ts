import {
  FinishReason as APIFinishReason,
  GoogleGenAI,
  type Content,
  type GenerateContentConfig,
  type Model,
} from "@google/genai";
import type { FinishReason, Message } from "../../types/conversation";
import type {
  ChatRequest,
  ChatResponse,
  LLMProvider,
  ModelInfo,
  NormalizedError,
  StreamChunk,
} from "../../types/provider";
import { normalizeError as normalizeBaseError } from "./base";

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
    if (!(await this.validateKey(apiKey))) {
      throw new Error("Invalid API key");
    }

    return new GoogleAPIClient(apiKey);
  }

  static async validateKey(apiKey: string): Promise<boolean> {
    const client = new GoogleGenAI({ apiKey });

    // Use list models to validate key without consuming quota
    return await client.models
      .list()
      .then(() => true)
      .catch(() => false);
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const client = this.getClient();
      const response = await client.models.list();

      const models: ModelInfo[] = [];
      for await (const model of response) {
        models.push(this.getModelInfo(model));
      }

      return models;
    } catch (error) {
      throw new Error("Failed to list models: " + error);
    }
  }

  async getModel(id: string): Promise<ModelInfo> {
    const client = this.getClient();
    return this.getModelInfo(await client.models.get({ model: id }));
  }

  async countTokens(contents: string, modelId: string): Promise<number> {
    const client = this.getClient();
    return client.models
      .countTokens({ model: modelId, contents })
      .then((response) => response.totalTokens ?? 0);
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const client = this.getClient();
      const contents = this.mapMessagesToContent(request.messages);

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

      const response = await client.models.generateContent({
        model: request.model,
        contents: contents,
        config: config,
      });

      if (!response || !response.text) {
        throw new Error("Empty response from Google API");
      }

      return {
        message: {
          id: crypto.randomUUID(),
          role: "model",
          content: response.text || "",
          timestamp: Date.now(),
          metadata: {
            model: request.model,
            finishReason: this.mapFinishReason(
              response.candidates?.[0]?.finishReason,
            ),
            tokens: response.usageMetadata?.totalTokenCount || 0,
          },
        },
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0,
        },
        model: request.model,
        finishReason: this.mapFinishReason(
          response.candidates?.[0]?.finishReason,
        ),
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async *streamChat(request: ChatRequest): AsyncIterableIterator<StreamChunk> {
    try {
      const client = this.getClient();
      const contents = this.mapMessagesToContent(request.messages);

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

      const streamingResp = await client.models.generateContentStream({
        model: request.model,
        contents: contents,
        config: config,
      });

      for await (const chunk of streamingResp) {
        yield {
          delta: chunk.text || "",
          finishReason: this.mapFinishReason(
            chunk.candidates?.[0]?.finishReason,
          ),
          usage: chunk.usageMetadata
            ? {
                promptTokens: chunk.usageMetadata.promptTokenCount || 0,
                completionTokens: chunk.usageMetadata.candidatesTokenCount || 0,
                totalTokens: chunk.usageMetadata.totalTokenCount || 0,
              }
            : undefined,
        };
      }
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  normalizeError(error: unknown): NormalizedError {
    return normalizeBaseError(error, this.id);
  }

  private getClient(): GoogleGenAI {
    if (!this.apiKey || !this.client) {
      throw new Error("Client was not intialized properly");
    }

    return this.client;
  }

  private getModelInfo(model: Model): ModelInfo {
    return {
      id: model.name?.replace(/^models\//, "") || model.name || "unknown",
      name: model.displayName || model.name || "Unknown Model",
      provider: "google",
      description: model.description || "",
      contextWindow: model.inputTokenLimit || 0,
      maxOutputTokens: model.outputTokenLimit || 0,
      capabilities: {
        streaming: Boolean(model.supportedActions?.includes("generateContent")),
        functionCalling: Boolean(
          model.supportedActions?.includes("generateContent") &&
          /gemini/.test(model.name ?? "") &&
          !/tts|image/.test(model.name ?? ""),
        ),
        systemPrompt: Boolean(
          model.supportedActions?.includes("generateContent") &&
          /gemini/.test(model.name ?? "") &&
          !/tts|image/.test(model.name ?? ""),
        ),
        vision: Boolean(!/imagen|tts|embedding|aqa/.test(model.name ?? "")),

        temperatureRange: [0, model.maxTemperature || 2],
        topPRange: [0, 1], // Standard
        supportsTopK: true, // Standard for Gemini
      },
    };
  }

  private mapMessagesToContent(messages: Message[]): Content[] {
    return messages
      .map((m) => ({
        role: m.role === "model" ? "model" : "user",
        parts: [{ text: m.content }],
      }))
      .filter((m) => m.parts[0].text.trim() !== "");
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
}
