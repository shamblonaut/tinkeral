import { beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleAPIClient } from "@/services/api/google";
import type { ChatRequest as ProviderChatRequest } from "@/types";
import { DEFAULT_PARAMETERS } from "@/types";

import { ChatService } from "../chat";

const mocks = vi.hoisted(() => {
  return {
    mockCreateClient: vi.fn(),
    mockStreamChat: vi.fn(),
    mockExecutorExecute: vi.fn(),
    mockExecutorTerminate: vi.fn(),
  };
});

vi.mock("@/services/api/google", () => {
  return {
    GoogleAPIClient: {
      createClient: mocks.mockCreateClient,
    },
  };
});

vi.mock("@/services/executor", () => {
  class MockFunctionExecutor {
    execute = mocks.mockExecutorExecute;
    terminate = mocks.mockExecutorTerminate;
  }

  return {
    FunctionExecutor: MockFunctionExecutor,
  };
});

describe("ChatService function call loop", () => {
  const baseRequest = {
    messages: [
      {
        id: "u-1",
        role: "user" as const,
        content: "What's the weather in Tokyo?",
        timestamp: 1,
      },
    ],
    modelId: "gemini-2.5-flash",
    parameters: DEFAULT_PARAMETERS,
    apiKey: "test-api-key",
    functions: [
      {
        id: "f-1",
        name: "get_weather",
        description: "Get weather",
        parameters: {
          type: "object" as const,
          properties: {
            city: { type: "string" as const },
          },
          required: ["city"],
        },
        implementation: "return { temp: 22, condition: 'sunny' };",
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes function call and continues chat with function result", async () => {
    mocks.mockStreamChat
      .mockImplementationOnce(async function* () {
        yield {
          delta: "",
          finishReason: "function_call",
          functionCall: {
            name: "get_weather",
            arguments: { city: "Tokyo" },
          },
          usage: { inputTokens: 8, outputTokens: 3, totalTokens: 11 },
        };
      })
      .mockImplementationOnce(async function* () {
        yield {
          delta: "It's sunny in Tokyo.",
          finishReason: "stop",
          usage: { inputTokens: 12, outputTokens: 6, totalTokens: 18 },
        };
      });

    mocks.mockCreateClient.mockResolvedValue({
      streamChat: mocks.mockStreamChat,
    } as unknown as GoogleAPIClient);

    mocks.mockExecutorExecute.mockResolvedValue({
      success: true,
      data: { temp: 22, condition: "sunny" },
      executionTime: 5,
      consoleLogs: [],
    });

    const onChunk = vi.fn();
    const onFunctionCall = vi.fn();
    const onFunctionResult = vi.fn();
    const onFinish = vi.fn();
    const onError = vi.fn();

    await ChatService.executeChat(baseRequest, {
      onChunk,
      onFunctionCall,
      onFunctionResult,
      onFinish,
      onError,
    });

    expect(onError).not.toHaveBeenCalled();
    expect(mocks.mockStreamChat).toHaveBeenCalledTimes(2);

    expect(onFunctionCall).toHaveBeenCalledWith({
      name: "get_weather",
      arguments: { city: "Tokyo" },
    });

    expect(onFunctionResult).toHaveBeenCalledWith({
      name: "get_weather",
      result: { temp: 22, condition: "sunny" },
      executionTime: 5,
    });

    expect(onFinish).toHaveBeenCalledWith("It's sunny in Tokyo.", {
      finishReason: "stop",
      usage: { inputTokens: 12, outputTokens: 6, totalTokens: 18 },
    });

    const secondRequest = mocks.mockStreamChat.mock.calls[1][0] as
      | ProviderChatRequest
      | undefined;
    expect(secondRequest?.messages.some((m) => Boolean(m.functionCall))).toBe(
      true,
    );
    expect(secondRequest?.messages.some((m) => Boolean(m.functionResult))).toBe(
      true,
    );
  });

  it("sends function error result when function is missing", async () => {
    mocks.mockStreamChat
      .mockImplementationOnce(async function* () {
        yield {
          delta: "",
          finishReason: "function_call",
          functionCall: {
            name: "missing_function",
            arguments: { value: 1 },
          },
        };
      })
      .mockImplementationOnce(async function* () {
        yield {
          delta: "I could not run that function.",
          finishReason: "stop",
        };
      });

    mocks.mockCreateClient.mockResolvedValue({
      streamChat: mocks.mockStreamChat,
    } as unknown as GoogleAPIClient);

    const onFunctionResult = vi.fn();

    await ChatService.executeChat(baseRequest, {
      onChunk: vi.fn(),
      onFunctionCall: vi.fn(),
      onFunctionResult,
      onFinish: vi.fn(),
      onError: vi.fn(),
    });

    expect(mocks.mockExecutorExecute).not.toHaveBeenCalled();
    expect(onFunctionResult).toHaveBeenCalledWith({
      name: "missing_function",
      result: null,
      error: "Function not found: missing_function",
    });
  });

  it("handles sequential function calls before final response", async () => {
    mocks.mockStreamChat
      .mockImplementationOnce(async function* () {
        yield {
          delta: "",
          finishReason: "function_call",
          functionCall: {
            name: "get_weather",
            arguments: { city: "Tokyo" },
          },
        };
      })
      .mockImplementationOnce(async function* () {
        yield {
          delta: "",
          finishReason: "function_call",
          functionCall: {
            name: "get_weather",
            arguments: { city: "Osaka" },
          },
        };
      })
      .mockImplementationOnce(async function* () {
        yield {
          delta: "Tokyo and Osaka are both sunny.",
          finishReason: "stop",
        };
      });

    mocks.mockCreateClient.mockResolvedValue({
      streamChat: mocks.mockStreamChat,
    } as unknown as GoogleAPIClient);

    mocks.mockExecutorExecute
      .mockResolvedValueOnce({
        success: true,
        data: { city: "Tokyo", condition: "sunny" },
        executionTime: 5,
        consoleLogs: [],
      })
      .mockResolvedValueOnce({
        success: true,
        data: { city: "Osaka", condition: "sunny" },
        executionTime: 5,
        consoleLogs: [],
      });

    const onFinish = vi.fn();

    await ChatService.executeChat(baseRequest, {
      onChunk: vi.fn(),
      onFunctionCall: vi.fn(),
      onFunctionResult: vi.fn(),
      onFinish,
      onError: vi.fn(),
    });

    expect(mocks.mockStreamChat).toHaveBeenCalledTimes(3);
    expect(mocks.mockExecutorExecute).toHaveBeenCalledTimes(2);
    expect(onFinish).toHaveBeenCalledWith(
      "Tokyo and Osaka are both sunny.",
      expect.objectContaining({ finishReason: "stop" }),
    );
  });
});
