import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "../ErrorBoundary";

const ThrowError = ({ message }: { message: string }) => {
  throw new Error(message);
};

describe("ErrorBoundary", () => {
  const originalLocation = window.location;
  const originalConfirm = window.confirm;
  const originalLocalStorage = window.localStorage;
  const originalIndexedDB = window.indexedDB;

  beforeEach(() => {
    // Mock window.location.reload
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload: vi.fn() },
    });
    // Mock window.confirm
    window.confirm = vi.fn();
    // Mock console.error to avoid cluttering test output
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    window.confirm = originalConfirm;
    Object.defineProperty(window, "localStorage", {
      value: originalLocalStorage,
      writable: true,
    });
    Object.defineProperty(window, "indexedDB", {
      value: originalIndexedDB,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Child Content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
  });

  it("renders error UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Test Error" />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(/An unexpected error occurred/i),
    ).toBeInTheDocument();
  });

  it("reloads the page when Reload button is clicked", () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Test Error" />
      </ErrorBoundary>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Reload Application/i }),
    );
    expect(window.location.reload).toHaveBeenCalled();
  });

  it("resets data and reloads when Reset button is clicked and confirmed", () => {
    // Mock localStorage and indexedDB
    const mockClear = vi.fn();
    const mockDeleteDatabase = vi.fn();
    Object.defineProperty(window, "localStorage", {
      value: { clear: mockClear },
      writable: true,
    });
    Object.defineProperty(window, "indexedDB", {
      value: { deleteDatabase: mockDeleteDatabase },
      writable: true,
    });
    vi.mocked(window.confirm).mockReturnValue(true);

    render(
      <ErrorBoundary>
        <ThrowError message="Test Error" />
      </ErrorBoundary>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Reset Data & Reload/i }),
    );

    expect(window.confirm).toHaveBeenCalled();
    expect(mockClear).toHaveBeenCalled();
    expect(mockDeleteDatabase).toHaveBeenCalledWith("TinkeralDB");
    expect(window.location.reload).toHaveBeenCalled();
  });

  it("does nothing when Reset button is clicked but cancelled", () => {
    const mockClear = vi.fn();
    Object.defineProperty(window, "localStorage", {
      value: { clear: mockClear },
      writable: true,
    });
    vi.mocked(window.confirm).mockReturnValue(false);

    render(
      <ErrorBoundary>
        <ThrowError message="Test Error" />
      </ErrorBoundary>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Reset Data & Reload/i }),
    );

    expect(window.confirm).toHaveBeenCalled();
    expect(mockClear).not.toHaveBeenCalled();
    expect(window.location.reload).not.toHaveBeenCalled();
  });
});
