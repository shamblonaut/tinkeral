import "fake-indexeddb/auto";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forwardRef, useImperativeHandle, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FunctionDefinition } from "@/types";

import type { CodeEditorHandle, CodeEditorProps } from "../CodeEditor";

// ---------------------------------------------------------------------------
// Environment polyfills
// ---------------------------------------------------------------------------

// ScrollArea (used by FunctionForm) requires ResizeObserver which JSDOM lacks
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Stub CodeEditor — renders a plain <textarea> so userEvent can type into it,
// and wires the imperative handle so FunctionForm's editorRef.getValue() works.
const StubCodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  function StubCodeEditor({ value = "", onChange, onBlur }, ref) {
    useImperativeHandle(ref, () => ({
      getValue: () => value,
      focus: vi.fn(),
    }));
    return (
      <textarea
        data-testid="code-editor"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={() => onBlur?.()}
      />
    );
  },
);

vi.mock("../CodeEditor", () => ({
  default: StubCodeEditor,
}));

// Mock sonner so toast calls don't throw
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

// Hoist mock primitives so they're available inside vi.mock factory closures
const { mockValidate, mockCreateFunction, mockUpdateFunction } = vi.hoisted(
  () => ({
    mockValidate: vi.fn<() => { valid: boolean; error?: string }>(() => ({
      valid: true,
    })),
    mockCreateFunction: vi.fn(),
    mockUpdateFunction: vi.fn(),
  }),
);

interface MockExecutor {
  validate: typeof mockValidate;
}

// Mock FunctionExecutor — use a regular (non-arrow) function so `new` works
vi.mock("@/services/executor", () => ({
  FunctionExecutor: vi.fn(function (this: MockExecutor) {
    this.validate = mockValidate;
  }),
}));

// Mock the functions store so we control createFunction / updateFunction.
// `mockFunctions` is a module-level let; the inner arrow reads it at call-time
// (not factory-init time) so temporal dead zone is not an issue here.
let mockFunctions: FunctionDefinition[] = [];

vi.mock("@/stores/functions", () => ({
  useFunctionsStore: vi.fn(() => ({
    functions: mockFunctions,
    createFunction: mockCreateFunction,
    updateFunction: mockUpdateFunction,
  })),
}));

// Mock next-themes (required by the lazy CodeEditor path, even though we stub it)
vi.mock("next-themes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-themes")>();
  return { ...actual, useTheme: vi.fn(() => ({ resolvedTheme: "light" })) };
});

// Re-import after mocks
const { FunctionForm } = await import("../FunctionForm");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFunction(
  overrides: Partial<FunctionDefinition> = {},
): FunctionDefinition {
  return {
    id: "fn-1",
    name: "my_function",
    description: "Does stuff",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
      },
      required: ["city"],
    },
    implementation: "return args.city.toUpperCase();",
    createdAt: 1_000_000,
    updatedAt: 1_000_000,
    timeout: 5000,
    ...overrides,
  };
}

function Wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FunctionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFunctions = [];
    mockCreateFunction.mockResolvedValue("new-fn-id");
    mockUpdateFunction.mockResolvedValue(undefined);
    mockValidate.mockReturnValue({ valid: true });
  });

  // ── Rendering ─────────────────────────────────────────────────────────────
  describe("create mode", () => {
    it("renders all core fields", () => {
      render(<FunctionForm />, { wrapper: Wrapper });

      expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
      expect(screen.getByLabelText(/timeout/i)).toBeInTheDocument();
    });

    it("renders 'Create Function' submit button", () => {
      render(<FunctionForm />, { wrapper: Wrapper });
      expect(
        screen.getByRole("button", { name: /create function/i }),
      ).toBeInTheDocument();
    });

    it("does not render Cancel button when onCancel is not provided", () => {
      render(<FunctionForm />, { wrapper: Wrapper });
      expect(
        screen.queryByRole("button", { name: /cancel/i }),
      ).not.toBeInTheDocument();
    });

    it("renders Cancel button when onCancel prop is provided", () => {
      render(<FunctionForm onCancel={vi.fn()} />, { wrapper: Wrapper });
      expect(
        screen.getByRole("button", { name: /cancel/i }),
      ).toBeInTheDocument();
    });

    it("uses aria-label 'Create function'", () => {
      render(<FunctionForm />, { wrapper: Wrapper });
      expect(
        screen.getByRole("form", { name: /create function/i }),
      ).toBeInTheDocument();
    });
  });

  describe("edit mode (initialValues provided)", () => {
    it("pre-fills the name field", () => {
      render(<FunctionForm initialValues={makeFunction()} />, {
        wrapper: Wrapper,
      });
      expect(screen.getByLabelText(/^name/i)).toHaveValue("my_function");
    });

    it("pre-fills the description field", () => {
      render(<FunctionForm initialValues={makeFunction()} />, {
        wrapper: Wrapper,
      });
      // Use role query to avoid ambiguity with the parameter "description" inputs
      expect(
        screen.getByRole("textbox", { name: /^description$/i }),
      ).toHaveValue("Does stuff");
    });

    it("pre-fills the implementation editor", () => {
      render(<FunctionForm initialValues={makeFunction()} />, {
        wrapper: Wrapper,
      });
      expect(screen.getByTestId("code-editor")).toHaveValue(
        "return args.city.toUpperCase();",
      );
    });

    it("pre-fills the timeout field", () => {
      render(<FunctionForm initialValues={makeFunction({ timeout: 3000 })} />, {
        wrapper: Wrapper,
      });
      expect(screen.getByLabelText(/timeout/i)).toHaveValue(3000);
    });

    it("renders 'Save Changes' submit button", () => {
      render(<FunctionForm initialValues={makeFunction()} />, {
        wrapper: Wrapper,
      });
      expect(
        screen.getByRole("button", { name: /save changes/i }),
      ).toBeInTheDocument();
    });

    it("uses aria-label 'Edit function'", () => {
      render(<FunctionForm initialValues={makeFunction()} />, {
        wrapper: Wrapper,
      });
      expect(
        screen.getByRole("form", { name: /edit function/i }),
      ).toBeInTheDocument();
    });
  });

  // ── Cancel ────────────────────────────────────────────────────────────────
  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(<FunctionForm onCancel={onCancel} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  // ── Name validation ───────────────────────────────────────────────────────
  describe("name validation", () => {
    it("shows 'Name is required' error when name is empty on blur", async () => {
      render(<FunctionForm />, { wrapper: Wrapper });
      fireEvent.blur(screen.getByLabelText(/^name/i));
      expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    });

    it("shows format error for an invalid name on blur", async () => {
      render(<FunctionForm />, { wrapper: Wrapper });
      await userEvent.type(screen.getByLabelText(/^name/i), "invalid name!");
      fireEvent.blur(screen.getByLabelText(/^name/i));
      expect(
        await screen.findByText(/may only contain letters/i),
      ).toBeInTheDocument();
    });

    it("shows uniqueness error when another function has the same name", async () => {
      mockFunctions = [makeFunction({ id: "other-id", name: "existing_fn" })];
      render(<FunctionForm />, { wrapper: Wrapper });

      await userEvent.type(screen.getByLabelText(/^name/i), "existing_fn");
      fireEvent.blur(screen.getByLabelText(/^name/i));

      expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    });

    it("does not show uniqueness error when editing the same function", async () => {
      mockFunctions = [makeFunction({ id: "fn-1", name: "my_function" })];
      render(
        <FunctionForm
          initialValues={makeFunction({ id: "fn-1", name: "my_function" })}
        />,
        {
          wrapper: Wrapper,
        },
      );

      // Blur without changing — should not complain about own name
      fireEvent.blur(screen.getByLabelText(/^name/i));

      await waitFor(() => {
        expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
      });
    });

    it("does not show an error for a valid name", async () => {
      render(<FunctionForm />, { wrapper: Wrapper });
      await userEvent.type(screen.getByLabelText(/^name/i), "valid_name");
      fireEvent.blur(screen.getByLabelText(/^name/i));

      await waitFor(() => {
        expect(screen.queryByText(/name is required/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/may only contain/i)).not.toBeInTheDocument();
      });
    });
  });

  // ── Timeout validation ────────────────────────────────────────────────────
  describe("timeout validation", () => {
    it("shows error when timeout is below 100 ms", async () => {
      render(<FunctionForm />, { wrapper: Wrapper });
      const input = screen.getByLabelText(/timeout/i);
      fireEvent.change(input, { target: { value: "50" } });
      fireEvent.blur(input);
      expect(await screen.findByText(/at least 100/i)).toBeInTheDocument();
    });

    it("shows error when timeout exceeds 60 000 ms", async () => {
      render(<FunctionForm />, { wrapper: Wrapper });
      const input = screen.getByLabelText(/timeout/i);
      fireEvent.change(input, { target: { value: "99999" } });
      fireEvent.blur(input);
      expect(await screen.findByText(/not exceed 60/i)).toBeInTheDocument();
    });

    it("clears timeout error for a valid value", async () => {
      render(<FunctionForm />, { wrapper: Wrapper });
      const input = screen.getByLabelText(/timeout/i);

      fireEvent.change(input, { target: { value: "50" } });
      fireEvent.blur(input);

      await screen.findByText(/at least 100/i);

      fireEvent.change(input, { target: { value: "3000" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText(/at least 100/i)).not.toBeInTheDocument();
      });
    });
  });

  // ── Implementation validation ─────────────────────────────────────────────
  describe("implementation validation (syntax check on blur)", () => {
    it("shows syntax error message on blur when code is invalid", async () => {
      mockValidate.mockReturnValue({ valid: false, error: "Unexpected token" });
      render(<FunctionForm />, { wrapper: Wrapper });

      // fireEvent.change avoids userEvent's special-char interpretation of {
      fireEvent.change(screen.getByTestId("code-editor"), {
        target: { value: "bad code !!" },
      });
      fireEvent.blur(screen.getByTestId("code-editor"));

      expect(await screen.findByText(/syntax error/i)).toBeInTheDocument();
    });

    it("does not show syntax error when code is valid", async () => {
      render(<FunctionForm />, { wrapper: Wrapper });

      fireEvent.change(screen.getByTestId("code-editor"), {
        target: { value: "return args.city;" },
      });
      fireEvent.blur(screen.getByTestId("code-editor"));

      await waitFor(() => {
        expect(screen.queryByText(/syntax error/i)).not.toBeInTheDocument();
      });
    });
  });

  // ── Submit — create ───────────────────────────────────────────────────────
  describe("successful create submission", () => {
    async function fillAndSubmit() {
      render(<FunctionForm onSave={vi.fn()} />, { wrapper: Wrapper });

      await userEvent.type(screen.getByLabelText(/^name/i), "hello_world");
      fireEvent.change(screen.getByTestId("code-editor"), {
        target: { value: "return 'hello';" },
      });
      fireEvent.click(screen.getByRole("button", { name: /create function/i }));
    }

    it("calls createFunction with correct payload", async () => {
      await fillAndSubmit();
      await waitFor(() => {
        expect(mockCreateFunction).toHaveBeenCalledOnce();
        expect(mockCreateFunction.mock.calls[0][0]).toMatchObject({
          name: "hello_world",
          implementation: "return 'hello';",
        });
      });
    });

    it("calls onSave with the returned id", async () => {
      const onSave = vi.fn();
      render(<FunctionForm onSave={onSave} />, { wrapper: Wrapper });

      await userEvent.type(screen.getByLabelText(/^name/i), "hello_world");
      fireEvent.change(screen.getByTestId("code-editor"), {
        target: { value: "return 'hello';" },
      });

      fireEvent.click(screen.getByRole("button", { name: /create function/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith("new-fn-id");
      });
    });

    it("shows a success toast after create", async () => {
      await fillAndSubmit();
      await waitFor(() => {
        expect(toastSuccess).toHaveBeenCalledWith(
          expect.stringContaining("hello_world"),
        );
      });
    });
  });

  // ── Submit — edit ─────────────────────────────────────────────────────────
  describe("successful edit submission", () => {
    it("calls updateFunction with changed payload", async () => {
      const fn = makeFunction();
      render(<FunctionForm initialValues={fn} onSave={vi.fn()} />, {
        wrapper: Wrapper,
      });

      const nameInput = screen.getByLabelText(/^name/i);
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "updated_fn");

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdateFunction).toHaveBeenCalledWith(
          "fn-1",
          expect.objectContaining({ name: "updated_fn" }),
        );
      });
    });

    it("does not call createFunction in edit mode", async () => {
      const fn = makeFunction();
      render(<FunctionForm initialValues={fn} onSave={vi.fn()} />, {
        wrapper: Wrapper,
      });

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdateFunction).toHaveBeenCalledOnce();
      });
      expect(mockCreateFunction).not.toHaveBeenCalled();
    });

    it("shows a success toast after update", async () => {
      const fn = makeFunction();
      render(<FunctionForm initialValues={fn} onSave={vi.fn()} />, {
        wrapper: Wrapper,
      });

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(toastSuccess).toHaveBeenCalledWith(
          expect.stringContaining("my_function"),
        );
      });
    });
  });

  // ── Submit validation errors ──────────────────────────────────────────────
  describe("submit with invalid data", () => {
    it("blocks submission and shows name error when name is empty", async () => {
      render(<FunctionForm />, { wrapper: Wrapper });
      fireEvent.click(screen.getByRole("button", { name: /create function/i }));

      expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
      expect(mockCreateFunction).not.toHaveBeenCalled();
    });

    it("blocks submission and shows implementation error when code is empty", async () => {
      render(<FunctionForm />, { wrapper: Wrapper });

      await userEvent.type(screen.getByLabelText(/^name/i), "my_fn");
      fireEvent.click(screen.getByRole("button", { name: /create function/i }));

      expect(
        await screen.findByText(/implementation is required/i),
      ).toBeInTheDocument();
      expect(mockCreateFunction).not.toHaveBeenCalled();
    });

    it("shows error toast when createFunction throws", async () => {
      mockCreateFunction.mockRejectedValue(new Error("DB error"));

      render(<FunctionForm />, { wrapper: Wrapper });

      await userEvent.type(screen.getByLabelText(/^name/i), "good_name");
      fireEvent.change(screen.getByTestId("code-editor"), {
        target: { value: "return 42;" },
      });
      fireEvent.click(screen.getByRole("button", { name: /create function/i }));

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledWith(
          expect.stringContaining("Failed to save"),
        );
      });
    });
  });
});
