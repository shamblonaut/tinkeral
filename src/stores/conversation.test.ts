import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/db";
import { conversations } from "../db/operations";
import { useConversationStore } from "./conversation";

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

  it("should add a message to a conversation", async () => {
    const store = useConversationStore.getState();
    const conversationId = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });

    const message = {
      id: "msg-1",
      role: "user" as const,
      content: "Hello",
      timestamp: Date.now(),
    };

    await store.addMessage(conversationId, message);

    const state = useConversationStore.getState();
    const conversation = state.conversations.find(
      (c) => c.id === conversationId,
    );

    expect(conversation?.messages.length).toBe(1);
    expect(conversation?.messages[0].content).toBe("Hello");

    // Verify persistence
    const persisted = await conversations.get(conversationId);
    expect(persisted?.messages.length).toBe(1);
    expect(persisted?.messages[0].content).toBe("Hello");
  });

  it("should update a message in a conversation", async () => {
    const store = useConversationStore.getState();
    const conversationId = await store.createConversation("test-model", {
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
    });

    const message = {
      id: "msg-1",
      role: "user" as const,
      content: "Hello",
      timestamp: Date.now(),
    };

    await store.addMessage(conversationId, message);
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
});
