import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { conversations, db } from "@/db";
import { useSettingsStore, type SettingsState } from "@/features/settings";
import { GoogleAPIClient } from "@/shared/services/api";
import type { FinishReason } from "@/shared/types";

import { useConversationStore } from "..";

vi.setConfig({ testTimeout: 15000 });

// Mock dependencies
vi.mock("@/shared/services/api/google", () => ({
  GoogleAPIClient: {
    createClient: vi.fn(),
  },
}));

describe("ChatSlice", () => {
  beforeEach(async () => {
    // Clear database and store state before each test
    await db.conversations.clear();
    await db.functions.clear();
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "Date",
        "setImmediate",
        "clearImmediate",
      ],
    });
    useConversationStore.setState({
      conversations: [],
      activeConversationId: null,
      isLoading: false,
      isStreaming: false,
      error: null,
      abortController: null,
    });

    // Default settings mock
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

  const mockStreamResponse = (content: string, totalTokens = 10) => {
    const mockStream = async function* () {
      yield { delta: content };
      // Small delay to ensure timers are needed
      await new Promise((resolve) => setTimeout(resolve, 10));
      yield {
        delta: "",
        finishReason: "stop" as FinishReason,
        usage: { totalTokens, inputTokens: 5, outputTokens: 5 },
      };
    };
    return mockStream();
  };

  it("should send a message and receive response", async () => {
    vi.useRealTimers();
    try {
      const mockStream = async function* () {
        yield { delta: "I am a helpful assistant" };
        yield {
          delta: "",
          finishReason: "stop",
          usage: { totalTokens: 10, inputTokens: 5, outputTokens: 5 },
        };
      };

      vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
        streamChat: vi.fn().mockImplementation(() => mockStream()),
      } as unknown as GoogleAPIClient);

      const store = useConversationStore.getState();
      const id = await store.createConversation("test-model", {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });
      store.setActiveConversation(id);

      await store.sendMessage("Hello");

      const state = useConversationStore.getState();
      const conversation = state.conversations.find((c) => c.id === id);

      expect(conversation?.messages[0].content).toBe("Hello");
      expect(conversation?.messages[1].content).toBe(
        "I am a helpful assistant",
      );

      const persisted = await conversations.get(id);
      expect(persisted).toBeDefined();
      expect(persisted?.messages.length).toBe(2);
    } finally {
      vi.useFakeTimers({
        toFake: [
          "setTimeout",
          "clearTimeout",
          "setInterval",
          "clearInterval",
          "Date",
          "setImmediate",
          "clearImmediate",
        ],
      });
    }
  });

  it("should stream a response and update message incrementally", async () => {
    const mockStream = async function* () {
      yield { delta: "Hello" };
      await new Promise((resolve) => setTimeout(resolve, 20));
      yield { delta: " World" };
      yield {
        delta: "",
        finishReason: "stop" as FinishReason,
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
      };
    };

    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      streamChat: vi.fn().mockReturnValue(mockStream()),
    } as unknown as GoogleAPIClient);

    const store = useConversationStore.getState();
    const id = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(id);

    const promise = store.sendMessage("Hi");
    await vi.advanceTimersByTimeAsync(2000);
    await promise;

    const conversation = useConversationStore
      .getState()
      .conversations.find((c) => c.id === id);
    expect(conversation?.messages[1].content).toBe("Hello World");
    expect(conversation?.metadata?.totalTokens).toBe(10);
  });

  it("should handle error during streaming", async () => {
    const mockStream = async function* () {
      yield { delta: "Start" };
      throw new Error("Stream failed");
    };

    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      streamChat: vi.fn().mockImplementation(() => mockStream()),
    } as unknown as GoogleAPIClient);

    const store = useConversationStore.getState();
    const id = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(id);

    const sendPromise = store.sendMessage("Hi");
    await vi.runAllTimersAsync();
    await sendPromise;

    const state = useConversationStore.getState();
    expect(state.error).toBeDefined();
    expect((state.error as Error).message).toBe("Stream failed");
    expect(state.isStreaming).toBe(false);
  });

  it("should abort generation", async () => {
    let resolveStream: () => void = () => {};
    const streamTrigger = new Promise<void>((r) => {
      resolveStream = r;
    });

    const mockStreamChat = vi
      .fn()
      .mockImplementation(async function* (_, signal) {
        // Wait for trigger
        await streamTrigger;
        // Wait more than 16ms to ensure ChatService's debounce allows the first chunk
        await new Promise((resolve) => setTimeout(resolve, 25));
        // Yield first chunk
        yield { delta: "Start" };
        // Wait bit more to give test time to abort
        await new Promise((resolve) => setTimeout(resolve, 50));

        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        yield { delta: "End" };
      });

    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      streamChat: mockStreamChat,
    } as unknown as GoogleAPIClient);

    const store = useConversationStore.getState();
    const id = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(id);

    const sendPromise = store.sendMessage("Hello");

    // Start the stream
    resolveStream();

    // Fast-forward to pick up first chunk
    await vi.advanceTimersByTimeAsync(30);

    store.abortGeneration();
    await vi.runAllTimersAsync();
    await sendPromise;

    const state = useConversationStore.getState();
    expect(state.isStreaming).toBe(false);
    const conversation = state.conversations.find((c) => c.id === id);
    expect(
      conversation?.messages[conversation.messages.length - 1].content,
    ).toBe("Start");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should delete a message and all following context", async () => {
    const store = useConversationStore.getState();
    const id = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(id);

    useConversationStore.setState((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id
          ? {
              ...c,
              messages: [
                {
                  id: "msg-1",
                  role: "user" as const,
                  content: "Hi",
                  timestamp: 1,
                },
                {
                  id: "msg-2",
                  role: "model" as const,
                  content: "Hello",
                  timestamp: 2,
                },
                {
                  id: "msg-3",
                  role: "user" as const,
                  content: "How are you?",
                  timestamp: 3,
                },
              ],
            }
          : c,
      ),
    }));

    const promise = store.deleteMessage("msg-2");
    await vi.runAllTimersAsync();
    await promise;

    const conversation = useConversationStore
      .getState()
      .conversations.find((c) => c.id === id);
    expect(conversation?.messages.length).toBe(1);
    expect(conversation?.messages[0].id).toBe("msg-1");
  });

  it("should abort ongoing generation when deleting a message", async () => {
    let streamTrigger: () => void;
    const streamTriggerPromise = new Promise<void>((r) => {
      streamTrigger = r;
    });

    const mockStreamChat = vi
      .fn()
      .mockImplementation(async function* (_, signal) {
        await streamTriggerPromise;
        await new Promise((resolve) => setTimeout(resolve, 20));
        yield { delta: "Slow" };
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        yield { delta: " Response" };
      });

    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      streamChat: mockStreamChat,
    } as unknown as GoogleAPIClient);

    const store = useConversationStore.getState();
    const id = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(id);

    useConversationStore.setState((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id
          ? {
              ...c,
              messages: [
                {
                  id: "msg-1",
                  role: "user" as const,
                  content: "Hi",
                  timestamp: 1,
                },
                {
                  id: "msg-2",
                  role: "model" as const,
                  content: "Hello",
                  timestamp: 2,
                },
              ],
            }
          : c,
      ),
    }));

    // Start a message regeneration
    const promise1 = store.retryMessage("msg-2");

    // Give it time to start the stream request
    streamTrigger!();
    await vi.advanceTimersByTimeAsync(30); // Yields "Slow"

    // AbortController should be active now
    expect(useConversationStore.getState().abortController).toBeDefined();

    // Trigger delete! This should halt the previous stream.
    const promise2 = store.deleteMessage("msg-1");

    // Let the delete operation complete and the stream abort
    await vi.runAllTimersAsync();
    await Promise.allSettled([promise1, promise2]);

    const state = useConversationStore.getState();
    expect(state.isStreaming).toBe(false);
    expect(state.abortController).toBeNull();
  });

  it("should retry a model message by regenerating response", async () => {
    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      streamChat: vi
        .fn()
        .mockImplementation(() => mockStreamResponse("Regenerated Hello")),
    } as unknown as GoogleAPIClient);

    const store = useConversationStore.getState();
    const id = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(id);

    useConversationStore.setState((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id
          ? {
              ...c,
              messages: [
                {
                  id: "msg-1",
                  role: "user" as const,
                  content: "Hi",
                  timestamp: 1,
                },
                {
                  id: "msg-2",
                  role: "model" as const,
                  content: "Hello",
                  timestamp: 2,
                },
              ],
            }
          : c,
      ),
    }));

    const promise = store.retryMessage("msg-2");
    await vi.runAllTimersAsync();
    await promise;

    const state = useConversationStore.getState();
    const conversation = state.conversations.find((c) => c.id === id);

    // The old model message was removed, user message remains,
    // and a new model message is generated.
    expect(conversation?.messages.length).toBe(2);
    expect(conversation?.messages[0].content).toBe("Hi");
    expect(conversation?.draft).toBeUndefined(); // shouldn't be moved to draft
    expect(conversation?.messages[1].role).toBe("model");
    expect(conversation?.messages[1].content).toBe("Regenerated Hello");
  });

  it("should abort ongoing generation when retrying a message", async () => {
    let streamTrigger: () => void;
    const streamTriggerPromise = new Promise<void>((r) => {
      streamTrigger = r;
    });

    const mockStreamChat = vi
      .fn()
      .mockImplementation(async function* (_, signal) {
        await streamTriggerPromise;
        await new Promise((resolve) => setTimeout(resolve, 20));
        yield { delta: "Slow" };
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        yield { delta: " Response" };
      });

    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      streamChat: mockStreamChat,
    } as unknown as GoogleAPIClient);

    const store = useConversationStore.getState();
    const id = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(id);

    useConversationStore.setState((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id
          ? {
              ...c,
              messages: [
                {
                  id: "msg-1",
                  role: "user" as const,
                  content: "Hi",
                  timestamp: 1,
                },
                {
                  id: "msg-2",
                  role: "model" as const,
                  content: "Hello",
                  timestamp: 2,
                },
              ],
            }
          : c,
      ),
    }));

    // Start a message regeneration
    const promise1 = store.retryMessage("msg-2");

    // Give it time to start the stream request
    streamTrigger!();
    await vi.advanceTimersByTimeAsync(30); // Yields "Slow"

    // AbortController should be active now
    expect(useConversationStore.getState().abortController).toBeDefined();

    // Trigger another retry! This should halt the first one.
    const promise2 = store.retryMessage("msg-2");

    // Let the second one complete and the first one abort
    await vi.runAllTimersAsync();
    await Promise.allSettled([promise1, promise2]);

    const state = useConversationStore.getState();
    expect(state.isStreaming).toBe(false);

    const conversation = state.conversations.find((c) => c.id === id);
    // Since mockStreamChat just throws, the second stream will fail due to no content from mocked stream
    // but the point is it shouldn't hold the old stream content or freeze
    expect(conversation).toBeDefined();
  });

  it("should NOT save draft for temporary conversations", async () => {
    const store = useConversationStore.getState();
    const id = await store.createConversation(
      "test-model",
      { temperature: 0.7, maxTokens: 100, topP: 0.9 },
      undefined,
      { isTemporary: true },
    );
    store.setActiveConversation(id);

    await store.setDraft(id, "I am testing");

    const state = useConversationStore.getState();
    const conversation = state.conversations.find((c) => c.id === id);
    expect(conversation?.draft).toBeUndefined();
  });

  it("should PRESERVE draft for ephemeral conversations when switching away and back", async () => {
    const store = useConversationStore.getState();
    const ephId = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(ephId);

    // Set a draft on the ephemeral conversation
    await store.setDraft(ephId, "My ephemeral draft");

    // Create a persisted conversation (mocking it)
    useConversationStore.setState((s) => ({
      conversations: [
        ...s.conversations,
        {
          id: "persisted-chat",
          title: "Persisted",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          modelId: "test-model",
          parameters: { temperature: 0.7, maxTokens: 100, topP: 0.9 },
          persisted: true,
        },
      ],
    }));

    // Switch to persisted conversation
    store.setActiveConversation("persisted-chat");

    // Now click "New Conversation" again
    const newEphId = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });

    // It should reuse the exact same ephemeral conversation!
    expect(newEphId).toBe(ephId);

    // And the draft should still be there!
    const state = useConversationStore.getState();
    const reactivatedConv = state.conversations.find((c) => c.id === ephId);
    expect(reactivatedConv?.draft).toBe("My ephemeral draft");
  });

  it("should update system prompt", async () => {
    const store = useConversationStore.getState();
    const id = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 1024,
      topP: 0.9,
    });
    store.setActiveConversation(id);

    await store.setSystemPrompt("You are a pirate.");

    const conversation = useConversationStore
      .getState()
      .conversations.find((c) => c.id === id);
    expect(conversation?.systemPrompt).toBe("You are a pirate.");
  });

  it("should edit a message and truncate subsequent messages", async () => {
    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      streamChat: vi.fn().mockReturnValue(mockStreamResponse("New response")),
    } as unknown as GoogleAPIClient);

    const store = useConversationStore.getState();
    const id = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(id);

    useConversationStore.setState((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id
          ? {
              ...c,
              messages: [
                {
                  id: "m1",
                  role: "user" as const,
                  content: "Hi",
                  timestamp: 1,
                },
                {
                  id: "m2",
                  role: "model" as const,
                  content: "Hello",
                  timestamp: 2,
                },
                {
                  id: "m3",
                  role: "user" as const,
                  content: "More",
                  timestamp: 3,
                },
              ],
            }
          : c,
      ),
    }));

    const promise = store.editMessage("m1", "Updated Hi");
    await vi.runAllTimersAsync();
    await promise;

    const conversation = useConversationStore
      .getState()
      .conversations.find((c) => c.id === id);
    // m1 updated, m2 and m3 truncated, then AI response re-generated
    expect(conversation?.messages[0].content).toBe("Updated Hi");
    // m2 is removed (truncated), new AI reply takes its place
    expect(conversation?.messages).toHaveLength(2);
    expect(conversation?.messages[1].role).toBe("model");
    expect(conversation?.messages[1].content).toBe("New response");
  });

  it("should merge parameters into active conversation", async () => {
    const store = useConversationStore.getState();
    const id = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(id);

    await store.setParameters({ temperature: 0.2 }, "merge");

    const conversation = useConversationStore
      .getState()
      .conversations.find((c) => c.id === id);
    expect(conversation?.parameters.temperature).toBe(0.2);
    expect(conversation?.parameters.maxTokens).toBe(100); // unchanged
    expect(conversation?.parameters.topP).toBe(0.9); // unchanged
  });

  it("should replace parameters on active conversation", async () => {
    const store = useConversationStore.getState();
    const id = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(id);

    await store.setParameters({ temperature: 0.5 }, "replace");

    const conversation = useConversationStore
      .getState()
      .conversations.find((c) => c.id === id);
    // Only temperature is custom; maxTokens and topP fall back to DEFAULT_PARAMETERS
    expect(conversation?.parameters.temperature).toBe(0.5);
    // Replaced with defaults for remaining fields
    expect(conversation?.parameters.maxTokens).toBeDefined();
    expect(conversation?.parameters.topP).toBeDefined();
  });

  it("should update a single message content without truncating subsequent messages", async () => {
    const store = useConversationStore.getState();
    const id = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(id);

    useConversationStore.setState((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id
          ? {
              ...c,
              messages: [
                {
                  id: "m1",
                  role: "user" as const,
                  content: "First",
                  timestamp: 1,
                },
                {
                  id: "m2",
                  role: "model" as const,
                  content: "Original",
                  timestamp: 2,
                },
                {
                  id: "m3",
                  role: "user" as const,
                  content: "Third",
                  timestamp: 3,
                },
              ],
            }
          : c,
      ),
    }));

    await store.updateMessage(id, "m2", "Updated content");

    const conversation = useConversationStore
      .getState()
      .conversations.find((c) => c.id === id);
    expect(conversation?.messages).toHaveLength(3); // no truncation
    expect(conversation?.messages[1].content).toBe("Updated content");
    expect(conversation?.messages[2].content).toBe("Third"); // still present
  });

  it("should truncate long first message to 40 chars as title", async () => {
    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      streamChat: vi.fn().mockImplementation(() => mockStreamResponse("Ok")),
    } as unknown as GoogleAPIClient);

    const store = useConversationStore.getState();
    const id = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(id);

    const longMessage =
      "This is a very long message that exceeds forty characters";
    const promise = store.sendMessage(longMessage);
    await vi.runAllTimersAsync();
    await promise;

    const conversation = useConversationStore
      .getState()
      .conversations.find((c) => c.id === id);
    expect(conversation?.title).toBe(
      "This is a very long message that exce...",
    );
    expect(conversation?.title?.length).toBe(40);
  });

  it("should pass attached functions and persist function call/result messages", async () => {
    vi.useRealTimers();
    try {
      const attachedFunction = {
        id: "func-weather",
        name: "get_weather",
        description: "Get weather information",
        parameters: {
          type: "object" as const,
          properties: {
            city: { type: "string" as const },
          },
          required: ["city"],
        },
        implementation: "return { temp: 22 };",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.functions.add(attachedFunction);

      const mockStreamChat = vi
        .fn()
        .mockImplementationOnce(async function* () {
          yield {
            delta: "",
            finishReason: "function_call" as FinishReason,
            functionCall: {
              name: "unknown_function",
              arguments: { city: "Tokyo" },
            },
            usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
          };
        })
        .mockImplementationOnce(async function* () {
          yield {
            delta: "Function run completed.",
            finishReason: "stop" as FinishReason,
            usage: { inputTokens: 7, outputTokens: 4, totalTokens: 11 },
          };
        });

      vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
        streamChat: mockStreamChat,
      } as unknown as GoogleAPIClient);

      const store = useConversationStore.getState();
      const id = await store.createConversation("test-model", {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });
      store.setActiveConversation(id);

      useConversationStore.setState((state) => ({
        conversations: state.conversations.map((conversation) =>
          conversation.id === id
            ? { ...conversation, functionIds: [attachedFunction.id] }
            : conversation,
        ),
      }));

      await store.sendMessage("Use tools");

      const firstRequest = mockStreamChat.mock.calls[0]?.[0] as {
        functions?: Array<{ name: string }>;
      };
      expect(firstRequest.functions?.map((f) => f.name)).toEqual([
        "get_weather",
      ]);

      const finalConversation = useConversationStore
        .getState()
        .conversations.find((conversation) => conversation.id === id);

      const functionCallMessage = finalConversation?.messages.find(
        (message) => message.functionCall?.name === "unknown_function",
      );
      const functionResultMessage = finalConversation?.messages.find(
        (message) => message.functionResult?.name === "unknown_function",
      );

      expect(functionCallMessage?.role).toBe("model");
      expect(functionResultMessage?.role).toBe("user");
      expect(
        finalConversation?.messages[finalConversation.messages.length - 1],
      ).toMatchObject({
        role: "model",
        content: "Function run completed.",
      });

      const persistedConversation = await conversations.get(id);
      const persistedFunctionCallMessage = persistedConversation?.messages.find(
        (message) => message.functionCall?.name === "unknown_function",
      );
      const persistedFunctionResultMessage =
        persistedConversation?.messages.find(
          (message) => message.functionResult?.name === "unknown_function",
        );

      expect(persistedFunctionCallMessage).toBeDefined();
      expect(persistedFunctionResultMessage).toBeDefined();
    } finally {
      vi.useFakeTimers({
        toFake: [
          "setTimeout",
          "clearTimeout",
          "setInterval",
          "clearInterval",
          "Date",
          "setImmediate",
          "clearImmediate",
        ],
      });
    }
  });
});
