import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResponsiveSidebarShell } from "../layout/ResponsiveSidebarShell";

// Mock ResizeObserver for Radix components
global.ResizeObserver = vi.fn().mockImplementation(function (
  this: ResizeObserver,
) {
  this.observe = vi.fn();
  this.unobserve = vi.fn();
  this.disconnect = vi.fn();
});

describe("ResponsiveSidebarShell", () => {
  const defaultProps = {
    title: "Sidebar Title",
    isOpen: true,
    isDesktop: true,
    onToggleDesktop: vi.fn(),
    onOpenChange: vi.fn(),
    content: <div data-testid="sidebar-content">Content</div>,
  };

  it("returns null in desktop view when closed", () => {
    const { container } = render(
      <ResponsiveSidebarShell {...defaultProps} isOpen={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("calls onToggleDesktop when close button is clicked in desktop", async () => {
    const user = userEvent.setup();
    render(<ResponsiveSidebarShell {...defaultProps} />);

    const closeBtn = screen.getByRole("button", { name: /close sidebar/i });
    await user.click(closeBtn);

    expect(defaultProps.onToggleDesktop).toHaveBeenCalled();
  });

  it("renders mobile view correctly (Sheet)", async () => {
    render(<ResponsiveSidebarShell {...defaultProps} isDesktop={false} />);

    expect(screen.getAllByText("Sidebar Title").length).toBeGreaterThan(0);
    expect(screen.getByTestId("sidebar-content")).toBeInTheDocument();
  });
});
