import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FunctionDefinition } from "../../types";

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserver;

import { TooltipProvider } from "@/shared/components/ui";
import { FunctionSidebarResults } from "../FunctionSidebarResults";

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
};

const triggerClick = (element: Element) => {
  fireEvent.pointerDown(element);
  fireEvent.mouseDown(element);
  fireEvent.pointerUp(element);
  fireEvent.mouseUp(element);
  fireEvent.click(element);
};

const mockFunction: FunctionDefinition = {
  id: "fn-1",
  name: "testFunction",
  description: "A test function",
  parameters: { type: "object", properties: {} },
  implementation: "return true;",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("FunctionSidebarResults", () => {
  const baseProps = {
    filteredFunctions: [],
    isLoading: false,
    isSearching: false,
    searchQuery: "",
    selectedFunctionId: null,
    isSelectionMode: false,
    selectedIds: [],
    onSelect: vi.fn(),
    onToggleSelection: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn().mockResolvedValue(undefined),
    onDuplicate: vi.fn().mockResolvedValue(undefined),
    onShowImportExamples: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Explicitly reset baseProps mocks
    baseProps.onSelect.mockClear();
    baseProps.onToggleSelection.mockClear();
    baseProps.onDelete.mockClear();
    baseProps.onRename.mockClear();
    baseProps.onDuplicate.mockClear();
    baseProps.onShowImportExamples.mockClear();
  });

  it("renders empty state during search with no results", () => {
    renderWithProvider(
      <FunctionSidebarResults {...baseProps} searchQuery="foo" />,
    );
    expect(
      screen.getByText('No matching results for "foo"'),
    ).toBeInTheDocument();
  });

  it("calls onSelect when clicking a function in normal mode", async () => {
    renderWithProvider(
      <FunctionSidebarResults
        {...baseProps}
        filteredFunctions={[mockFunction]}
      />,
    );

    // The ExpandableSelectableItemCard has role="button"
    const item = screen.getByRole("button", {
      name: /Open function testFunction/i,
    });
    triggerClick(item);

    expect(baseProps.onSelect).toHaveBeenCalledWith("fn-1");
  });

  it("calls onToggleSelection when clicking a function in selection mode", async () => {
    renderWithProvider(
      <FunctionSidebarResults
        {...baseProps}
        filteredFunctions={[mockFunction]}
        isSelectionMode={true}
      />,
    );

    const item = screen.getByRole("button", {
      name: /Select function testFunction/i,
    });
    triggerClick(item);

    expect(baseProps.onToggleSelection).toHaveBeenCalledWith("fn-1");
    expect(baseProps.onSelect).not.toHaveBeenCalled();
  });

  it("renders the import examples button and handles clicks", async () => {
    renderWithProvider(<FunctionSidebarResults {...baseProps} />);

    const btn = screen.getByRole("button", {
      name: /Import Example Functions/i,
    });
    triggerClick(btn);

    expect(baseProps.onShowImportExamples).toHaveBeenCalled();
  });

  it("expands a function item to show details", async () => {
    renderWithProvider(
      <FunctionSidebarResults
        {...baseProps}
        filteredFunctions={[mockFunction]}
      />,
    );

    const expandBtn = screen.getByRole("button", { name: /Toggle details/i });
    triggerClick(expandBtn);

    expect(screen.getByText("A test function")).toBeInTheDocument();
    expect(screen.getByText(/Timeout/i)).toBeInTheDocument();
    expect(screen.getByText("5000 ms")).toBeInTheDocument();
  });

  it("handles renaming a function", async () => {
    renderWithProvider(
      <FunctionSidebarResults
        {...baseProps}
        filteredFunctions={[mockFunction]}
      />,
    );

    // Expand to see actions
    triggerClick(screen.getByRole("button", { name: /Toggle details/i }));

    // Click Rename
    triggerClick(screen.getByRole("button", { name: /Rename/i }));

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("testFunction");

    fireEvent.change(input, { target: { value: "newName" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(baseProps.onRename).toHaveBeenCalledWith("fn-1", "newName");
  });

  it("handles duplicating a function", async () => {
    renderWithProvider(
      <FunctionSidebarResults
        {...baseProps}
        filteredFunctions={[mockFunction]}
      />,
    );

    triggerClick(screen.getByRole("button", { name: /Toggle details/i }));
    triggerClick(screen.getByRole("button", { name: /Duplicate/i }));

    expect(baseProps.onDuplicate).toHaveBeenCalledWith("fn-1");
  });

  it("handles deleting a function", async () => {
    renderWithProvider(
      <FunctionSidebarResults
        {...baseProps}
        filteredFunctions={[mockFunction]}
      />,
    );

    triggerClick(screen.getByRole("button", { name: /Toggle details/i }));
    triggerClick(screen.getByRole("button", { name: /Delete/i }));

    expect(baseProps.onDelete).toHaveBeenCalledWith("fn-1", expect.anything());
  });

  it("supports keyboard navigation for selection", async () => {
    renderWithProvider(
      <FunctionSidebarResults
        {...baseProps}
        filteredFunctions={[mockFunction]}
      />,
    );

    const item = screen.getByRole("button", {
      name: /Open function testFunction/i,
    });
    item.focus();
    fireEvent.keyDown(item, { key: "Enter", code: "Enter" });

    expect(baseProps.onSelect).toHaveBeenCalledWith("fn-1");
  });
});
