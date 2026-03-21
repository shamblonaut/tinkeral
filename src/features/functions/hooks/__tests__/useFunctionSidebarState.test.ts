import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFunctionSidebarState } from "../useFunctionSidebarState";

const mockEnsureFunctionsLoaded = vi.fn();
const mockCreateFunction = vi.fn();
const mockUpdateFunction = vi.fn();
const mockDeleteFunction = vi.fn();
const mockSelectFunction = vi.fn();

const mockFunctions = [
  {
    id: "f1",
    name: "Alpha",
    description: "First function",
    implementation: "x",
  },
  {
    id: "f2",
    name: "Beta",
    description: "Second function",
    implementation: "y",
  },
];

vi.mock("zustand/react/shallow", () => ({
  useShallow: (selector: (s: unknown) => unknown) => selector,
}));

let mockFunctionsState = {
  functions: mockFunctions,
  isLoading: false,
};

let mockUIState = {
  selectedFunctionId: "f1",
};

vi.mock("../../store", () => ({
  useFunctionsStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector
      ? selector({
          ...mockFunctionsState,
          ensureFunctionsLoaded: mockEnsureFunctionsLoaded,
          createFunction: mockCreateFunction,
          updateFunction: mockUpdateFunction,
          deleteFunction: mockDeleteFunction,
        })
      : mockFunctionsState,
  ),
}));

vi.mock("@/shared/store/ui", () => ({
  useUIStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector
      ? selector({
          ...mockUIState,
          selectFunction: mockSelectFunction,
        })
      : mockUIState,
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock `useDebounce` to instantly return the input value for easier testing
vi.mock("@/shared/hooks", () => ({
  useDebounce: (value: unknown) => value,
}));

describe("useFunctionSidebarState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFunctionsState = {
      functions: mockFunctions,
      isLoading: false,
    };
    mockUIState = {
      selectedFunctionId: "f1",
    };
  });

  it("loads functions on mount", () => {
    renderHook(() => useFunctionSidebarState({}));
    expect(mockEnsureFunctionsLoaded).toHaveBeenCalled();
  });

  it("filters functions based on search input", () => {
    const { result } = renderHook(() => useFunctionSidebarState({}));

    expect(result.current.filteredFunctions).toHaveLength(2);

    act(() => {
      result.current.setSearchInput("Alpha");
    });

    expect(result.current.searchInput).toBe("Alpha");
    expect(result.current.searchQuery).toBe("Alpha");
    expect(result.current.filteredFunctions).toHaveLength(1);
    expect(result.current.filteredFunctions[0].name).toBe("Alpha");
  });

  it("handles handleSelect", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useFunctionSidebarState({ onSelect }));

    act(() => {
      result.current.handleSelect("f2");
    });

    expect(mockSelectFunction).toHaveBeenCalledWith("f2");
    expect(onSelect).toHaveBeenCalled();
  });

  it("toggles selection mode and selects items", () => {
    const { result } = renderHook(() => useFunctionSidebarState({}));

    expect(result.current.isSelectionMode).toBe(false);

    act(() => {
      result.current.toggleSelectionMode();
    });
    expect(result.current.isSelectionMode).toBe(true);

    act(() => {
      result.current.toggleSelection("f1");
    });
    expect(result.current.selectedIds).toContain("f1");

    act(() => {
      result.current.toggleSelection("f1");
    });
    expect(result.current.selectedIds).not.toContain("f1");
  });

  it("handles duplicate correctly", async () => {
    const { result } = renderHook(() => useFunctionSidebarState({}));

    await act(async () => {
      await result.current.handleDuplicate("f1");
    });

    expect(mockCreateFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Alpha Copy",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Function duplicated.");
  });

  it("handles item rename", async () => {
    const { result } = renderHook(() => useFunctionSidebarState({}));

    await act(async () => {
      await result.current.handleRename("f1", "Alpha V2");
    });

    expect(mockUpdateFunction).toHaveBeenCalledWith("f1", { name: "Alpha V2" });
    expect(toast.success).toHaveBeenCalledWith("Function renamed.");
  });

  it("handles item deletion and updates selectedFunctionId", async () => {
    const { result } = renderHook(() => useFunctionSidebarState({}));

    act(() => {
      // simulate starting a delete
      result.current.handleDelete("f1", {
        stopPropagation: vi.fn(),
      } as unknown as React.MouseEvent);
    });
    expect(result.current.functionToDelete).toBe("f1");

    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(mockDeleteFunction).toHaveBeenCalledWith("f1");
    expect(mockSelectFunction).toHaveBeenCalledWith(null); // was selected!
    expect(toast.success).toHaveBeenCalledWith("Function deleted.");
    expect(result.current.functionToDelete).toBeNull();
  });

  it("handles bulk deletion in selection mode", async () => {
    const { result } = renderHook(() => useFunctionSidebarState({}));

    act(() => {
      result.current.setSelectedIds(["f1", "f2"]);
      result.current.setFunctionToDelete("bulk");
    });

    await act(async () => {
      await result.current.confirmDelete();
    });

    expect(mockDeleteFunction).toHaveBeenCalledWith("f1");
    expect(mockDeleteFunction).toHaveBeenCalledWith("f2");
    expect(result.current.selectedIds).toHaveLength(0);
    expect(toast.success).toHaveBeenCalledWith("Selected functions deleted.");
  });
});
