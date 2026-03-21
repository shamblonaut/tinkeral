import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFunctionEditor } from "../../hooks";
import type { FunctionEditorContextValue } from "../../types";
import { FunctionEditorMain } from "../FunctionEditorMain";

// Mock ResizeObserver for Radix components
global.ResizeObserver = vi.fn().mockImplementation(function (
  this: ResizeObserver,
) {
  this.observe = vi.fn();
  this.unobserve = vi.fn();
  this.disconnect = vi.fn();
});

// Mock child components to keep the test focused on FunctionEditorMain
vi.mock("../FunctionSettingsFields", () => ({
  NameField: ({
    value,
    onChange,
    onBlur,
    disabled,
  }: {
    value: string;
    onChange: (v: string) => void;
    onBlur: (v: string) => void;
    disabled?: boolean;
  }) => (
    <input
      data-testid="name-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onBlur(e.target.value)}
      disabled={disabled}
      aria-label="Name"
    />
  ),
  DescriptionField: ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
  }) => (
    <input
      data-testid="description-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  ),
  TimeoutField: ({
    value,
    onChange,
    onBlur,
    disabled,
  }: {
    value: number;
    onChange: (v: number) => void;
    onBlur: (v: number) => void;
    disabled?: boolean;
  }) => (
    <input
      data-testid="timeout-field"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onBlur={(e) => onBlur(Number(e.target.value))}
      disabled={disabled}
    />
  ),
}));

vi.mock("../ParameterSchemaEditor", () => ({
  ParameterSchemaEditor: ({ onChange }: { onChange: (v: unknown) => void }) => (
    <div
      data-testid="schema-editor"
      onClick={() => onChange({ type: "object", properties: { newProp: {} } })}
    />
  ),
}));

vi.mock("../CodeEditor", () => ({
  default: React.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      getValue: () => "mocked implementation",
    }));
    return <div data-testid="code-editor" />;
  }),
}));

vi.mock("../FunctionTestRunner", () => ({
  FunctionTestRunner: () => <div data-testid="test-runner" />,
}));

vi.mock("../../hooks", () => ({
  useFunctionEditor: vi.fn(),
}));

describe("FunctionEditorMain", () => {
  const mockSaveMetadata = vi.fn();
  const mockResetDraft = vi.fn();
  const mockSetName = vi.fn();
  const mockSetDescription = vi.fn();

  const defaultContext = {
    name: "TestFunction",
    setName: mockSetName,
    description: "A test function",
    setDescription: mockSetDescription,
    schema: { type: "object", properties: {} },
    setSchema: vi.fn(),
    timeout: 5000,
    setTimeoutValue: vi.fn(),
    implementation: "return true;",
    setImplementation: vi.fn(),
    errors: {},
    editorRef: { current: null },
    isSaving: false,
    isEditMode: false,
    isDirty: false,
    handleNameBlur: vi.fn(),
    handleParametersBlur: vi.fn(),
    handleImplementationBlur: vi.fn(),
    handleTimeoutBlur: vi.fn(),
    resetDraft: mockResetDraft,
    saveMetadata: mockSaveMetadata,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFunctionEditor).mockReturnValue(
      defaultContext as unknown as FunctionEditorContextValue,
    );
  });

  it("renders the new function form correctly", () => {
    render(<FunctionEditorMain />);

    expect(screen.getByText("New Function")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument(); // isDirty is false
    expect(screen.getByText("Create Function")).toBeInTheDocument();
    expect(screen.getByTestId("name-field")).toBeInTheDocument();
  });

  it("renders the edit function form correctly", () => {
    vi.mocked(useFunctionEditor).mockReturnValue({
      ...defaultContext,
      isEditMode: true,
      isDirty: true,
    } as unknown as FunctionEditorContextValue);

    render(<FunctionEditorMain />);

    expect(screen.getByText("Edit Function")).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByText("Save Function")).toBeInTheDocument();
  });

  it("disables buttons when saving", () => {
    vi.mocked(useFunctionEditor).mockReturnValue({
      ...defaultContext,
      isSaving: true,
      isDirty: true,
    } as unknown as FunctionEditorContextValue);

    render(<FunctionEditorMain />);

    expect(screen.getByText("Saving…")).toBeDisabled();
    expect(screen.getByText("Reset")).toBeDisabled();
    expect(screen.getByTestId("name-field")).toBeDisabled();
  });

  it("calls resetDraft when reset is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(useFunctionEditor).mockReturnValue({
      ...defaultContext,
      isDirty: true,
    } as unknown as FunctionEditorContextValue);

    render(<FunctionEditorMain />);

    await user.click(screen.getByText("Reset"));
    expect(mockResetDraft).toHaveBeenCalled();
  });

  it("calls saveMetadata when save is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(useFunctionEditor).mockReturnValue({
      ...defaultContext,
      isDirty: true,
    } as unknown as FunctionEditorContextValue);

    render(<FunctionEditorMain />);

    await user.click(screen.getByText("Create Function"));
    expect(mockSaveMetadata).toHaveBeenCalled();
  });

  it("displays implementation errors", () => {
    vi.mocked(useFunctionEditor).mockReturnValue({
      ...defaultContext,
      errors: { implementation: "Syntax error on line 1" },
    } as unknown as FunctionEditorContextValue);

    render(<FunctionEditorMain />);

    expect(screen.getByText("Syntax error on line 1")).toBeInTheDocument();
  });

  it("calls blur handlers for settings fields", async () => {
    const user = userEvent.setup();
    render(<FunctionEditorMain />);

    const nameField = screen.getByTestId("name-field");
    await user.click(nameField);
    await user.tab(); // Trigger blur
    expect(defaultContext.handleNameBlur).toHaveBeenCalled();

    const timeoutField = screen.getByTestId("timeout-field");
    await user.click(timeoutField);
    await user.tab();
    expect(defaultContext.handleTimeoutBlur).toHaveBeenCalled();
  });

  it("calls setSchema and handleParametersBlur when schema changes", async () => {
    const user = userEvent.setup();
    render(<FunctionEditorMain />);

    const schemaEditor = screen.getByTestId("schema-editor");
    await user.click(schemaEditor);

    expect(defaultContext.setSchema).toHaveBeenCalled();
    expect(defaultContext.handleParametersBlur).toHaveBeenCalled();
  });

  it("renders both mobile and desktop workspace sections", () => {
    render(<FunctionEditorMain />);

    // Check for tab triggers (mobile + desktop triggers should be present in DOM)
    // We use getAllByRole instead of getAllByText to be more specific
    const implementationTriggers = screen.getAllByRole("tab", {
      name: /Implementation/i,
    });
    expect(implementationTriggers.length).toBeGreaterThan(1);

    const testTriggers = screen.getAllByRole("tab", { name: /Test/i });
    expect(testTriggers.length).toBeGreaterThan(1);

    // Default tab is implementation, so we should see at least one code editor
    expect(screen.getAllByTestId("code-editor").length).toBeGreaterThan(0);
  });
});
