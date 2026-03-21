import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationSidebar } from "../layout/ConversationSidebar";

// Mock the dependencies
const mockSetSidebarOpen = vi.fn();
const mockToggleSidebar = vi.fn();
const mockOpenModal = vi.fn();
let mockIsDesktop = true;

vi.mock("@/shared/store/ui", () => ({
  useUIStore: vi.fn((selector) =>
    selector
      ? selector({
          isSidebarOpen: true,
          toggleSidebar: mockToggleSidebar,
          setSidebarOpen: mockSetSidebarOpen,
          openModal: mockOpenModal,
        })
      : {},
  ),
}));

vi.mock("zustand/react/shallow", () => ({
  useShallow: (selector: (s: unknown) => unknown) => selector,
}));

vi.mock("@/shared/hooks", () => ({
  useMediaQuery: vi.fn(() => mockIsDesktop),
  useDebounce: (value: unknown) => value,
}));

// Mock the child components by mocking the parent index file they are imported from
vi.mock("..", () => ({
  ConversationList: ({ onSelect }: { onSelect?: () => void }) => (
    <div data-testid="conversation-list">
      <button onClick={onSelect}>Item</button>
    </div>
  ),
  ResponsiveSidebarShell: ({ content }: { content: React.ReactNode }) => (
    <div data-testid="sidebar-shell">{content}</div>
  ),
}));

describe("ConversationSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDesktop = true;
  });

  it("calls openModal('settings') when Settings button is clicked", async () => {
    const user = userEvent.setup();
    render(<ConversationSidebar />);

    await user.click(screen.getByRole("button", { name: /Settings/i }));
    expect(mockOpenModal).toHaveBeenCalledWith("settings");
  });

  it("does not attach onSelect logic to ConversationList if desktop", async () => {
    const user = userEvent.setup();
    render(<ConversationSidebar />);

    // Simulate ConversationList onSelect
    await user.click(screen.getByText("Item"));
    expect(mockSetSidebarOpen).not.toHaveBeenCalled();
  });

  it("attaches onSelect logic to close sidebar if mobile", async () => {
    const user = userEvent.setup();
    mockIsDesktop = false;
    render(<ConversationSidebar />);

    // Simulate ConversationList onSelect
    await user.click(screen.getByText("Item"));
    expect(mockSetSidebarOpen).toHaveBeenCalledWith(false);
  });
});
