import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db, functions as functionsDB } from "@/db";

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

  it("ensureFunctionsLoaded should skip loading when already loaded unless forced", async () => {
    const loadSpy = vi.spyOn(useFunctionsStore.getState(), "loadFunctions");

    useFunctionsStore.setState({ hasLoaded: true });
    await useFunctionsStore.getState().ensureFunctionsLoaded();
    expect(loadSpy).not.toHaveBeenCalled();

    await useFunctionsStore.getState().ensureFunctionsLoaded(true);
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });

  it("loadFunctions should set error when db read fails", async () => {
    vi.spyOn(functionsDB, "getAll").mockRejectedValueOnce(new Error("db-fail"));

    await useFunctionsStore.getState().loadFunctions();

    const state = useFunctionsStore.getState();
    expect(state.error).toBe("Failed to load functions");
    expect(state.hasLoaded).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it("createFunction should set error and rethrow on db failure", async () => {
    vi.spyOn(functionsDB, "create").mockRejectedValueOnce(
      new Error("create-fail"),
    );

    await expect(
      useFunctionsStore.getState().createFunction(makeFunction()),
    ).rejects.toThrow("create-fail");

    expect(useFunctionsStore.getState().error).toBe(
      "Failed to create function",
    );
  });

  it("importExamples should honor names filter and ignoreExisting", async () => {
    await useFunctionsStore.getState().createFunction({
      ...makeFunction(),
      name: "calculate",
    });

    await useFunctionsStore.getState().importExamples(["calculate"], true);
    expect(
      useFunctionsStore
        .getState()
        .functions.filter((f) => f.name === "calculate"),
    ).toHaveLength(1);

    await useFunctionsStore.getState().importExamples(["calculate"], false);
    expect(
      useFunctionsStore
        .getState()
        .functions.filter((f) => f.name === "calculate"),
    ).toHaveLength(2);
  });
});
