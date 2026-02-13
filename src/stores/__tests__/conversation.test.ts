import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db/db";
import { conversations } from "../../db/operations";
import { GoogleAPIClient } from "../../services/api/google";
import { useConversationStore } from "../conversation";
import { type SettingsState, useSettingsStore } from "../settings";

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

describe("ConversationStore", () => {
  beforeEach(async () => {
    // Clear database and store state before each test
    await db.conversations.clear();
    useConversationStore.setState({
      conversations: [],
      activeConversationId: null,
      isLoading: false,
      error: null,
    });
  });

  it("should create a new conversation", async () => {
    const store = useConversationStore.getState();
    const conversationId = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });

    expect(conversationId).toBeDefined();

    const state = useConversationStore.getState();
    expect(state.conversations.length).toBe(1);
    expect(state.activeConversationId).toBe(conversationId);
    expect(state.conversations[0].modelId).toBe("test-model");

    // Verify persistence
    const persisted = await conversations.get(conversationId);
    expect(persisted).toBeDefined();
    expect(persisted?.modelId).toBe("test-model");
  });

  it("should update a message in a conversation", async () => {
    const store = useConversationStore.getState();
    const conversationId = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });

    // Manually add message to store and DB for testing update
    const message = {
      id: "msg-1",
      role: "user" as const,
      content: "Hello",
      timestamp: Date.now(),
    };

    // Update store state directly for test setup
    useConversationStore.setState((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, message] }
          : c,
      ),
    }));

    // Also update DB
    await conversations.update(conversationId, {
      messages: [message],
    });

    await store.updateMessage(conversationId, "msg-1", "Hello World");

    const state = useConversationStore.getState();
    const conversation = state.conversations.find(
      (c) => c.id === conversationId,
    );

    expect(conversation?.messages.length).toBe(1);
    expect(conversation?.messages[0].content).toBe("Hello World");

    // Verify persistence
    const persisted = await conversations.get(conversationId);
    expect(persisted?.messages.length).toBe(1);
    expect(persisted?.messages[0].content).toBe("Hello World");
  });

  it("should delete a conversation", async () => {
    const store = useConversationStore.getState();
    const conversationId = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });

    await store.deleteConversation(conversationId);

    const state = useConversationStore.getState();
    expect(state.conversations.length).toBe(0);
    expect(state.activeConversationId).toBeNull();

    // Verify persistence
    const persisted = await conversations.get(conversationId);
    expect(persisted).toBeUndefined();
  });

  it("should send a message and receive response", async () => {
    // Mock settings store state
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
      loadSettings: vi.fn(),
      updateSettings: vi.fn(),
      setApiKey: vi.fn(),
      updatePreferences: vi.fn(),
    } as unknown as SettingsState);

    // Mock Google client
    const mockStream = async function* () {
      yield { delta: "I am a helpful assistant" };
      yield {
        delta: "",
        finishReason: "stop",
        usage: { totalTokens: 10 },
      };
    };

    const mockStreamChat = vi.fn().mockReturnValue(mockStream());

    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      streamChat: mockStreamChat,
    } as unknown as GoogleAPIClient);

    const store = useConversationStore.getState();
    const conversationId = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });

    store.setActiveConversation(conversationId);
    await store.sendMessage("Hello");

    const state = useConversationStore.getState();
    const conversation = state.conversations.find(
      (c) => c.id === conversationId,
    );

    // Check user message
    expect(conversation?.messages[0].role).toBe("user");
    expect(conversation?.messages[0].content).toBe("Hello");

    // Check assistant response
    expect(conversation?.messages[1].role).toBe("model");
    expect(conversation?.messages[1].content).toBe("I am a helpful assistant");

    expect(mockStreamChat).toHaveBeenCalled();
  });

  it("should stream a response and update message incrementally", async () => {
    // Mock settings
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: {
        id: "app-settings",
        apiKeys: { google: "test-api-key" },
        defaultModel: "gemini-2.5-flash",
      },
    } as unknown as SettingsState);

    // Mock stream generator
    const mockStream = async function* () {
      yield { delta: "Hello" };
      await new Promise((resolve) => setTimeout(resolve, 20)); // Force > 16ms
      yield { delta: " World" };
      yield {
        delta: "",
        finishReason: "stop",
        usage: { totalTokens: 10 },
      };
    };

    const mockStreamChat = vi.fn().mockReturnValue(mockStream());

    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      streamChat: mockStreamChat,
    } as unknown as GoogleAPIClient);

    const store = useConversationStore.getState();
    const conversationId = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });

    store.setActiveConversation(conversationId);

    // Start streaming
    const sendPromise = store.sendMessage("Hi");

    // Verify potentially immediate streaming state
    // Note: sendMessage is async, so we might need to wait a tick for isStreaming to flip
    // But since it's an optimistic update at the start, it should be true quickly.

    // We can't easily assert intermediate states without using fake timers or hooks,
    // but we can sanity check the final state and ensuring the method was called.

    await sendPromise;

    const state = useConversationStore.getState();
    const conversation = state.conversations.find(
      (c) => c.id === conversationId,
    );

    // Check assistant response
    expect(conversation?.messages[1].role).toBe("model");
    expect(conversation?.messages[1].content).toBe("Hello World");
    expect(conversation?.messages[1].metadata?.tokens).toBe(10);
    expect(state.isStreaming).toBe(false);

    expect(mockStreamChat).toHaveBeenCalled();
  });

  it("should handle error during streaming", async () => {
    // Mock settings
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: {
        id: "app-settings",
        apiKeys: { google: "test-api-key" },
        defaultModel: "gemini-2.5-flash",
      },
    } as unknown as SettingsState);

    // Mock stream generator that throws after first chunk
    const mockStream = async function* () {
      yield { delta: "Start" };
      throw new Error("Stream failed");
    };

    const mockStreamChat = vi.fn().mockReturnValue(mockStream());

    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      streamChat: mockStreamChat,
    } as unknown as GoogleAPIClient);

    const store = useConversationStore.getState();
    const conversationId = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(conversationId);

    await store.sendMessage("Hi");

    const state = useConversationStore.getState();
    const conversation = state.conversations.find(
      (c) => c.id === conversationId,
    );

    // Should have captured the partial content
    expect(conversation?.messages[1].content).toBe("Start");
    // Should be in error state
    expect(state.error).toBe("Stream failed");
    expect(state.isStreaming).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it("should handle empty stream response", async () => {
    // Mock settings
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: {
        id: "app-settings",
        apiKeys: { google: "test-api-key" },
        defaultModel: "gemini-2.5-flash",
      },
    } as unknown as SettingsState);

    // Mock empty stream
    const mockStream = async function* () {
      // Yield nothing or just finish
      yield { delta: "", finishReason: "stop" as const };
    };

    const mockStreamChat = vi.fn().mockReturnValue(mockStream());

    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      streamChat: mockStreamChat,
    } as unknown as GoogleAPIClient);

    const store = useConversationStore.getState();
    const conversationId = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(conversationId);

    await store.sendMessage("Hi");

    const state = useConversationStore.getState();
    const conversation = state.conversations.find(
      (c) => c.id === conversationId,
    );

    // Message should exist but be empty
    expect(conversation?.messages[1].content).toBe("");
    expect(state.isStreaming).toBe(false);
    expect(state.error).toBeNull();
  });

  it("should abort generation", async () => {
    let resolve: () => void = () => {};
    const result = new Promise<void>((r) => {
      resolve = r;
    });

    // Mock settings
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: {
        id: "app-settings",
        apiKeys: { google: "test-api-key" },
        defaultModel: "gemini-2.5-flash",
      },
    } as unknown as SettingsState);

    const mockStreamChat = vi
      .fn()
      .mockImplementation(async function* (_, signal) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        yield { delta: "Start" };
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        await result; // Wait until resolved (or aborted)
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        yield { delta: "End" };
      });

    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      streamChat: mockStreamChat,
    } as unknown as GoogleAPIClient);

    const store = useConversationStore.getState();
    const conversationId = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });
    store.setActiveConversation(conversationId);

    const sendPromise = store.sendMessage("Hello");

    // Wait for streaming to start and client to be called
    await vi.waitFor(() => {
      expect(useConversationStore.getState().isStreaming).toBe(true);
      expect(mockStreamChat).toHaveBeenCalled();
    });

    // Abort
    store.abortGeneration();
    resolve(); // Unblock the stream generator so it can check signal

    await sendPromise;

    const state = useConversationStore.getState();
    expect(state.isStreaming).toBe(false);
    expect(state.isLoading).toBe(false);

    // The message should contain partial content "Start"
    const conversation = state.conversations.find(
      (c) => c.id === state.activeConversationId,
    );
    // Depending on when abort happened vs state update, it might have "Start"
    // Since we yield "Start" before waiting, it should be there.
    const lastMessage =
      conversation?.messages[conversation.messages.length - 1];
    expect(lastMessage?.content).toContain("Start");
    expect(state.error).toBeNull();
  });
});
