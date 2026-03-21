import { ApiError } from "@google/genai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KNOWN_MODELS } from "@/shared/lib/models";
import { DEFAULT_PARAMETERS, type ChatRequest } from "@/shared/types";

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
vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();

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
    ...actual,
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
    it("should throw error with invalid API key", async () => {
      mocks.mockListModels.mockRejectedValue(
        new ApiError({ message: "Invalid key", status: 400 }),
      );
      await expect(GoogleAPIClient.createClient("invalid-key")).rejects.toThrow(
        "Invalid API key",
      );
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
    const functionDefinition = {
      id: "fn-1",
      name: "get_weather",
      description: "Get weather data",
      parameters: {
        type: "object" as const,
        properties: {
          city: {
            type: "string" as const,
          },
        },
        required: ["city"],
      },
      implementation: "return { city: args.city };",
      createdAt: 1,
      updatedAt: 1,
    };

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

    it("chat should include function tools when functions are provided", async () => {
      const requestWithFunctions: ChatRequest = {
        ...mockRequest,
        functions: [functionDefinition],
        functionCallingMode: "ANY",
      };

      mocks.mockGenerateContent.mockResolvedValue({ text: "ok" });

      await client.chat(requestWithFunctions);

      expect(mocks.mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            tools: [
              {
                functionDeclarations: [
                  expect.objectContaining({ name: "get_weather" }),
                ],
              },
            ],
            toolConfig: expect.objectContaining({
              functionCallingConfig: expect.objectContaining({ mode: "ANY" }),
            }),
          }),
        }),
      );
    });

    it("chat should map function calls and set function_call finish reason", async () => {
      mocks.mockGenerateContent.mockResolvedValue({
        text: "",
        functionCalls: [
          {
            id: "call-123",
            name: "get_weather",
            args: { city: "Tokyo" },
          },
        ],
        candidates: [{ finishReason: "STOP" }],
      });

      const response = await client.chat(mockRequest);

      expect(response.finishReason).toBe("function_call");
      expect(response.message.metadata?.finishReason).toBe("function_call");
      expect(response.message.functionCall).toEqual({
        id: "call-123",
        name: "get_weather",
        arguments: { city: "Tokyo" },
      });
      expect(response.message.content).toBe("");
    });

    it("chat should send message content and function call/result as structured parts", async () => {
      const requestWithToolTurns: ChatRequest = {
        ...mockRequest,
        messages: [
          {
            id: "m1",
            role: "model",
            content: "I will check the weather for you.",
            timestamp: 1,
            functionCall: {
              id: "call-1",
              name: "get_weather",
              arguments: { city: "Tokyo" },
            },
          },
          {
            id: "m2",
            role: "user",
            content: "",
            timestamp: 2,
            functionResult: {
              id: "call-1",
              name: "get_weather",
              result: { temp: 22 },
            },
          },
        ],
      };

      mocks.mockGenerateContent.mockResolvedValue({ text: "ok" });

      await client.chat(requestWithToolTurns);

      expect(mocks.mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: [
            expect.objectContaining({
              role: "model",
              parts: expect.arrayContaining([
                expect.objectContaining({
                  text: "I will check the weather for you.",
                }),
                expect.objectContaining({
                  functionCall: expect.objectContaining({
                    id: "call-1",
                    name: "get_weather",
                  }),
                }),
              ]),
            }),
            expect.objectContaining({
              role: "user",
              parts: expect.arrayContaining([
                expect.objectContaining({
                  functionResponse: expect.objectContaining({
                    id: "call-1",
                    name: "get_weather",
                  }),
                }),
              ]),
            }),
          ],
        }),
      );
    });

    it("should merge consecutive messages of the same role", async () => {
      const requestWithConsecutiveRoles: ChatRequest = {
        messages: [
          { id: "1", role: "user", content: "Message 1", timestamp: 1 },
          { id: "2", role: "user", content: "Message 2", timestamp: 2 },
          { id: "3", role: "model", content: "Response 1", timestamp: 3 },
          { id: "4", role: "model", content: "Response 2", timestamp: 4 },
        ],
        model: "gemini-pro",
        parameters: DEFAULT_PARAMETERS,
      };

      mocks.mockGenerateContent.mockResolvedValue({ text: "ok" });

      await client.chat(requestWithConsecutiveRoles);

      expect(mocks.mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: [
            {
              role: "user",
              parts: [{ text: "Message 1" }, { text: "Message 2" }],
            },
            {
              role: "model",
              parts: [{ text: "Response 1" }, { text: "Response 2" }],
            },
          ],
        }),
      );
    });

    it("should map finish reasons correctly", async () => {
      mocks.mockGenerateContent.mockResolvedValue({
        text: "Incomplete",
        candidates: [{ finishReason: "MAX_TOKENS" }],
      });
      let res = await client.chat(mockRequest);
      expect(res.finishReason).toBe("length");

      mocks.mockGenerateContent.mockResolvedValue({
        text: "Filtered",
        candidates: [{ finishReason: "SAFETY" }],
      });
      res = await client.chat(mockRequest);
      expect(res.finishReason).toBe("content_filter");

      mocks.mockGenerateContent.mockResolvedValue({
        text: "Recitation",
        candidates: [{ finishReason: "RECITATION" }],
      });
      res = await client.chat(mockRequest);
      expect(res.finishReason).toBe("content_filter");
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

    it("streamChat should yield functionCall and preserve text in same chunk", async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            text: "Calling tool...",
            functionCalls: [
              {
                name: "get_weather",
                args: { city: "Paris" },
              },
            ],
            candidates: [{ finishReason: "STOP" }],
          };
        },
      };

      mocks.mockGenerateContentStream.mockResolvedValue(mockStream);

      const chunks = [];
      for await (const chunk of client.streamChat(mockRequest)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual(
        expect.objectContaining({
          delta: "Calling tool...",
          finishReason: "function_call",
          functionCall: {
            name: "get_weather",
            arguments: { city: "Paris" },
          },
        }),
      );
    });
  });

  describe("Error Normalization", () => {
    it("should normalize 401 as auth error", () => {
      const error = new ApiError({ message: "Invalid key", status: 401 });
      const normalized = client.normalizeError(error);
      expect(normalized.type).toBe("auth");
      expect(normalized.retriable).toBe(false);
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

    it("should handle nested JSON error messages", () => {
      const nestedError = new Error(
        'Some prefix {"error": {"message": "{\\"error\\": {\\"message\\": \\"deeply nested\\", \\"code\\": 401}}", "code": 403}}',
      );
      const normalized = client.normalizeError(nestedError);
      expect(normalized.message).toBe("deeply nested");
      expect(normalized.type).toBe("auth");
      expect(normalized.statusCode).toBe(401);
    });
  });
});
