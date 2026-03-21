import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { FunctionCall, FunctionResult } from "@/shared/types";
import { FunctionCallDisplay } from "../message/FunctionCallDisplay";

describe("FunctionCallDisplay", () => {
  const mockCall: FunctionCall = {
    id: "call-1",
    name: "getWeather",
    arguments: { location: "London" },
  };

  const mockResult: FunctionResult = {
    id: "res-1",
    name: "getWeather",
    result: { temp: 20, conditions: "Sunny" },
    executionTime: 120,
  };

  it("renders basic function call information", () => {
    render(<FunctionCallDisplay functionCall={mockCall} status="requested" />);
    expect(screen.getByText("getWeather")).toBeInTheDocument();
    expect(screen.getByText("Requested")).toBeInTheDocument();
  });

  it("expands automatically when executing and supports cancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <FunctionCallDisplay
        functionCall={mockCall}
        status="executing"
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText("Executing")).toBeInTheDocument();
    expect(screen.getByText("Arguments")).toBeInTheDocument(); // Expanded

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("collapses when completed", () => {
    const { rerender } = render(
      <FunctionCallDisplay functionCall={mockCall} status="executing" />,
    );
    expect(screen.getByText("Arguments")).toBeInTheDocument(); // Expanded initially

    rerender(
      <FunctionCallDisplay functionCall={mockCall} status="completed" />,
    );
    expect(screen.queryByText("Arguments")).not.toBeInTheDocument(); // Collapsed automatically
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("shows results when expanded manully", async () => {
    const user = userEvent.setup();
    render(
      <FunctionCallDisplay
        functionCall={mockCall}
        functionResult={mockResult}
        status="completed"
      />,
    );

    // Initially closed because 'completed'
    expect(screen.queryByText("Result")).not.toBeInTheDocument();

    // Click expand
    await user.click(screen.getByTitle("Expand function details"));

    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByText("120ms")).toBeInTheDocument();
    expect(screen.getByText(/Sunny/)).toBeInTheDocument();
  });

  it("renders error state correctly", async () => {
    const user = userEvent.setup();
    render(
      <FunctionCallDisplay
        functionCall={mockCall}
        functionResult={{ ...mockResult, error: "Network Error" }}
        status="failed"
      />,
    );

    expect(screen.getByText("Failed")).toBeInTheDocument();

    await user.click(screen.getByTitle("Expand function details"));
    expect(screen.getByText("Network Error")).toBeInTheDocument();
  });
});
