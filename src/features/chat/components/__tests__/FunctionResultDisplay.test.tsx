import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { FunctionResult } from "@/shared/types";
import { FunctionResultDisplay } from "../message/FunctionResultDisplay";

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({ resolvedTheme: "dark" })),
}));

// Mock syntax highlighter since it's hard to test its rendered DOM exactly sometimes
vi.mock("@/shared/lib/syntaxHighlighter", () => {
  return {
    SyntaxHighlighter: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="syntax-highlighter">{children}</div>
    ),
    oneDark: {},
    oneLight: {},
  };
});

describe("FunctionResultDisplay", () => {
  const mockResult: FunctionResult = {
    id: "res-2",
    name: "calculateSum",
    result: { value: 42 },
    executionTime: 45,
  };

  it("renders success state", () => {
    render(<FunctionResultDisplay functionResult={mockResult} />);

    expect(screen.getByText("Function Result")).toBeInTheDocument();
    expect(screen.getByText("calculateSum")).toBeInTheDocument();
    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByText("45 ms")).toBeInTheDocument();
  });

  it("renders result payload in SyntaxHighlighter", () => {
    render(<FunctionResultDisplay functionResult={mockResult} />);

    const highlighter = screen.getByTestId("syntax-highlighter");
    expect(highlighter.textContent).toContain('"value": 42');
  });

  it("renders error state", () => {
    render(
      <FunctionResultDisplay
        functionResult={{ ...mockResult, error: "Calculation failed" }}
      />,
    );

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Calculation failed")).toBeInTheDocument();
  });

  it("renders timeout specific state", () => {
    render(
      <FunctionResultDisplay
        functionResult={{ ...mockResult, error: "Script execution timed out" }}
      />,
    );

    expect(screen.getByText("Timed out")).toBeInTheDocument();
    expect(screen.getByText("Timeout")).toBeInTheDocument(); // The icon + label pill
  });

  it("collapses very long results", async () => {
    const user = userEvent.setup();
    const longString = "A".repeat(1000);
    render(
      <FunctionResultDisplay
        functionResult={{ ...mockResult, result: longString }}
      />,
    );

    // Check for collapse/expand button
    const expandBtn = screen.getByRole("button", { name: /Expand/i });
    expect(expandBtn).toBeInTheDocument();

    await user.click(expandBtn);
    expect(
      screen.getByRole("button", { name: /Collapse/i }),
    ).toBeInTheDocument();
  });
});
