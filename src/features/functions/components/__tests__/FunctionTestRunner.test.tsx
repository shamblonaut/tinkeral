import type { JSONSchema } from "@/shared/types";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FunctionTestRunner } from "../FunctionTestRunner";

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserver;

export const mockValidate = vi.fn().mockReturnValue({ valid: true });
export const mockExecute = vi.fn();
export const mockTerminate = vi.fn();

vi.mock("../../services", () => {
  return {
    FunctionExecutor: class {
      validate = mockValidate;
      execute = mockExecute;
      terminate = mockTerminate;
    },
  };
});

describe("FunctionTestRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockReturnValue({ valid: true });
  });

  const baseProps = {
    name: "testFn",
    schema: { type: "object", properties: {} } as unknown as JSONSchema,
    implementation: "return true;",
    timeout: 5000,
  };

  it("shows validation error on syntax error in implementation", async () => {
    const user = userEvent.setup();
    mockValidate.mockReturnValue({ valid: false, error: "Bad syntax" });

    render(<FunctionTestRunner {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText("SyntaxError")).toBeInTheDocument();
    expect(screen.getByText(/Bad syntax/)).toBeInTheDocument();
  });

  it("shows input validation errors on integer inputs", async () => {
    const user = userEvent.setup();
    render(
      <FunctionTestRunner
        {...baseProps}
        schema={
          {
            type: "object",
            required: ["num"],
            properties: {
              num: { type: "integer" },
            },
          } as unknown as JSONSchema
        }
      />,
    );

    // Type a float into an integer field
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "1.5" } });
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText(/Expected an integer/i)).toBeInTheDocument();
  });

  it("executes successfully and displays results", async () => {
    const user = userEvent.setup();
    mockExecute.mockResolvedValue({
      success: true,
      data: { result: 42 },
      executionTime: 12.34,
      consoleLogs: [
        { level: "log", args: ["Hello World"], timestamp: Date.now() },
      ],
    });

    render(<FunctionTestRunner {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText("Success")).toBeInTheDocument();
    expect(screen.getByText(/12\.3ms/)).toBeInTheDocument();
    expect(screen.getAllByText(/result/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/42/).length).toBeGreaterThan(0);
    expect(screen.getByText("log")).toBeInTheDocument();
    expect(screen.getAllByText(/Hello World/).length).toBeGreaterThan(0);
  });

  it("handles object/array JSON parsing in Textarea", async () => {
    const user = userEvent.setup();
    render(
      <FunctionTestRunner
        {...baseProps}
        schema={
          {
            type: "object",
            properties: {
              obj: { type: "object" },
            },
          } as unknown as JSONSchema
        }
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "{ x: 1 }" } }); // invalid json
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText(/Invalid JSON object/i)).toBeInTheDocument();
  });
});
