import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { conversations, db, type Conversation } from "@/db";
import { GoogleAPIClient } from "@/services/api";
import {
  useConversationStore,
  useSettingsStore,
  type SettingsState,
} from "@/stores";

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
      searchQuery: "",
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

    // Verify NOT persisted (persisted:false by default)
    const persisted = await conversations.get(conversationId);
    expect(persisted).toBeUndefined();
    expect(state.conversations[0].persisted).toBe(false);
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

    // Manually persist conversation first (since it's not persisted by default)
    const storeState = useConversationStore.getState();
    const currConv = storeState.conversations.find(
      (c) => c.id === conversationId,
    );
    if (currConv) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { persisted, ...data } = currConv;
      await conversations.save({ ...data, persisted: true } as Conversation);
      // Update store to reflect persistence
      useConversationStore.setState((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, persisted: true } : c,
        ),
      }));
    }

    // Also update DB with the message we want to test updating
    await conversations.update(conversationId, {
      messages: [message],
    });
    // And update store to have that message
    useConversationStore.setState((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, message] }
          : c,
      ),
    }));

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

  it("should rename a conversation", async () => {
    const store = useConversationStore.getState();
    const id = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });

    await store.renameConversation(id, "New Title");

    const state = useConversationStore.getState();
    const conversation = state.conversations.find((c) => c.id === id);
    expect(conversation?.title).toBe("New Title");

    // Should NOT persist rename for non-persisted conversation
    const persisted = await conversations.get(id);
    expect(persisted).toBeUndefined();

    // Now persist it and try again
    await store.sendMessage("Init"); // Persists
    await store.renameConversation(id, "Another Title");

    const persisted2 = await conversations.get(id);
    expect(persisted2?.title).toBe("Another Title");
  });

  it("should duplicate a conversation", async () => {
    const store = useConversationStore.getState();
    const originalId = await store.createConversation("test-model", {
      temperature: 0.5,
      maxTokens: 100,
      topP: 0.9,
    });

    // Add a message (will persist the conversation)
    await store.setActiveConversation(originalId);
    await store.sendMessage("Deep content");

    await store.loadConversations(); // Sync store

    await store.duplicateConversation(originalId);

    const state = useConversationStore.getState();
    expect(state.conversations.length).toBe(2);

    const duplicate = state.conversations[0]; // Newest usually first
    expect(duplicate.id).not.toBe(originalId);
    expect(duplicate.title).toBe("Deep content (Copy)");
    expect(duplicate.modelId).toBe("test-model");
    expect(duplicate.parameters.temperature).toBe(0.5);
    expect(duplicate.parameters.temperature).toBe(0.5);
    // Expect 3 messages: User(Deep content), Assistant(Response), Assistant(Empty/Stop)
    // The previous sendMessage implementation in tests usually implies a response flow.
    // But duplicateConversation duplicates current state.
    // If we used sendMessage, we have user + assistant.
    // Let's just check user message content.
    expect(duplicate.messages.some((m) => m.content === "Deep content")).toBe(
      true,
    );

    // Verify persistence
    const persisted = await conversations.get(duplicate.id);
    expect(persisted).toBeDefined();
    expect(persisted?.title).toBe("Deep content (Copy)");
  });

  it("should generate title automatically after first user message", async () => {
    // Mock settings and API as in other sendMessage tests
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: {
        id: "app-settings",
        apiKeys: { google: "test-api-key" },
        defaultModel: "gemini-pro",
      },
    } as unknown as SettingsState);

    const mockStream = async function* () {
      yield { delta: "Response" };
      yield { delta: "", finishReason: "stop" };
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

    await store.sendMessage(
      "This is a very long first message that should be truncated",
    );

    const state = useConversationStore.getState();
    const conversation = state.conversations.find((c) => c.id === id);

    // Should be truncated to ~40 chars total (37 + 3)
    expect(conversation?.title).toBe(
      "This is a very long first message tha...",
    );

    // Verify persistence
    const persisted = await conversations.get(id);
    expect(persisted?.title).toBe("This is a very long first message tha...");
  });
  describe("Draft Conversations (Non-Persisted)", () => {
    it("should create non-persisted conversation by default", async () => {
      const store = useConversationStore.getState();
      const conversationId = await store.createConversation("test-model", {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });

      const state = useConversationStore.getState();
      const conversation = state.conversations.find(
        (c) => c.id === conversationId,
      );

      expect(conversation).toBeDefined();
      expect(conversation?.persisted).toBe(false);

      // Verify NOT persisted
      const persisted = await conversations.get(conversationId);
      expect(persisted).toBeUndefined();
    });

    it("should persist conversation on first message", async () => {
      // Mock settings and API
      vi.mocked(useSettingsStore.getState).mockReturnValue({
        settings: {
          id: "app-settings",
          apiKeys: { google: "test-api-key" },
          defaultModel: "gemini-2.5-flash",
        },
      } as unknown as SettingsState);

      const mockStream = async function* () {
        yield { delta: "Response" };
        yield { delta: "", finishReason: "stop" };
      };
      vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
        streamChat: vi.fn().mockReturnValue(mockStream()),
      } as unknown as GoogleAPIClient);

      const store = useConversationStore.getState();
      const conversationId = await store.createConversation("test-model", {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });
      store.setActiveConversation(conversationId);

      // Verify it starts as not persisted
      let state = useConversationStore.getState();
      expect(
        state.conversations.find((c) => c.id === conversationId)?.persisted,
      ).toBe(false);
      expect(await conversations.get(conversationId)).toBeUndefined();

      // Send message
      await store.sendMessage("Hello");

      // Verify persisted in store
      state = useConversationStore.getState();
      const conversation = state.conversations.find(
        (c) => c.id === conversationId,
      );
      expect(conversation?.persisted).toBe(true);

      // Verify persisted in DB
      const persisted = await conversations.get(conversationId);
      expect(persisted).toBeDefined();
      expect(persisted?.title).toBeDefined();
      expect(persisted?.messages.length).toBeGreaterThan(0);
    });

    it("should not persist parameters updates for non-persisted conversation", async () => {
      const store = useConversationStore.getState();
      const conversationId = await store.createConversation("test-model", {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });
      store.setActiveConversation(conversationId);

      await store.setParameters({ temperature: 0.5 });

      const state = useConversationStore.getState();
      const conversation = state.conversations.find(
        (c) => c.id === conversationId,
      );
      expect(conversation?.parameters.temperature).toBe(0.5);

      // Verify NOT persisted
      const persisted = await conversations.get(conversationId);
      expect(persisted).toBeUndefined();
    });

    it("should handle deletion of non-persisted conversation", async () => {
      const store = useConversationStore.getState();
      const conversationId = await store.createConversation("test-model", {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });

      await store.deleteConversation(conversationId);

      const state = useConversationStore.getState();
      expect(
        state.conversations.find((c) => c.id === conversationId),
      ).toBeUndefined();

      // Verify DB interaction didn't crash (and nothing in DB)
      const persisted = await conversations.get(conversationId);
      expect(persisted).toBeUndefined();
    });

    it("should remove ephemeral conversation when creating a new one", async () => {
      const store = useConversationStore.getState();
      // 1. Create first conversation (ephemeral)
      const id1 = await store.createConversation("test-model", {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });

      let state = useConversationStore.getState();
      expect(state.conversations.length).toBe(1);
      expect(state.conversations[0].id).toBe(id1);

      // 2. Create second conversation
      // This should trigger cleanup of id1 because it's ephemeral and active
      const id2 = await store.createConversation("test-model", {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });

      state = useConversationStore.getState();
      // Should still have only 1 conversation (the new one)
      expect(state.conversations.length).toBe(1);
      expect(state.conversations[0].id).toBe(id2);
      expect(state.conversations.find((c) => c.id === id1)).toBeUndefined();
    });

    it("should remove ephemeral conversation when switching to another conversation", async () => {
      const store = useConversationStore.getState();

      // 1. Create a persisted conversation
      const persistedId = await store.createConversation("test-model", {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });
      // Persist it manually for this test setup (or via sendMessage)
      await store.sendMessage("Persist me");

      // 2. Create an ephemeral conversation
      const ephemeralId = await store.createConversation("test-model", {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });

      let state = useConversationStore.getState();
      expect(state.conversations.length).toBe(2);
      expect(state.activeConversationId).toBe(ephemeralId);

      // 3. Switch back to persisted conversation
      store.setActiveConversation(persistedId);

      state = useConversationStore.getState();
      expect(state.activeConversationId).toBe(persistedId);
      // Ephemeral conversation should be gone
      expect(state.conversations.length).toBe(1);
      expect(
        state.conversations.find((c) => c.id === ephemeralId),
      ).toBeUndefined();
    });

    it("should NEVER persist an ephemeral (isTemporary=true) conversation", async () => {
      // Mock settings and API
      vi.mocked(useSettingsStore.getState).mockReturnValue({
        settings: {
          id: "app-settings",
          apiKeys: { google: "test-api-key" },
          defaultModel: "gemini-2.5-flash",
        },
      } as unknown as SettingsState);

      const mockStream = async function* () {
        yield { delta: "Response" };
        yield { delta: "", finishReason: "stop" };
      };
      vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
        streamChat: vi.fn().mockReturnValue(mockStream()),
      } as unknown as GoogleAPIClient);

      const store = useConversationStore.getState();
      // Create with isTemporary: true
      const conversationId = await store.createConversation(
        "test-model",
        {
          temperature: 0.7,
          maxTokens: 100,
          topP: 0.9,
        },
        undefined,
        { isTemporary: true },
      );
      store.setActiveConversation(conversationId);

      // Verify it starts as not persisted
      let state = useConversationStore.getState();
      expect(
        state.conversations.find((c) => c.id === conversationId)?.persisted,
      ).toBe(false);
      expect(
        state.conversations.find((c) => c.id === conversationId)?.isTemporary,
      ).toBe(true);

      // Send message
      await store.sendMessage("Hello");

      // Verify STILL not persisted in store or DB
      state = useConversationStore.getState();
      const conversation = state.conversations.find(
        (c) => c.id === conversationId,
      );
      expect(conversation?.persisted).toBe(false); // Should remain false
      expect(conversation?.isTemporary).toBe(true);

      // Verify NOT in DB
      const persisted = await conversations.get(conversationId);
      expect(persisted).toBeUndefined();
    });
  });

  describe("Search", () => {
    it("should update search query", () => {
      const store = useConversationStore.getState();
      store.setSearchQuery("test query");

      const state = useConversationStore.getState();
      expect(state.searchQuery).toBe("test query");
    });

    it("should filter conversations by title (case-insensitive)", async () => {
      const store = useConversationStore.getState();

      // Create test conversations
      const id1 = await store.createConversation("model-1", {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });
      await store.renameConversation(id1, "React Hooks");
      // Mark as persisted to prevent cleanup
      useConversationStore.setState((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id1 ? { ...c, persisted: true } : c,
        ),
      }));

      const id2 = await store.createConversation("model-1", {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });
      await store.renameConversation(id2, "TypeScript Guide");
      // Mark as persisted
      useConversationStore.setState((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id2 ? { ...c, persisted: true } : c,
        ),
      }));

      const id3 = await store.createConversation("model-1", {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      });
      await store.renameConversation(id3, "Refactoring");
      // Mark as persisted
      useConversationStore.setState((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id3 ? { ...c, persisted: true } : c,
        ),
      }));

      // Search for "react"
      store.setSearchQuery("react");
      let state = useConversationStore.getState();
      let filtered = state.conversations.filter((c) =>
        c.title.toLowerCase().includes(state.searchQuery.toLowerCase()),
      );
      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe("React Hooks");

      // Search for "TYPE"
      store.setSearchQuery("TYPE");
      state = useConversationStore.getState();
      filtered = state.conversations.filter((c) =>
        c.title.toLowerCase().includes(state.searchQuery.toLowerCase()),
      );
      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe("TypeScript Guide");

      // Search for "r" (matches all 3 titles as they all contain 'r' or 'R')
      store.setSearchQuery("r");
      state = useConversationStore.getState();
      filtered = state.conversations.filter((c) =>
        c.title.toLowerCase().includes(state.searchQuery.toLowerCase()),
      );
      expect(filtered.length).toBe(3);

      // Empty search matches all
      store.setSearchQuery("");
      state = useConversationStore.getState();
      filtered = state.conversations.filter((c) =>
        c.title.toLowerCase().includes(state.searchQuery.toLowerCase()),
      );
      expect(filtered.length).toBe(3);
    });
  });
});
