import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FunctionDefinition } from "@/db";

import { FunctionExecutor } from "../executor";

class RuntimeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;

  postMessage(payload: unknown): void {
    if (this.terminated) return;

    queueMicrotask(async () => {
      if (this.terminated) return;

      try {
        const request = payload as {
          type: "execute";
          code: string;
          args: Record<string, unknown>;
        };

        if (request.type !== "execute") return;

        const AsyncFunction = Object.getPrototypeOf(async function () {})
          .constructor as new (
          ...args: string[]
        ) => (...args: unknown[]) => unknown;

        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        const emitConsole = (level: "log" | "warn" | "error") => {
          return (...args: unknown[]) => {
            this.onmessage?.(
              new MessageEvent("message", {
                data: { type: "console", level, args },
              }),
            );
          };
        };

        console.log = emitConsole("log");
        console.warn = emitConsole("warn");
        console.error = emitConsole("error");

        try {
          const fn = new AsyncFunction(
            "args",
            `"use strict";\n${request.code}`,
          );
          const value = await fn(request.args);
          this.onmessage?.(
            new MessageEvent("message", {
              data: { type: "result", data: value },
            }),
          );
        } catch (error) {
          const typedError =
            error instanceof Error ? error : new Error(String(error));
          this.onmessage?.(
            new MessageEvent("message", {
              data: {
                type: "error",
                error: {
                  name: typedError.name,
                  message: typedError.message,
                  stack: typedError.stack,
                },
              },
            }),
          );
        } finally {
          console.log = originalLog;
          console.warn = originalWarn;
          console.error = originalError;
        }
      } catch (error) {
        const typedError =
          error instanceof Error ? error : new Error(String(error));
        this.onerror?.(
          new ErrorEvent("error", { message: typedError.message }),
        );
      }
    });
  }

  terminate(): void {
    this.terminated = true;
  }
}

function makeFunction(
  overrides: Partial<FunctionDefinition> = {},
): FunctionDefinition {
  return {
    id: "fn-1",
    name: "integration_fn",
    description: "Integration test function",
    parameters: {
      type: "object",
      properties: {
        value: { type: "number" },
      },
      required: ["value"],
    },
    implementation: "return args.value;",
    timeout: 300,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("FunctionExecutor integration", () => {
  let executor: FunctionExecutor;

  beforeEach(() => {
    executor = new FunctionExecutor({
      createWorker: () => new RuntimeWorker() as unknown as Worker,
    });
  });

  it("executes implementation end-to-end and captures console output", async () => {
    const func = makeFunction({
      implementation:
        "console.log('start', args.value); return { total: args.value * 2 };",
    });

    const result = await executor.execute(func, { value: 5 });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ total: 10 });
    expect(result.consoleLogs).toHaveLength(1);
    expect(result.consoleLogs[0]).toMatchObject({
      level: "log",
      args: ["start", 5],
    });
  });

  it("returns runtime errors with type and message", async () => {
    const func = makeFunction({
      implementation: "throw new TypeError('bad args');",
    });

    const result = await executor.execute(func, { value: 1 });

    expect(result.success).toBe(false);
    expect(result.error?.name).toBe("TypeError");
    expect(result.error?.message).toBe("bad args");
  });

  it("enforces timeout for unresolved async implementations", async () => {
    vi.useFakeTimers();

    const func = makeFunction({
      timeout: 120,
      implementation: "await new Promise(() => {}); return 1;",
    });

    const resultPromise = executor.execute(func, { value: 1 });
    await vi.advanceTimersByTimeAsync(150);
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.error?.name).toBe("TimeoutError");
    expect(result.error?.message).toContain("120ms");

    vi.useRealTimers();
  });
});
