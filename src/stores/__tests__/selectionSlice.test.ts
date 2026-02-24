import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { conversations, db } from "@/db";
import { useConversationStore } from "@/stores";
import type { Conversation } from "@/types";

const createMockConv = (
  id: string,
  title: string,
  updatedAt: number,
): Conversation => ({
  id,
  title,
  messages: [],
  modelId: "m1",
  parameters: {
    temperature: 0.7,
    maxTokens: 1024,
    topP: 0.9,
  },
  createdAt: Date.now(),
  updatedAt,
  persisted: true,
});

describe("SelectionSlice", () => {
  beforeEach(async () => {
    await db.conversations.clear();
    useConversationStore.setState({
      conversations: [
        createMockConv("1", "Conv 1", 1),
        createMockConv("2", "Conv 2", 2),
        createMockConv("3", "Conv 3", 3),
      ],
      isSelectionMode: false,
      selectedIds: [],
      searchQuery: "",
    });
  });

  it("should toggle selection mode", () => {
    const store = useConversationStore.getState();
    store.toggleSelectionMode();
    expect(useConversationStore.getState().isSelectionMode).toBe(true);

    // Toggle again should clear selection
    useConversationStore.setState({ selectedIds: ["1"] });
    store.toggleSelectionMode();
    expect(useConversationStore.getState().isSelectionMode).toBe(false);
    expect(useConversationStore.getState().selectedIds).toEqual([]);
  });

  it("should toggle selection of items", () => {
    const store = useConversationStore.getState();
    store.toggleSelection("1");
    expect(useConversationStore.getState().selectedIds).toEqual(["1"]);

    store.toggleSelection("2");
    expect(useConversationStore.getState().selectedIds).toEqual(["1", "2"]);

    store.toggleSelection("1");
    expect(useConversationStore.getState().selectedIds).toEqual(["2"]);
  });

  it("should select and deselect all visible items", () => {
    const store = useConversationStore.getState();

    store.selectAll();
    expect(useConversationStore.getState().selectedIds).toEqual([
      "1",
      "2",
      "3",
    ]);

    store.deselectAll();
    expect(useConversationStore.getState().selectedIds).toEqual([]);

    // Test with search filter
    store.setSearchQuery("Conv 1");
    store.selectAll();
    expect(useConversationStore.getState().selectedIds).toEqual(["1"]);
  });

  it("should delete selected conversations", async () => {
    const store = useConversationStore.getState();

    // Persist to DB first
    for (const c of useConversationStore.getState().conversations) {
      await conversations.save(c);
    }

    useConversationStore.setState({ selectedIds: ["1", "2"] });

    await store.deleteSelectedConversations();

    const state = useConversationStore.getState();
    expect(state.conversations.length).toBe(1);
    expect(state.conversations[0].id).toBe("3");
    expect(state.selectedIds).toEqual([]);
    expect(state.isSelectionMode).toBe(false);

    // Verify DB
    expect(await conversations.get("1")).toBeUndefined();
    expect(await conversations.get("2")).toBeUndefined();
    expect(await conversations.get("3")).toBeDefined();
  });
});

describe("SearchSlice", () => {
  beforeEach(() => {
    useConversationStore.setState({
      conversations: [
        createMockConv("1", "React Hooks", 1),
        createMockConv("2", "TypeScript Guide", 2),
        createMockConv("3", "Refactoring", 3),
      ],
      searchQuery: "",
      isSearching: false,
    });
  });

  it("should update search query", () => {
    const store = useConversationStore.getState();
    store.setSearchQuery("test query");
    expect(useConversationStore.getState().searchQuery).toBe("test query");
  });

  it("should toggle isSearching state", () => {
    const store = useConversationStore.getState();
    store.setIsSearching(true);
    expect(useConversationStore.getState().isSearching).toBe(true);

    store.setIsSearching(false);
    expect(useConversationStore.getState().isSearching).toBe(false);
  });

  it("should filter conversations by title (case-insensitive)", () => {
    const store = useConversationStore.getState();

    store.setSearchQuery("react");
    let state = useConversationStore.getState();
    let filtered = state.conversations.filter((c) =>
      c.title.toLowerCase().includes(state.searchQuery.toLowerCase()),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("React Hooks");

    store.setSearchQuery("TYPE");
    state = useConversationStore.getState();
    filtered = state.conversations.filter((c) =>
      c.title.toLowerCase().includes(state.searchQuery.toLowerCase()),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("TypeScript Guide");
  });
});
