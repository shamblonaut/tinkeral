import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { conversations, db } from "@/db";
import { GoogleAPIClient } from "@/services/api";
import {
  useConversationStore,
  useSettingsStore,
  type SettingsState,
} from "@/stores";
import type { FinishReason } from "@/types";

vi.setConfig({ testTimeout: 15000 });

// Mock dependencies
vi.mock("../../services/api/google", () => ({
  GoogleAPIClient: {
    createClient: vi.fn(),
  },
}));

vi.mock("../settings", () => ({
  useSettingsStore: {
    getState: vi.fn(),
    setState: vi.fn(),
    subscribe: vi.fn(),
  },
}));

describe("ChatSlice", () => {
  beforeEach(async () => {
    // Clear database and store state before each test
    await db.conversations.clear();
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
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: {
        id: "app-settings",
        apiKeys: { google: "test-api-key" },
        defaultModel: "gemini-2.5-flash",
        defaultParameters: {
          temperature: 0.7,
          maxTokens: 1024,
          topP: 0.9,
        },
      },
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

  it("should retry a model message", async () => {
    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      streamChat: vi
        .fn()
        .mockReturnValue(mockStreamResponse("Regenerated response")),
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

    const conversation = useConversationStore
      .getState()
      .conversations.find((c) => c.id === id);
    expect(conversation?.messages.length).toBe(2);
    expect(conversation?.messages[1].content).toBe("Regenerated response");
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
});
