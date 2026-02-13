import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../db/db";
import { settings } from "../../db/operations";
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
    expect(state.settings?.defaultModel).toBe("gemini-1.5-pro");

    // Verify persistence
    const persisted = await settings.get();
    expect(persisted).toBeDefined();
    expect(persisted?.defaultModel).toBe("gemini-1.5-pro");
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
});
