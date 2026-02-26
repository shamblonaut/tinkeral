import { ApiError } from "@google/genai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KNOWN_MODELS } from "@/lib/models";
import { DEFAULT_PARAMETERS, type ChatRequest } from "@/types";
import { GoogleAPIClient } from "../google";

const mocks = vi.hoisted(() => {
  return {
    mockGenerateContent: vi.fn(),
    mockGenerateContentStream: vi.fn(),
    mockCountTokens: vi.fn(),
    mockGetModel: vi.fn(),
    mockListModels: vi.fn(),
  };
});

// Mock the Google GenAI SDK
vi.mock("@google/genai", () => {
  // Mock implementation of GoogleGenAI class
  const GoogleGenAI = vi.fn(function () {
    return {
      models: {
        generateContent: mocks.mockGenerateContent,
        generateContentStream: mocks.mockGenerateContentStream,
        countTokens: mocks.mockCountTokens,
        get: mocks.mockGetModel,
        list: mocks.mockListModels,
      },
    };
  });

  const ApiError = class extends Error {
    status: number;
    constructor(options: { message: string; status?: number }) {
      super(options.message);
      this.name = "ApiError";
      this.status = options.status || 500;
    }
  };

  return {
    GoogleGenAI,
    ApiError,
  };
});

describe("GoogleAPIClient", () => {
  const apiKey = "test-api-key";
  let client: GoogleAPIClient;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup successful validation for createClient
    mocks.mockListModels.mockResolvedValue([]);

    client = await GoogleAPIClient.createClient(apiKey);
  });

  describe("Initialization & Validation", () => {
    it("should create a client with valid API key", async () => {
      mocks.mockListModels.mockResolvedValue([]);
      const newClient = await GoogleAPIClient.createClient("valid-key");
      expect(newClient).toBeInstanceOf(GoogleAPIClient);
      expect(mocks.mockListModels).toHaveBeenCalled();
    });

    it("should throw error with invalid API key", async () => {
      mocks.mockListModels.mockRejectedValue(
        new ApiError({ message: "Invalid key", status: 400 }),
      );
      await expect(GoogleAPIClient.createClient("invalid-key")).rejects.toThrow(
        "Invalid API key",
      );
    });

    it("validateKey should return true for valid key", async () => {
      mocks.mockListModels.mockResolvedValue([]);
      const isValid = await GoogleAPIClient.validateKey("valid-key");
      expect(isValid).toBe(true);
    });

    it("validateKey should return false for invalid key", async () => {
      mocks.mockListModels.mockRejectedValue(
        new ApiError({ message: "Invalid key", status: 400 }),
      );
      const isValid = await GoogleAPIClient.validateKey("invalid-key");
      expect(isValid).toBe(false);
    });
  });

  describe("Model Management", () => {
    it("getModels should return known models from registry", async () => {
      const models = await client.getModels();
      expect(models).toBe(KNOWN_MODELS);
    });

    it("getModel should return model from registry", async () => {
      const model = await client.getModel("gemini-2.5-pro");
      expect(model).toBeDefined();
      expect(model.id).toBe("gemini-2.5-pro");
      expect(model.name).toBe("Gemini 2.5 Pro");
    });

    it("getModel should return unknown model for missing id", async () => {
      const model = await client.getModel("unknown-model-id");
      expect(model).toBeDefined();
      expect(model.id).toBe("unknown-model-id");
      expect(model.stage).toBe("experimental");
    });
  });

  describe("Token Counting", () => {
    it("countTokens should return total tokens", async () => {
      mocks.mockCountTokens.mockResolvedValue({ totalTokens: 100 });
      const count = await client.countTokens("hello world", "gemini-pro");
      expect(mocks.mockCountTokens).toHaveBeenCalledWith({
        model: "gemini-pro",
        contents: "hello world",
      });
      expect(count).toBe(100);
    });
  });

  describe("Chat", () => {
    const mockRequest: ChatRequest = {
      messages: [{ id: "1", role: "user", content: "Hello", timestamp: 1 }],
      model: "gemini-pro",
      parameters: DEFAULT_PARAMETERS,
    };

    it("chat should return formatted response", async () => {
      const mockResponse = {
        text: "Hi there!",
        candidates: [{ finishReason: "STOP" }],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      };

      mocks.mockGenerateContent.mockResolvedValue(mockResponse);

      const response = await client.chat(mockRequest);

      // Verify request config
      expect(mocks.mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gemini-pro",
          contents: [
            {
              role: "user",
              parts: [{ text: "Hello" }],
            },
          ],
          config: expect.objectContaining({
            temperature: DEFAULT_PARAMETERS.temperature,
            maxOutputTokens: DEFAULT_PARAMETERS.maxTokens,
          }),
        }),
      );

      // Verify response mapping
      expect(response.message.content).toBe("Hi there!");
      expect(response.message.role).toBe("model");
      expect(response.message.metadata?.usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        thinkingTokens: 0,
        cachedTokens: 0,
      });
      expect(response.finishReason).toBe("stop");
    });

    it("chat should handle errors", async () => {
      mocks.mockGenerateContent.mockRejectedValue(new Error("API Error"));
      await expect(client.chat(mockRequest)).rejects.toMatchObject({
        type: "unknown",
        message: expect.stringContaining("API Error"),
      });
    });

    it("chat should handle empty response", async () => {
      mocks.mockGenerateContent.mockResolvedValue({ text: null });
      await expect(client.chat(mockRequest)).rejects.toThrow("Empty response");
    });

    it("chat should include system prompt if provided", async () => {
      const requestWithSystem: ChatRequest = {
        ...mockRequest,
        systemPrompt: "You are helpful",
      };

      mocks.mockGenerateContent.mockResolvedValue({ text: "ok" });

      await client.chat(requestWithSystem);

      expect(mocks.mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            systemInstruction: "You are helpful",
          }),
        }),
      );
    });
  });

  describe("Streaming Chat", () => {
    const mockRequest: ChatRequest = {
      messages: [{ id: "1", role: "user", content: "Hello", timestamp: 1 }],
      model: "gemini-pro",
      parameters: DEFAULT_PARAMETERS,
    };

    it("streamChat should yield chunks", async () => {
      // Create a mock generator
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            text: "Hello",
            candidates: [{ finishReason: undefined }],
          };
          yield {
            text: " World",
            candidates: [{ finishReason: "STOP" }],
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 5,
              totalTokenCount: 15,
            },
          };
        },
      };

      mocks.mockGenerateContentStream.mockResolvedValue(mockStream);

      const chunks = [];
      for await (const chunk of client.streamChat(mockRequest)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0].delta).toBe("Hello");
      expect(chunks[1].delta).toBe(" World");
      expect(chunks[1].finishReason).toBe("stop");
      expect(chunks[1].usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        thinkingTokens: 0,
        cachedTokens: 0,
      });
    });

    it("streamChat should handle errors", async () => {
      mocks.mockGenerateContentStream.mockRejectedValue(
        new Error("Stream Error"),
      );
      const generator = client.streamChat(mockRequest);
      await expect(generator.next()).rejects.toMatchObject({
        message: expect.stringContaining("Stream Error"),
      });
    });
  });

  describe("Error Normalization", () => {
    it("should normalize 401 as auth error", () => {
      const error = new ApiError({ message: "Invalid key", status: 401 });
      const normalized = client.normalizeError(error);
      expect(normalized.type).toBe("auth");
      expect(normalized.retriable).toBe(false);
    });

    it("should normalize 429 as rate_limit error", () => {
      const error = new ApiError({ message: "Too many requests", status: 429 });
      const normalized = client.normalizeError(error);
      expect(normalized.type).toBe("rate_limit");
      expect(normalized.retriable).toBe(true);
    });

    it("should normalize quota error message as quota type", () => {
      const error = new ApiError({
        message: "Your quota is exceeded",
        status: 429,
      });
      const normalized = client.normalizeError(error);
      expect(normalized.type).toBe("quota");
      expect(normalized.retriable).toBe(true);
    });

    it("should normalize safety-related 400 as content_filter", () => {
      const error = new ApiError({ message: "Safety filters", status: 400 });
      const normalized = client.normalizeError(error);
      expect(normalized.type).toBe("content_filter");
    });

    it("should normalize context window 400 as context_length", () => {
      const error = new ApiError({ message: "too many tokens", status: 400 });
      const normalized = client.normalizeError(error);
      expect(normalized.type).toBe("context_length");
    });
  });
});
