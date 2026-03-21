import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleAPIClient } from "@/shared/services/api";

import type { SettingsState } from "../../store";
import { useSettingsStore } from "../../store";
import { APIKeyModal } from "../APIKeyModal";

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

describe("APIKeyModal", () => {
  const setApiKey = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSettingsStore).mockImplementation((selector) =>
      selector({
        settings: null,
        isLoading: false,
        error: null,
        loadSettings: vi.fn(),
        updateSettings: vi.fn(),
        setApiKey,
        updatePreferences: vi.fn(),
      } as SettingsState),
    );
  });

  it("shows validation error for empty submit", () => {
    render(<APIKeyModal />);
    const form = document.querySelector("form");
    expect(form).toBeTruthy();

    fireEvent.submit(form!);

    expect(toast.error).toHaveBeenCalledWith("Please enter an API key");
    expect(vi.mocked(GoogleAPIClient.validateKey)).not.toHaveBeenCalled();
  });

  it("saves a valid key", async () => {
    vi.mocked(GoogleAPIClient.validateKey).mockResolvedValue(true);
    setApiKey.mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<APIKeyModal />);

    await user.type(
      screen.getByPlaceholderText(/enter your google api key/i),
      "valid-key",
    );
    await user.click(screen.getByRole("button", { name: /start chatting/i }));

    await waitFor(() => {
      expect(GoogleAPIClient.validateKey).toHaveBeenCalledWith("valid-key");
      expect(setApiKey).toHaveBeenCalledWith("google", "valid-key");
      expect(toast.success).toHaveBeenCalledWith("API key saved successfully");
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("handles invalid key", async () => {
    vi.mocked(GoogleAPIClient.validateKey).mockResolvedValue(false);

    const user = userEvent.setup();
    render(<APIKeyModal />);

    await user.type(
      screen.getByPlaceholderText(/enter your google api key/i),
      "bad-key",
    );
    await user.click(screen.getByRole("button", { name: /start chatting/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Invalid API key. Please check and try again.",
      );
    });
    expect(setApiKey).not.toHaveBeenCalled();
  });
});
