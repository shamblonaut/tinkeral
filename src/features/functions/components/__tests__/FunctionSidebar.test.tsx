import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "@/shared/hooks";
import type { PlatformView } from "@/shared/store/ui";
import { useUIStore } from "@/shared/store/ui";

import { FunctionSidebar } from "../FunctionSidebar";

const functionSidebarListSpy = vi.fn();
const responsiveShellSpy = vi.fn();

vi.mock("@/shared/hooks", () => ({
  useMediaQuery: vi.fn(),
}));

vi.mock("@/shared/store/ui", () => ({
  useUIStore: vi.fn(),
}));

vi.mock("@/features/chat", () => ({
  ResponsiveSidebarShell: (props: unknown) => {
    responsiveShellSpy(props);
    const shellProps = props as {
      title: string;
      content: ReactNode;
    };
    return (
      <div>
        <h2>{shellProps.title}</h2>
        {shellProps.content}
      </div>
    );
  },
}));

vi.mock("../FunctionSidebarList", () => ({
  FunctionSidebarList: (props: unknown) => {
    functionSidebarListSpy(props);
    return <div data-testid="function-sidebar-list" />;
  },
}));

describe("FunctionSidebar", () => {
  const toggleSidebar = vi.fn();
  const setSidebarOpen = vi.fn();
  const openModal = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useUIStore).mockImplementation((selector) =>
      selector({
        platformView: "chat" as PlatformView,
        isSidebarOpen: true,
        isChatSettingsOpen: false,
        activeModal: null,
        toasts: [],
        selectedFunctionId: null,
        setPlatformView: vi.fn(),
        toggleSidebar,
        setSidebarOpen,
        toggleChatSettings: vi.fn(),
        setChatSettingsOpen: vi.fn(),
        openModal,
        closeModal: vi.fn(),
        addToast: vi.fn(),
        removeToast: vi.fn(),
        selectFunction: vi.fn(),
      }),
    );
  });

  it("passes desktop mode without mobile close handler", async () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    const user = userEvent.setup();

    render(<FunctionSidebar />);

    const lastListProps = functionSidebarListSpy.mock.calls.at(-1)?.[0] as {
      onSelect?: () => void;
    };
    expect(lastListProps.onSelect).toBeUndefined();

    await user.click(screen.getByRole("button", { name: /open settings/i }));
    expect(openModal).toHaveBeenCalledWith("settings");

    const shellProps = responsiveShellSpy.mock.calls.at(-1)?.[0] as {
      isDesktop: boolean;
      onToggleDesktop: () => void;
      onOpenChange: (open: boolean) => void;
    };
    expect(shellProps.isDesktop).toBe(true);
    shellProps.onToggleDesktop();
    shellProps.onOpenChange(false);
    expect(toggleSidebar).toHaveBeenCalled();
    expect(setSidebarOpen).toHaveBeenCalledWith(false);
  });

  it("closes sidebar on mobile function selection", () => {
    vi.mocked(useMediaQuery).mockReturnValue(false);
    render(<FunctionSidebar />);

    const lastListProps = functionSidebarListSpy.mock.calls.at(-1)?.[0] as {
      onSelect?: () => void;
    };
    expect(typeof lastListProps.onSelect).toBe("function");

    lastListProps.onSelect?.();
    expect(setSidebarOpen).toHaveBeenCalledWith(false);
  });
});
