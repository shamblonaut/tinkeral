import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppearanceSettings } from "../AppearanceSettings";

const mockSetTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({
    theme: "system",
    setTheme: mockSetTheme,
  })),
}));

describe("AppearanceSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders after mount and updates theme", async () => {
    render(<AppearanceSettings />);

    const lightButton = await screen.findByRole("button", { name: /light/i });
    fireEvent.click(lightButton);

    expect(mockSetTheme).toHaveBeenCalledWith("light");
    expect(screen.getByRole("button", { name: /system/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dark/i })).toBeInTheDocument();
  });
});
