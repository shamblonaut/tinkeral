import { create } from "zustand";

import { settings, type AppSettings } from "@/db";
import type { UIPreferences } from "@/types";

export interface SettingsState {
  settings: AppSettings | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (changes: Partial<AppSettings>) => Promise<void>;
  setApiKey: (provider: string, key: string) => Promise<void>;
  updatePreferences: (prefs: Partial<UIPreferences>) => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  id: "app-settings",
  apiKeys: {},
  defaultModel: "gemini-1.5-pro",
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
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  isLoading: false,
  error: null,

  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const storedSettings = await settings.get();
      if (storedSettings) {
        set({ settings: storedSettings, isLoading: false });
      } else {
        // Initialize default settings if none exist
        await settings.save(DEFAULT_SETTINGS);
        set({ settings: DEFAULT_SETTINGS, isLoading: false });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      set({ error: "Failed to load settings", isLoading: false });
    }
  },

  updateSettings: async (changes: Partial<AppSettings>) => {
    const currentSettings = get().settings;
    if (!currentSettings) return;

    const updatedSettings = { ...currentSettings, ...changes };

    try {
      await settings.save(updatedSettings);
      set({ settings: updatedSettings });
    } catch (error) {
      console.error("Failed to update settings:", error);
      set({ error: "Failed to update settings" });
    }
  },

  setApiKey: async (provider: string, key: string) => {
    const currentSettings = get().settings;
    if (!currentSettings) return;

    const updatedSettings = {
      ...currentSettings,
      apiKeys: {
        ...currentSettings.apiKeys,
        [provider]: key,
      },
    };

    try {
      await settings.save(updatedSettings);
      set({ settings: updatedSettings });
    } catch (error) {
      console.error("Failed to set API key:", error);
      set({ error: "Failed to set API key" });
    }
  },

  updatePreferences: async (prefs: Partial<UIPreferences>) => {
    const currentSettings = get().settings;
    if (!currentSettings) return;

    const updatedSettings = {
      ...currentSettings,
      uiPreferences: {
        ...currentSettings.uiPreferences,
        ...prefs,
      },
    };

    try {
      await settings.save(updatedSettings);
      set({ settings: updatedSettings });
    } catch (error) {
      console.error("Failed to update preferences:", error);
      set({ error: "Failed to update preferences" });
    }
  },
}));
