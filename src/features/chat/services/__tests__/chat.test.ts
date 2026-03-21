import { beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleAPIClient } from "@/shared/services/api";
import {
  DEFAULT_PARAMETERS,
  type ChatRequest as ProviderChatRequest,
} from "@/shared/types";

import { ChatService } from "../chat";

const mocks = vi.hoisted(() => {
  return {
    mockCreateClient: vi.fn(),
    mockStreamChat: vi.fn(),
    mockExecutorExecute: vi.fn(),
    mockExecutorTerminate: vi.fn(),
  };
});

vi.mock("@/shared/services/api/google", () => {
  return {
    GoogleAPIClient: {
      createClient: mocks.mockCreateClient,
    },
  };
});

vi.mock("@/features/functions/services/executor", () => {
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
            id: "call-999",
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
      id: "call-999",
      name: "get_weather",
      arguments: { city: "Tokyo" },
    });

    expect(onFunctionResult).toHaveBeenCalledWith({
      id: "call-999",
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

  it("returns a graceful error when function arguments do not match schema", async () => {
    mocks.mockStreamChat
      .mockImplementationOnce(async function* () {
        yield {
          delta: "",
          finishReason: "function_call",
          functionCall: {
            name: "get_weather",
            arguments: { city: 123 },
          },
        };
      })
      .mockImplementationOnce(async function* () {
        yield {
          delta: "I could not run that with those arguments.",
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
    expect(onFunctionResult).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "get_weather",
        result: null,
        error: 'Invalid function arguments: parameter "city" must be a string.',
      }),
    );
  });

  it("truncates oversized function results before sending them back", async () => {
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
          delta: "Received a large function result.",
          finishReason: "stop",
        };
      });

    mocks.mockCreateClient.mockResolvedValue({
      streamChat: mocks.mockStreamChat,
    } as unknown as GoogleAPIClient);

    mocks.mockExecutorExecute.mockResolvedValue({
      success: true,
      data: { payload: "x".repeat(120 * 1024) },
      executionTime: 8,
      consoleLogs: [],
    });

    const onFunctionResult = vi.fn();

    await ChatService.executeChat(baseRequest, {
      onChunk: vi.fn(),
      onFunctionCall: vi.fn(),
      onFunctionResult,
      onFinish: vi.fn(),
      onError: vi.fn(),
    });

    expect(onFunctionResult).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "get_weather",
        result: expect.objectContaining({
          truncated: true,
          originalSizeBytes: expect.any(Number),
        }),
      }),
    );
  });

  it("handles 'stop' finish reason when a function call is present", async () => {
    // This reproduces the cancellation issue where certain models
    // send a function call but finish with 'stop' instead of 'function_call'
    mocks.mockStreamChat
      .mockImplementationOnce(async function* () {
        yield {
          delta: "",
          finishReason: "stop",
          functionCall: {
            name: "get_weather",
            arguments: { city: "London" },
          },
        };
      })
      .mockImplementationOnce(async function* () {
        yield {
          delta: "It's rainy in London.",
          finishReason: "stop",
        };
      });

    mocks.mockCreateClient.mockResolvedValue({
      streamChat: mocks.mockStreamChat,
    } as unknown as GoogleAPIClient);

    mocks.mockExecutorExecute.mockResolvedValue({
      success: true,
      data: { temp: 15, condition: "rainy" },
      executionTime: 5,
      consoleLogs: [],
    });

    const onFunctionCall = vi.fn();
    const onFinish = vi.fn();

    await ChatService.executeChat(baseRequest, {
      onChunk: vi.fn(),
      onFunctionCall,
      onFunctionResult: vi.fn(),
      onFinish,
      onError: vi.fn(),
    });

    expect(mocks.mockStreamChat).toHaveBeenCalledTimes(2);
    expect(onFunctionCall).toHaveBeenCalledWith(
      expect.objectContaining({ name: "get_weather" }),
    );
    expect(onFinish).toHaveBeenCalledWith(
      "It's rainy in London.",
      expect.objectContaining({ finishReason: "stop" }),
    );
  });

  it("truncates extremely long error messages", async () => {
    mocks.mockStreamChat
      .mockImplementationOnce(async function* () {
        yield {
          delta: "",
          finishReason: "function_call",
          functionCall: { name: "get_weather", arguments: { city: "Tokyo" } },
        };
      })
      .mockImplementationOnce(async function* () {
        yield { delta: "Long error handled.", finishReason: "stop" };
      });

    mocks.mockCreateClient.mockResolvedValue({
      streamChat: mocks.mockStreamChat,
    } as unknown as GoogleAPIClient);

    const longError = "x".repeat(3000);
    mocks.mockExecutorExecute.mockResolvedValue({
      success: false,
      error: { message: longError },
      executionTime: 5,
      consoleLogs: [],
    });

    const onFunctionResult = vi.fn();

    await ChatService.executeChat(baseRequest, {
      onChunk: vi.fn(),
      onFunctionCall: vi.fn(),
      onFunctionResult,
      onFinish: vi.fn(),
      onError: vi.fn(),
    });

    expect(onFunctionResult).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("(truncated)"),
      }),
    );
    expect(onFunctionResult.mock.calls[0][0].error.length).toBeLessThan(
      longError.length,
    );
  });

  it("fails when function-call loop exceeds max iterations", async () => {
    mocks.mockStreamChat.mockImplementation(async function* () {
      yield {
        delta: "",
        finishReason: "function_call",
        functionCall: { name: "get_weather", arguments: { city: "Tokyo" } },
      };
    });

    mocks.mockCreateClient.mockResolvedValue({
      streamChat: mocks.mockStreamChat,
    } as unknown as GoogleAPIClient);

    mocks.mockExecutorExecute.mockResolvedValue({
      success: true,
      data: { ok: true },
      executionTime: 1,
      consoleLogs: [],
    });

    const onError = vi.fn();

    await ChatService.executeChat(baseRequest, {
      onChunk: vi.fn(),
      onFinish: vi.fn(),
      onError,
      onFunctionCall: vi.fn(),
      onFunctionResult: vi.fn(),
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Exceeded maximum function-call iterations (10)",
      }),
      "",
    );
    expect(mocks.mockStreamChat).toHaveBeenCalledTimes(10);
  });

  it("returns an explicit error when post-function response is empty", async () => {
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
        yield { delta: "", finishReason: "stop" };
      });

    mocks.mockCreateClient.mockResolvedValue({
      streamChat: mocks.mockStreamChat,
    } as unknown as GoogleAPIClient);

    mocks.mockExecutorExecute.mockResolvedValue({
      success: true,
      data: { temp: 22 },
      executionTime: 2,
      consoleLogs: [],
    });

    const onError = vi.fn();

    await ChatService.executeChat(baseRequest, {
      onChunk: vi.fn(),
      onFinish: vi.fn(),
      onError,
      onFunctionCall: vi.fn(),
      onFunctionResult: vi.fn(),
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Model failed to provide a final response after function calls.",
      }),
      "",
    );
  });

  it("surfaces transient errors without automatically retrying", async () => {
    mocks.mockStreamChat
      .mockImplementationOnce(async function* () {
        yield* [];
        throw new Error("transient");
      })
      .mockImplementationOnce(async function* () {
        yield { delta: "Recovered", finishReason: "stop" };
      });

    mocks.mockCreateClient.mockResolvedValue({
      streamChat: mocks.mockStreamChat,
    } as unknown as GoogleAPIClient);

    const onFinish = vi.fn();
    const onError = vi.fn();

    await ChatService.executeChat(baseRequest, {
      onChunk: vi.fn(),
      onFinish,
      onError,
    });

    expect(onFinish).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "");
    expect(mocks.mockStreamChat).toHaveBeenCalledTimes(1);
  });

  it("errors immediately when apiKey is missing", async () => {
    const onError = vi.fn();

    await ChatService.executeChat(
      { ...baseRequest, apiKey: "" },
      {
        onChunk: vi.fn(),
        onFinish: vi.fn(),
        onError,
      },
    );

    expect(mocks.mockCreateClient).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "API key not found for Google provider",
      }),
      "",
    );
  });

  it("surfaces abort errors when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    mocks.mockCreateClient.mockResolvedValue({
      streamChat: mocks.mockStreamChat,
    } as unknown as GoogleAPIClient);

    const onError = vi.fn();
    await ChatService.executeChat(
      baseRequest,
      {
        onChunk: vi.fn(),
        onFinish: vi.fn(),
        onError,
      },
      controller.signal,
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ name: "AbortError" }),
      "",
    );
  });
});
