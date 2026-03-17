import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { conversations, db } from "@/db";
import { GoogleAPIClient } from "@/services/api";
import type { SettingsState } from "@/stores";
import {
  useConversationStore,
  useFunctionsStore,
  useSettingsStore,
} from "@/stores";
import type { FinishReason, FunctionDefinition } from "@/types";

const mocks = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockStreamChat: vi.fn(),
  mockExecutorExecute: vi.fn(),
  mockExecutorTerminate: vi.fn(),
}));

vi.mock("@/services/api/google", () => ({
  GoogleAPIClient: {
    createClient: mocks.mockCreateClient,
  },
}));

vi.mock("@/services/executor", () => {
  class MockFunctionExecutor {
    execute = mocks.mockExecutorExecute;
    terminate = mocks.mockExecutorTerminate;
  }

  return {
    FunctionExecutor: MockFunctionExecutor,
  };
});

function createStoredFunction(): Omit<
  FunctionDefinition,
  "id" | "createdAt" | "updatedAt"
> {
  return {
    name: "get_weather",
    description: "Returns weather information for a city",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
      },
      required: ["city"],
    },
    implementation: "return { temp: 22, condition: 'sunny' };",
    timeout: 1000,
  };
}

describe("Function calling integration", () => {
  beforeEach(async () => {
    await db.conversations.clear();
    await db.functions.clear();

    vi.clearAllMocks();

    useFunctionsStore.setState({
      functions: [],
      isLoading: false,
      error: null,
    });

    useConversationStore.setState({
      conversations: [],
      activeConversationId: null,
      isLoading: false,
      isStreaming: false,
      error: null,
      abortController: null,
    });

    useSettingsStore.setState({
      settings: {
        id: "app-settings",
        apiKeys: { google: "test-api-key" },
        defaultModel: "gemini-2.5-flash",
        defaultParameters: {
          temperature: 0.7,
          maxTokens: 1024,
          topP: 0.9,
        },
        uiPreferences: {
          theme: "system",
          fontSize: "medium",
          codeTheme: "github-dark",
          showTokenCount: true,
          showCostEstimate: true,
        },
      },
      isLoading: false,
      error: null,
    } as unknown as SettingsState);
  });

  it("runs full flow: function call -> execution -> function result -> final model response", async () => {
    await useFunctionsStore.getState().createFunction(createStoredFunction());

    mocks.mockStreamChat
      .mockImplementationOnce(async function* () {
        yield {
          delta: "",
          finishReason: "function_call" as FinishReason,
          functionCall: {
            id: "call-1",
            name: "get_weather",
            arguments: { city: "Tokyo" },
          },
          usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
        };
      })
      .mockImplementationOnce(async function* () {
        yield {
          delta: "Tokyo is 22°C and sunny.",
          finishReason: "stop" as FinishReason,
          usage: { inputTokens: 8, outputTokens: 8, totalTokens: 16 },
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

    const store = useConversationStore.getState();
    const conversationId = await store.createConversation("gemini-2.5-flash", {
      temperature: 0.7,
      maxTokens: 256,
      topP: 0.9,
    });
    store.setActiveConversation(conversationId);

    await store.sendMessage("What is the weather in Tokyo?");

    const inMemoryConversation = useConversationStore
      .getState()
      .conversations.find((conversation) => conversation.id === conversationId);

    expect(inMemoryConversation).toBeDefined();
    expect(inMemoryConversation?.messages).toHaveLength(4);
    expect(inMemoryConversation?.messages[0].content).toBe(
      "What is the weather in Tokyo?",
    );
    expect(inMemoryConversation?.messages[1].functionCall).toEqual({
      id: "call-1",
      name: "get_weather",
      arguments: { city: "Tokyo" },
    });
    expect(inMemoryConversation?.messages[2].functionResult).toEqual(
      expect.objectContaining({
        id: "call-1",
        name: "get_weather",
        result: { temp: 22, condition: "sunny" },
      }),
    );
    expect(inMemoryConversation?.messages[3].content).toBe(
      "Tokyo is 22°C and sunny.",
    );

    expect(mocks.mockExecutorExecute).toHaveBeenCalledWith(
      expect.objectContaining({ name: "get_weather" }),
      { city: "Tokyo" },
    );

    const persistedConversation = await conversations.get(conversationId);
    expect(persistedConversation).toBeDefined();
    expect(
      persistedConversation?.messages.some((message) =>
        Boolean(message.functionCall),
      ),
    ).toBe(true);
    expect(
      persistedConversation?.messages.some((message) =>
        Boolean(message.functionResult),
      ),
    ).toBe(true);

    useConversationStore.setState({
      conversations: [],
      activeConversationId: null,
    });

    await useConversationStore.getState().loadConversations();

    const reloadedConversation = useConversationStore
      .getState()
      .conversations.find((conversation) => conversation.id === conversationId);
    expect(reloadedConversation).toBeDefined();
    expect(
      reloadedConversation?.messages.some((message) =>
        Boolean(message.functionCall),
      ),
    ).toBe(true);
    expect(
      reloadedConversation?.messages.some((message) =>
        Boolean(message.functionResult),
      ),
    ).toBe(true);
  });

  it("handles model calling a missing function with graceful error result", async () => {
    mocks.mockStreamChat
      .mockImplementationOnce(async function* () {
        yield {
          delta: "",
          finishReason: "function_call" as FinishReason,
          functionCall: {
            id: "call-missing",
            name: "missing_function",
            arguments: { value: 1 },
          },
        };
      })
      .mockImplementationOnce(async function* () {
        yield {
          delta: "I could not run that function.",
          finishReason: "stop" as FinishReason,
        };
      });

    mocks.mockCreateClient.mockResolvedValue({
      streamChat: mocks.mockStreamChat,
    } as unknown as GoogleAPIClient);

    const store = useConversationStore.getState();
    const conversationId = await store.createConversation("gemini-2.5-flash", {
      temperature: 0.7,
      maxTokens: 256,
      topP: 0.9,
    });
    store.setActiveConversation(conversationId);

    await store.sendMessage("Run the missing function");

    const conversation = useConversationStore
      .getState()
      .conversations.find((item) => item.id === conversationId);

    const functionResultMessage = conversation?.messages.find(
      (message) => message.functionResult?.name === "missing_function",
    );

    expect(mocks.mockExecutorExecute).not.toHaveBeenCalled();
    expect(functionResultMessage?.functionResult?.error).toContain(
      "Function not found: missing_function",
    );
  });

  it.each([
    {
      label: "timeout",
      errorName: "TimeoutError",
      errorMessage: "Function execution timed out after 1000ms",
    },
    {
      label: "runtime",
      errorName: "TypeError",
      errorMessage: "Cannot read properties of undefined",
    },
  ])(
    "surfaces function $label errors as function-result messages",
    async ({ errorName, errorMessage }) => {
      await useFunctionsStore.getState().createFunction(createStoredFunction());

      mocks.mockStreamChat
        .mockImplementationOnce(async function* () {
          yield {
            delta: "",
            finishReason: "function_call" as FinishReason,
            functionCall: {
              id: "call-error",
              name: "get_weather",
              arguments: { city: "Tokyo" },
            },
          };
        })
        .mockImplementationOnce(async function* () {
          yield {
            delta: "The function failed.",
            finishReason: "stop" as FinishReason,
          };
        });

      mocks.mockCreateClient.mockResolvedValue({
        streamChat: mocks.mockStreamChat,
      } as unknown as GoogleAPIClient);

      mocks.mockExecutorExecute.mockResolvedValueOnce({
        success: false,
        error: { name: errorName, message: errorMessage },
        executionTime: 12,
        consoleLogs: [],
      });

      const store = useConversationStore.getState();
      const conversationId = await store.createConversation(
        "gemini-2.5-flash",
        {
          temperature: 0.7,
          maxTokens: 256,
          topP: 0.9,
        },
      );
      store.setActiveConversation(conversationId);

      await store.sendMessage("Call get_weather");

      const conversation = useConversationStore
        .getState()
        .conversations.find((item) => item.id === conversationId);

      const functionResultMessage = conversation?.messages.find(
        (message) => message.functionResult?.name === "get_weather",
      );

      expect(functionResultMessage?.functionResult?.error).toBe(errorMessage);
      expect(functionResultMessage?.functionResult?.executionTime).toBe(12);
    },
  );
});
