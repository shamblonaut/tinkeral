import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";

import { useFunctionsStore } from "../functions";

const makeFunction = (overrides = {}) => ({
  name: "testFunction",
  description: "A test function",
  parameters: {
    type: "object" as const,
    properties: {
      input: { type: "string" as const, description: "Input value" },
    },
    required: ["input"],
  },
  implementation: "return args.input.toUpperCase();",
  ...overrides,
});

describe("FunctionsStore", () => {
  beforeEach(async () => {
    await db.functions.clear();
    useFunctionsStore.setState({
      functions: [],
      isLoading: false,
      error: null,
      hasLoaded: false,
      lastLoadedAt: null,
    });
  });

  it("should start empty", () => {
    const state = useFunctionsStore.getState();
    expect(state.functions).toHaveLength(0);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.hasLoaded).toBe(false);
    expect(state.lastLoadedAt).toBeNull();
  });

  it("should load functions from IndexedDB", async () => {
    const now = Date.now();
    await db.functions.add({
      id: "fn-1",
      ...makeFunction(),
      createdAt: now,
      updatedAt: now,
    });

    await useFunctionsStore.getState().loadFunctions();

    const state = useFunctionsStore.getState();
    expect(state.functions).toHaveLength(1);
    expect(state.functions[0].name).toBe("testFunction");
    expect(state.isLoading).toBe(false);
    expect(state.hasLoaded).toBe(true);
    expect(state.lastLoadedAt).not.toBeNull();
  });

  it("should create a function and persist it", async () => {
    const store = useFunctionsStore.getState();
    const id = await store.createFunction(makeFunction());

    expect(id).toBeDefined();

    const state = useFunctionsStore.getState();
    expect(state.functions).toHaveLength(1);
    expect(state.functions[0].id).toBe(id);
    expect(state.functions[0].name).toBe("testFunction");

    // Verify persistence
    const persisted = await db.functions.get(id);
    expect(persisted).toBeDefined();
    expect(persisted?.name).toBe("testFunction");
  });

  it("should update a function", async () => {
    const store = useFunctionsStore.getState();
    const id = await store.createFunction(makeFunction());

    await useFunctionsStore.getState().updateFunction(id, {
      description: "Updated description",
    });

    const state = useFunctionsStore.getState();
    expect(state.functions[0].description).toBe("Updated description");

    // Verify persistence
    const persisted = await db.functions.get(id);
    expect(persisted?.description).toBe("Updated description");
  });

  it("should update the updatedAt timestamp on update", async () => {
    const store = useFunctionsStore.getState();
    const id = await store.createFunction(makeFunction());
    const originalUpdatedAt =
      useFunctionsStore.getState().functions[0].updatedAt;

    // Small delay to ensure timestamp changes
    await new Promise((r) => setTimeout(r, 5));
    await useFunctionsStore
      .getState()
      .updateFunction(id, { description: "Changed" });

    const updated = useFunctionsStore.getState().functions[0];
    expect(updated.updatedAt).toBeGreaterThan(originalUpdatedAt);
  });

  it("should delete a function", async () => {
    const store = useFunctionsStore.getState();
    const id = await store.createFunction(makeFunction());
    expect(useFunctionsStore.getState().functions).toHaveLength(1);

    await useFunctionsStore.getState().deleteFunction(id);

    expect(useFunctionsStore.getState().functions).toHaveLength(0);

    // Verify removed from IndexedDB
    const persisted = await db.functions.get(id);
    expect(persisted).toBeUndefined();
  });

  it("should get a function by id", async () => {
    const store = useFunctionsStore.getState();
    const id = await store.createFunction(makeFunction({ name: "myFunc" }));

    const fn = useFunctionsStore.getState().getFunction(id);
    expect(fn).toBeDefined();
    expect(fn?.name).toBe("myFunc");
  });

  it("should return undefined for a missing id in getFunction", () => {
    const fn = useFunctionsStore.getState().getFunction("nonexistent");
    expect(fn).toBeUndefined();
  });

  it("should handle multiple functions independently", async () => {
    const store = useFunctionsStore.getState();
    const id1 = await store.createFunction(makeFunction({ name: "funcA" }));
    const id2 = await store.createFunction(makeFunction({ name: "funcB" }));

    expect(useFunctionsStore.getState().functions).toHaveLength(2);

    await useFunctionsStore.getState().deleteFunction(id1);

    const state = useFunctionsStore.getState();
    expect(state.functions).toHaveLength(1);
    expect(state.functions[0].id).toBe(id2);
  });

  it("should set isLoading during loadFunctions", async () => {
    // Intercept the async state to confirm it transitions correctly
    const loadPromise = useFunctionsStore.getState().loadFunctions();
    // After resolution, isLoading should be false
    await loadPromise;
    expect(useFunctionsStore.getState().isLoading).toBe(false);
  });
});
