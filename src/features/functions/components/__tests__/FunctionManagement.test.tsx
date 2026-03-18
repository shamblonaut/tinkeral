import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { TooltipProvider } from "@/shared/components/ui";
import { useUIStore } from "@/shared/store/ui";

import { FunctionSidebarList, FunctionTestRunner } from "..";
import { useFunctionsStore } from "../../store";
import type { FunctionDefinition } from "../../types";

const mocks = vi.hoisted(() => ({
  mockExecutorValidate: vi.fn(),
  mockExecutorExecute: vi.fn(),
  mockExecutorTerminate: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}));

vi.mock("@/features/functions/services/executor", () => {
  class MockFunctionExecutor {
    validate = mocks.mockExecutorValidate;
    execute = mocks.mockExecutorExecute;
    terminate = mocks.mockExecutorTerminate;
  }

  return {
    FunctionExecutor: MockFunctionExecutor,
  };
});

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function functionPayload(): Omit<
  FunctionDefinition,
  "id" | "createdAt" | "updatedAt"
> {
  return {
    name: "calculate_total",
    description: "Calculate final order total",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Base amount" },
      },
      required: ["amount"],
    },
    implementation: "return { total: args.amount * 1.2 };",
    timeout: 1200,
  };
}

describe("Function management lifecycle integration", () => {
  beforeEach(async () => {
    await db.functions.clear();
    vi.clearAllMocks();

    mocks.mockExecutorValidate.mockReturnValue({ valid: true });
    mocks.mockExecutorExecute.mockResolvedValue({
      success: true,
      data: { total: 24 },
      executionTime: 7,
      consoleLogs: [],
    });

    useFunctionsStore.setState({
      functions: [],
      isLoading: false,
      error: null,
    });

    useUIStore.setState({
      selectedFunctionId: null,
      isSidebarOpen: true,
      platformView: "functions",
    });
  });

  it("supports create -> edit -> test -> duplicate -> delete", async () => {
    const store = useFunctionsStore.getState();

    const createdId = await store.createFunction(functionPayload());
    expect(useFunctionsStore.getState().functions).toHaveLength(1);

    await store.updateFunction(createdId, {
      description: "Calculate final order total with tax",
      implementation:
        "console.log('running'); return { total: args.amount * 1.25 };",
    });

    const updated = useFunctionsStore.getState().getFunction(createdId);
    expect(updated?.description).toContain("with tax");

    render(
      <FunctionTestRunner
        name={updated?.name ?? "calculate_total"}
        schema={
          updated?.parameters ?? {
            type: "object",
            properties: {},
          }
        }
        implementation={updated?.implementation ?? "return 0;"}
        timeout={updated?.timeout ?? 1000}
      />,
    );

    const amountInput = screen.getByRole("spinbutton");
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "19.2");
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));

    await waitFor(() => {
      expect(mocks.mockExecutorExecute).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Success")).toBeInTheDocument();

    const source = useFunctionsStore.getState().getFunction(createdId);
    const duplicateId = await store.createFunction({
      name: `${source?.name ?? "calculate_total"} Copy`,
      description: source?.description ?? "",
      parameters: source?.parameters ?? { type: "object", properties: {} },
      implementation: source?.implementation ?? "return null;",
      timeout: source?.timeout,
      allowedAPIs: source?.allowedAPIs,
    });

    expect(useFunctionsStore.getState().functions).toHaveLength(2);

    await store.deleteFunction(duplicateId);
    await store.deleteFunction(createdId);

    expect(useFunctionsStore.getState().functions).toHaveLength(0);
  });

  it("duplicates via sidebar and opens delete confirmation", async () => {
    await useFunctionsStore.getState().createFunction(functionPayload());

    render(
      <TooltipProvider>
        <FunctionSidebarList />
      </TooltipProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("calculate_total")).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: /toggle details/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /duplicate/i }));

    await waitFor(() => {
      expect(useFunctionsStore.getState().functions).toHaveLength(2);
    });

    const copiedLabel = "calculate_total Copy";
    expect(screen.getByText(copiedLabel)).toBeInTheDocument();

    await userEvent.click(
      screen.getAllByRole("button", { name: /toggle details/i })[1],
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: /^delete$/i })[0],
    );

    expect(screen.getByText("Delete Function")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(useFunctionsStore.getState().functions).toHaveLength(2);
  });
});
