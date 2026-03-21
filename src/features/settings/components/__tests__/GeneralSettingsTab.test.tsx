import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleAPIClient } from "@/shared/services/api";

import type { SettingsState } from "../../store";
import { useSettingsStore } from "../../store";
import { GeneralSettingsTab } from "../GeneralSettingsTab";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/shared/services/api", () => ({
  GoogleAPIClient: {
    validateKey: vi.fn(),
  },
}));

vi.mock("../../store", () => ({
  useSettingsStore: vi.fn(),
}));

describe("GeneralSettingsTab", () => {
  const setApiKey = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSettingsStore).mockImplementation((selector) =>
      selector({
        settings: {
          id: "app-settings",
          apiKeys: { google: "saved-key" },
          defaultModel: "gemini-2.5-flash",
          defaultParameters: { temperature: 0.7, topP: 0.9, maxTokens: 1024 },
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
        setApiKey,
        updatePreferences: vi.fn(),
      } as SettingsState),
    );
  });

  it("disables save when key is unchanged", () => {
    render(<GeneralSettingsTab />);
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("validates and saves trimmed key", async () => {
    vi.mocked(GoogleAPIClient.validateKey).mockResolvedValue(true);
    setApiKey.mockResolvedValue(undefined);

    render(<GeneralSettingsTab />);

    const input = screen.getByPlaceholderText(/enter key/i);
    fireEvent.change(input, { target: { value: "  new-key  " } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(GoogleAPIClient.validateKey).toHaveBeenCalledWith("  new-key  ");
      expect(setApiKey).toHaveBeenCalledWith("google", "new-key");
      expect(toast.success).toHaveBeenCalledWith("API key saved successfully");
    });
  });

  it("shows invalid key error", async () => {
    vi.mocked(GoogleAPIClient.validateKey).mockResolvedValue(false);

    render(<GeneralSettingsTab />);

    const input = screen.getByPlaceholderText(/enter key/i);
    fireEvent.change(input, { target: { value: "invalid" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Invalid API key. Please check and try again.",
      );
    });
    expect(setApiKey).not.toHaveBeenCalled();
  });
});
