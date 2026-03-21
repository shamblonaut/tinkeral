import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db, settings } from "@/db";

import { useSettingsStore } from "../settings";

describe("SettingsStore", () => {
  beforeEach(async () => {
    await db.settings.clear();
    useSettingsStore.setState({
      settings: null,
      isLoading: false,
      error: null,
    });
  });

  it("should load default settings if none exist", async () => {
    const store = useSettingsStore.getState();
    await store.loadSettings();

    const state = useSettingsStore.getState();
    expect(state.settings).toBeDefined();
    expect(state.settings?.defaultModel).toBe("gemini-2.5-flash-lite");

    // Verify persistence
    const persisted = await settings.get();
    expect(persisted).toBeDefined();
    expect(persisted?.defaultModel).toBe("gemini-2.5-flash-lite");
  });

  it("should update settings", async () => {
    const store = useSettingsStore.getState();
    await store.loadSettings();

    await store.updateSettings({
      defaultModel: "gemini-1.5-flash",
    });

    const state = useSettingsStore.getState();
    expect(state.settings?.defaultModel).toBe("gemini-1.5-flash");

    // Verify persistence
    const persisted = await settings.get();
    expect(persisted?.defaultModel).toBe("gemini-1.5-flash");
  });

  it("should set API key", async () => {
    const store = useSettingsStore.getState();
    await store.loadSettings();

    await store.setApiKey("google", "test-key");

    const state = useSettingsStore.getState();
    expect(state.settings?.apiKeys["google"]).toBe("test-key");

    // Verify persistence
    const persisted = await settings.get();
    expect(persisted?.apiKeys["google"]).toBe("test-key");
  });

  it("should update preferences", async () => {
    const store = useSettingsStore.getState();
    await store.loadSettings();

    await store.updatePreferences({
      theme: "dark",
    });

    const state = useSettingsStore.getState();
    expect(state.settings?.uiPreferences.theme).toBe("dark");

    // Verify persistence
    const persisted = await settings.get();
    expect(persisted?.uiPreferences.theme).toBe("dark");
  });

  it("should set error when loadSettings fails", async () => {
    vi.spyOn(settings, "get").mockRejectedValueOnce(new Error("load-fail"));

    await useSettingsStore.getState().loadSettings();

    const state = useSettingsStore.getState();
    expect(state.error).toBe("Failed to load settings");
    expect(state.isLoading).toBe(false);
  });

  it("should set error when updateSettings save fails", async () => {
    const store = useSettingsStore.getState();
    await store.loadSettings();
    vi.spyOn(settings, "save").mockRejectedValueOnce(new Error("save-fail"));

    await store.updateSettings({ defaultModel: "gemini-1.5-flash" });

    expect(useSettingsStore.getState().error).toBe("Failed to update settings");
  });

  it("should set error when setApiKey save fails", async () => {
    const store = useSettingsStore.getState();
    await store.loadSettings();
    vi.spyOn(settings, "save").mockRejectedValueOnce(new Error("save-fail"));

    await store.setApiKey("google", "test-key");

    expect(useSettingsStore.getState().error).toBe("Failed to set API key");
  });

  it("should set error when updatePreferences save fails", async () => {
    const store = useSettingsStore.getState();
    await store.loadSettings();
    vi.spyOn(settings, "save").mockRejectedValueOnce(new Error("save-fail"));

    await store.updatePreferences({ theme: "dark" });

    expect(useSettingsStore.getState().error).toBe(
      "Failed to update preferences",
    );
  });
});
