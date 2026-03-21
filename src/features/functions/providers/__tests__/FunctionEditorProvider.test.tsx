import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useContext, useEffect } from "react";
import { toast } from "sonner";
import { FunctionEditorContext } from "../../context";
import { useFunctionsStore } from "../../store";
import type { FunctionEditorContextValue, JSONSchema } from "../../types";
import { FunctionEditorProvider } from "../FunctionEditorProvider";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the store
vi.mock("../../store", () => ({
  useFunctionsStore: vi.fn(),
}));

const mockCreateFunction = vi.fn();
const mockUpdateFunction = vi.fn();

function setupStore(functions: unknown[] = []) {
  vi.mocked(useFunctionsStore).mockImplementation(((
    selector: (s: unknown) => unknown,
  ) => {
    return selector({
      createFunction: mockCreateFunction,
      updateFunction: mockUpdateFunction,
      functions,
    });
  }) as unknown as typeof useFunctionsStore);
}

function TestConsumer({
  onAction,
}: {
  onAction?: (ctx: FunctionEditorContextValue | null) => void;
}) {
  const ctx = useContext(FunctionEditorContext);
  useEffect(() => {
    if (onAction) {
      onAction(ctx);
    }
  }, [ctx, onAction]);

  if (!ctx) return <div>No Context</div>;

  return (
    <div>
      <span data-testid="name">{ctx.name}</span>
      <span data-testid="isDirty">{String(ctx.isDirty)}</span>
      <span data-testid="error-name">{ctx.errors.name}</span>
      <button onClick={() => ctx.setName("New_Name")}>Set Name</button>
      <button onClick={() => ctx.setImplementation("return true;")}>
        Set Code
      </button>
      <button onClick={() => ctx.handleNameBlur(ctx.name)}>Blur Name</button>
      <button onClick={() => ctx.validateDraft()}>Validate</button>
      <button onClick={() => ctx.saveMetadata()}>Save</button>
    </div>
  );
}

describe("FunctionEditorProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore([]);
  });

  it("provides default values", () => {
    render(
      <FunctionEditorProvider>
        <TestConsumer />
      </FunctionEditorProvider>,
    );
    expect(screen.getByTestId("name")).toHaveTextContent("");
    expect(screen.getByTestId("isDirty")).toHaveTextContent("false");
  });

  it("updates name and marks as dirty", async () => {
    const user = userEvent.setup();
    render(
      <FunctionEditorProvider>
        <TestConsumer />
      </FunctionEditorProvider>,
    );

    await user.click(screen.getByText("Set Name"));
    expect(screen.getByTestId("name")).toHaveTextContent("New_Name");
    expect(screen.getByTestId("isDirty")).toHaveTextContent("true");
  });

  it("validates name format", async () => {
    const user = userEvent.setup();
    render(
      <FunctionEditorProvider>
        <TestConsumer />
      </FunctionEditorProvider>,
    );

    // Empty name should trigger validation error on blur? Or actually name validation might fail if empty
    await user.click(screen.getByText("Blur Name"));

    await waitFor(() => {
      // It should set error
      expect(screen.getByTestId("error-name").textContent).not.toBe("");
    });
  });

  it("saves a new function successfully", async () => {
    const user = userEvent.setup();
    const mockOnSave = vi.fn();
    mockCreateFunction.mockResolvedValueOnce("new-id");

    render(
      <FunctionEditorProvider onSave={mockOnSave}>
        <TestConsumer />
      </FunctionEditorProvider>,
    );

    // Set a valid name and save
    await user.click(screen.getByText("Set Name"));
    await user.click(screen.getByText("Set Code"));
    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockCreateFunction).toHaveBeenCalled();
      expect(mockOnSave).toHaveBeenCalledWith("new-id");
      expect(toast.success).toHaveBeenCalledWith("Function created.");
    });
  });

  it("updates an existing function successfully", async () => {
    const user = userEvent.setup();
    mockUpdateFunction.mockResolvedValueOnce(undefined);

    const initialValues = {
      id: "func-1",
      name: "OldName",
      description: "",
      parameters: { type: "object", properties: {} } as unknown as JSONSchema,
      implementation: "return true;",
      timeout: 5000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    render(
      <FunctionEditorProvider initialValues={initialValues}>
        <TestConsumer />
      </FunctionEditorProvider>,
    );

    // Edit the name
    await user.click(screen.getByText("Set Name"));

    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockUpdateFunction).toHaveBeenCalledWith(
        "func-1",
        expect.objectContaining({ name: "New_Name" }),
      );
      expect(toast.success).toHaveBeenCalledWith("Function saved.");
    });
  });
});
