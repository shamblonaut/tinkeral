import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { conversations, db } from "@/db";
import { GoogleAPIClient } from "@/services/api";
import { useConversationStore } from "@/stores";

vi.mock("@/services/api/google", () => ({
  GoogleAPIClient: {
    createClient: vi.fn(),
  },
}));

describe("CoreSlice", () => {
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

  const createParams = {
    temperature: 0.7,
    maxTokens: 100,
    topP: 0.9,
  };

  it("should create a new conversation", async () => {
    const store = useConversationStore.getState();
    const conversationId = await store.createConversation(
      "test-model",
      createParams,
    );

    expect(conversationId).toBeDefined();

    const state = useConversationStore.getState();
    expect(state.conversations.length).toBe(1);
    expect(state.activeConversationId).toBe(conversationId);
    expect(state.conversations[0].modelId).toBe("test-model");
    expect(state.conversations[0].createdAt).toBeDefined();

    // Verify NOT persisted (persisted:false by default)
    const persisted = await conversations.get(conversationId);
    expect(persisted).toBeUndefined();
    expect(state.conversations[0].persisted).toBe(false);
  });

  it("should delete a conversation", async () => {
    const store = useConversationStore.getState();
    const conversationId = await store.createConversation(
      "test-model",
      createParams,
    );

    await store.deleteConversation(conversationId);

    const state = useConversationStore.getState();
    expect(state.conversations.length).toBe(0);
    expect(state.activeConversationId).toBeNull();

    // Verify persistence
    const persisted = await conversations.get(conversationId);
    expect(persisted).toBeUndefined();
  });

  it("should rename a conversation", async () => {
    const store = useConversationStore.getState();
    const id = await store.createConversation("test-model", createParams);

    await store.renameConversation(id, "New Title");

    const state = useConversationStore.getState();
    const conversation = state.conversations.find((c) => c.id === id);
    expect(conversation?.title).toBe("New Title");

    // Manually persist to test persistence update
    if (conversation) {
      await conversations.save({ ...conversation, persisted: true });
      useConversationStore.setState((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id ? { ...c, persisted: true } : c,
        ),
      }));
    }

    await store.renameConversation(id, "Another Title");

    const persisted = await conversations.get(id);
    expect(persisted?.title).toBe("Another Title");
  });

  it("should duplicate a conversation", async () => {
    const store = useConversationStore.getState();
    const originalId = await store.createConversation("test-model", {
      ...createParams,
      temperature: 0.5,
    });

    // Manually persist the original conversation so it can be duplicated properly
    const stateBefore = useConversationStore.getState();
    const original = stateBefore.conversations.find(
      (c) => c.id === originalId,
    )!;
    await conversations.save({ ...original, persisted: true });

    // Sync store to reflect persistence
    useConversationStore.setState((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === originalId ? { ...c, persisted: true } : c,
      ),
    }));

    const newId = await store.duplicateConversation(originalId);

    const stateAfter = useConversationStore.getState();
    expect(stateAfter.conversations.length).toBe(2);
    expect(stateAfter.activeConversationId).toBe(newId);

    const duplicate = stateAfter.conversations.find((c) => c.id === newId);
    expect(duplicate).toBeDefined();
    expect(duplicate?.title).toBe("New Conversation (Copy)");
    expect(duplicate?.modelId).toBe("test-model");
    expect(duplicate?.parameters.temperature).toBe(0.5);

    // Verify persistence
    const persisted = await conversations.get(newId);
    expect(persisted).toBeDefined();
    expect(persisted?.title).toBe("New Conversation (Copy)");
  });

  describe("Draft Conversations (Non-Persisted)", () => {
    it("should reuse ephemeral conversation when creating a new one", async () => {
      const store = useConversationStore.getState();
      const id1 = await store.createConversation("test-model", createParams);

      expect(useConversationStore.getState().conversations.length).toBe(1);

      const id2 = await store.createConversation("new-model", createParams);

      const state = useConversationStore.getState();
      expect(state.conversations.length).toBe(1);
      expect(state.conversations[0].id).toBe(id1);
      expect(state.conversations[0].modelId).toBe("new-model");
      expect(id1).toBe(id2);
    });

    it("should keep ephemeral conversation when switching to another", async () => {
      const store = useConversationStore.getState();
      const pId = await store.createConversation("test-model", createParams);

      // Mock persistence
      useConversationStore.setState((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === pId ? { ...c, persisted: true } : c,
        ),
      }));

      await store.createConversation("test-model", createParams);
      expect(useConversationStore.getState().conversations.length).toBe(2);

      store.setActiveConversation(pId);

      const state = useConversationStore.getState();
      expect(state.conversations.length).toBe(2);
      expect(state.activeConversationId).toBe(pId);
    });
  });

  describe("loadModels", () => {
    it("should populate availableModels on success", async () => {
      const mockModels = [
        { id: "gemini-pro", name: "Gemini Pro" },
        { id: "gemini-flash", name: "Gemini Flash" },
      ];
      vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
        getModels: vi.fn().mockResolvedValue(mockModels),
      } as unknown as GoogleAPIClient);

      // Ensure a stored API key is present
      const { useSettingsStore } = await import("@/stores");
      useSettingsStore.setState({
        settings: {
          id: "app-settings",
          apiKeys: { google: "test-key" },
          defaultModel: "gemini-pro",
          defaultParameters: { temperature: 0.7, maxTokens: 1024, topP: 0.9 },
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
      });

      useConversationStore.setState({ availableModels: [] });
      await useConversationStore.getState().loadModels();

      expect(useConversationStore.getState().availableModels).toEqual(
        mockModels,
      );
    });

    it("should not set models if no API key is configured", async () => {
      const { useSettingsStore } = await import("@/stores");
      useSettingsStore.setState({
        settings: {
          id: "app-settings",
          apiKeys: {},
          defaultModel: "gemini-pro",
          defaultParameters: { temperature: 0.7, maxTokens: 1024, topP: 0.9 },
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
      });

      useConversationStore.setState({ availableModels: [] });
      await useConversationStore.getState().loadModels();

      // Should remain empty since no key was present
      expect(useConversationStore.getState().availableModels).toEqual([]);
    });
  });

  describe("loadConversations — error handling", () => {
    it("should set error state when DB load fails", async () => {
      // Spy on conversations.getAll to throw
      const spy = vi
        .spyOn(await import("@/db").then((m) => m.conversations), "getAll")
        .mockRejectedValueOnce(new Error("DB read failure"));

      await useConversationStore.getState().loadConversations();

      const state = useConversationStore.getState();
      expect(state.error).toBe("Failed to load conversations");
      expect(state.isLoading).toBe(false);

      spy.mockRestore();
    });
  });

  describe("renameConversation — isTemporary guard", () => {
    it("should update title in-memory but NOT persist for temporary conversations", async () => {
      const store = useConversationStore.getState();
      const id = await store.createConversation(
        "test-model",
        createParams,
        undefined,
        { isTemporary: true },
      );

      // Persist manually to confirm DB is NOT updated after rename
      await conversations.save({
        ...useConversationStore
          .getState()
          .conversations.find((c) => c.id === id)!,
        persisted: true,
      });

      await store.renameConversation(id, "Renamed Temp");

      // In-memory title should be updated
      const inMemory = useConversationStore
        .getState()
        .conversations.find((c) => c.id === id);
      expect(inMemory?.title).toBe("Renamed Temp");

      // DB should NOT be updated for temporary conversations
      const persisted = await conversations.get(id);
      expect(persisted?.title).toBe("New Conversation");
    });
  });
});
