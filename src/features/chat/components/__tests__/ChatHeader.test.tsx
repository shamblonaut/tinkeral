import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatHeader } from "../layout/ChatHeader";

describe("ChatHeader", () => {
  const baseProps = {
    platformView: "chat" as const,
    setPlatformView: vi.fn(),
    showFunctionsView: true,
    attachedFunctionCount: 0,
    isSidebarOpen: false,
    toggleSidebar: vi.fn(),
    isSettingsOpen: false,
    toggleSettings: vi.fn(),
    showSettingsToggle: true,
  };

  it("calls toggleSidebar when sidebar button is clicked", async () => {
    const user = userEvent.setup();
    render(<ChatHeader {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /Toggle sidebar/i }));
    expect(baseProps.toggleSidebar).toHaveBeenCalled();
  });

  it("calls setPlatformView when clicking view toggles", async () => {
    const user = userEvent.setup();
    render(<ChatHeader {...baseProps} />);

    await user.click(
      screen.getByRole("button", { name: "Switch to functions view" }),
    );
    expect(baseProps.setPlatformView).toHaveBeenCalledWith("functions");
  });

  it("does not render functions view toggle when showFunctionsView is false", () => {
    render(<ChatHeader {...baseProps} showFunctionsView={false} />);
    expect(
      screen.queryByRole("button", { name: "Switch to functions view" }),
    ).not.toBeInTheDocument();
  });

  it("calls toggleSettings when settings button is clicked", async () => {
    const user = userEvent.setup();
    render(<ChatHeader {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /Toggle settings/i }));
    expect(baseProps.toggleSettings).toHaveBeenCalled();
  });

  it("hides optional toggles when disabled", () => {
    render(
      <ChatHeader
        {...baseProps}
        showFunctionsView={false}
        showSettingsToggle={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Switch to functions view" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Toggle settings/i }),
    ).not.toBeInTheDocument();
  });
});
