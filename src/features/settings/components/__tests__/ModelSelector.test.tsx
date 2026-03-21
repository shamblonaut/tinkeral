import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelInfo } from "@/shared/types";

import { useMediaQuery } from "@/shared/hooks";
import { useModelSelection } from "../../hooks";
import { ModelSelector } from "../ModelSelector";

vi.mock("@/shared/hooks", () => ({
  useMediaQuery: vi.fn(),
}));

vi.mock("../../hooks", () => ({
  useModelSelection: vi.fn(),
}));

vi.mock("../ModelDetails", () => ({
  ModelDetails: ({ model }: { model: ModelInfo }) => (
    <div data-testid="model-details">{model.id}</div>
  ),
}));

vi.mock("@/shared/components/ui", () => ({
  Button: ({ children, ...props }: ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
  Command: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  CommandGroup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  CommandInput: ({
    value,
    onValueChange,
    ...props
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    placeholder?: string;
  }) => (
    <input
      aria-label="search-model"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      {...props}
    />
  ),
  CommandItem: ({
    children,
    value,
    onSelect,
  }: {
    children: ReactNode;
    value: string;
    onSelect?: (v: string) => void;
  }) => <button onClick={() => onSelect?.(value)}>{children}</button>,
  CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("ModelSelector", () => {
  const handleSelect = vi.fn();

  const models: ModelInfo[] = [
    {
      id: "model-a",
      name: "Model A",
      provider: "google",
      family: "gemini",
      stage: "stable",
      description: "A model",
      contextWindow: { input: 1000, output: 2000 },
      capabilities: {
        imageInput: false,
        videoInput: false,
        audioInput: false,
        textGeneration: true,
        imageGeneration: false,
        videoGeneration: false,
        speechGeneration: false,
        functionCalling: true,
        codeExecution: true,
        systemInstruction: true,
      },
    },
    {
      id: "model-b",
      name: "Model B",
      provider: "google",
      family: "gemini",
      stage: "stable",
      description: "B model",
      contextWindow: { input: 1000, output: 2000 },
      capabilities: {
        imageInput: false,
        videoInput: false,
        audioInput: false,
        textGeneration: true,
        imageGeneration: false,
        videoGeneration: false,
        speechGeneration: false,
        functionCalling: false,
        codeExecution: false,
        systemInstruction: false,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders desktop state and handles selection", () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    vi.mocked(useModelSelection).mockReturnValue({
      models,
      selectedModel: undefined,
      currentModelId: "missing-model",
      handleSelect,
    });

    render(<ModelSelector />);

    expect(screen.getByText("missing-model")).toBeInTheDocument();
    expect(screen.getByText("No model selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /model a/i }));
    expect(handleSelect).toHaveBeenCalledWith("model-a");
  });

  it("renders mobile state, hides selected option, and handles search reset", () => {
    vi.mocked(useMediaQuery).mockReturnValue(false);
    vi.mocked(useModelSelection).mockReturnValue({
      models,
      selectedModel: models[0],
      currentModelId: "model-a",
      handleSelect,
    });

    render(<ModelSelector />);

    expect(screen.getByTestId("model-details")).toHaveTextContent("model-a");
    expect(
      screen.queryByRole("button", { name: /model a/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /model b/i }),
    ).toBeInTheDocument();

    const search = screen.getByLabelText("search-model");
    fireEvent.change(search, { target: { value: "abc" } });
    fireEvent.change(search, { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: /model b/i }));
    expect(handleSelect).toHaveBeenCalledWith("model-b");
  });
});
