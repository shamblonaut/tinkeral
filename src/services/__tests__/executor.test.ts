import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FunctionDefinition } from "@/types";

import type { ConsoleEntry } from "../executor";
import { FunctionExecutor } from "../executor";

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockFunction(
  overrides: Partial<FunctionDefinition> = {},
): FunctionDefinition {
  return {
    id: "test-func-1",
    name: "testFunction",
    description: "A test function",
    parameters: {
      type: "object",
      properties: {
        input: { type: "string", description: "Test input" },
      },
      required: ["input"],
    },
    implementation: "return args.input;",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ─── Mock Worker ────────────────────────────────────────────────────────────

/**
 * Minimal Worker mock that simulates the worker message flow.
 * Tests configure it via `MockWorker.onPostMessage` to define
 * how the worker responds to execution requests.
 */
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  terminated = false;

  postMessage(data: unknown): void {
    if (this.terminated) return;
    // Defer response to next microtask so handlers are set up
    Promise.resolve().then(() => {
      if (this.terminated) return;
      MockWorker.onPostMessage?.(this, data);
    });
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Simulate the worker sending a message back. */
  simulateMessage(data: unknown): void {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  /** Simulate a worker-level error. */
  simulateError(message: string): void {
    this.onerror?.(new ErrorEvent("error", { message }));
  }

  /** Simulate worker message transport failure. */
  simulateMessageError(data?: unknown): void {
    this.onmessageerror?.(new MessageEvent("messageerror", { data }));
  }

  /**
   * Global hook: called when any MockWorker receives postMessage.
   * Tests set this to control worker behavior.
   */
  static onPostMessage: ((worker: MockWorker, data: unknown) => void) | null =
    null;
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe("FunctionExecutor", () => {
  let executor: FunctionExecutor;

  beforeEach(() => {
    MockWorker.onPostMessage = null;
    executor = new FunctionExecutor({
      createWorker: () => new MockWorker() as unknown as Worker,
    });
  });

  afterEach(() => {
    executor.terminate();
  });

  // ── validate() ──────────────────────────────────────────────────────────

  describe("validate()", () => {
    it("should accept valid JavaScript code", () => {
      const result = executor.validate("return args.x + args.y;");
      expect(result).toEqual({ valid: true });
    });

    it("should accept empty code", () => {
      const result = executor.validate("");
      expect(result).toEqual({ valid: true });
    });

    it("should accept code with async patterns", () => {
      const result = executor.validate(
        "const data = await Promise.resolve(42);\nreturn data;",
      );
      // validate() now uses AsyncFunction (matching the worker), so
      // top-level `await` is valid.
      expect(result.valid).toBe(true);
    });

    it("should reject code with syntax errors", () => {
      const result = executor.validate("return {{{;");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Unexpected token");
    });

    it("should reject incomplete expressions", () => {
      const result = executor.validate("const x = ;");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should accept code with arrow functions", () => {
      const result = executor.validate(
        "const add = (a, b) => a + b;\nreturn add(1, 2);",
      );
      expect(result).toEqual({ valid: true });
    });

    it("should accept code with try/catch", () => {
      const result = executor.validate(
        "try { return JSON.parse(args.input); } catch (e) { return { error: e.message }; }",
      );
      expect(result).toEqual({ valid: true });
    });
  });

  // ── execute() — success cases ───────────────────────────────────────────

  describe("execute() — success", () => {
    it("should return a successful result when worker responds", async () => {
      MockWorker.onPostMessage = (worker) => {
        worker.simulateMessage({ type: "result", data: "hello" });
      };

      const func = createMockFunction({ implementation: "return args.input;" });
      const result = await executor.execute(func, { input: "hello" });

      expect(result.success).toBe(true);
      expect(result.data).toBe("hello");
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.consoleLogs).toEqual([]);
    });

    it("should return complex data from worker", async () => {
      const responseData = {
        temp: 22,
        condition: "sunny",
        forecast: [20, 21, 23],
      };
      MockWorker.onPostMessage = (worker) => {
        worker.simulateMessage({ type: "result", data: responseData });
      };

      const func = createMockFunction();
      const result = await executor.execute(func, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(responseData);
    });

    it("should return null/undefined results", async () => {
      MockWorker.onPostMessage = (worker) => {
        worker.simulateMessage({ type: "result", data: undefined });
      };

      const func = createMockFunction({ implementation: "// no return" });
      const result = await executor.execute(func, {});

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });

    it("should collect console logs from worker", async () => {
      MockWorker.onPostMessage = (worker) => {
        // Simulate console output before the result
        worker.simulateMessage({
          type: "console",
          level: "log",
          args: ["debug info"],
        });
        worker.simulateMessage({
          type: "console",
          level: "warn",
          args: ["warning message"],
        });
        worker.simulateMessage({ type: "result", data: 42 });
      };

      const func = createMockFunction();
      const result = await executor.execute(func, {});

      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
      expect(result.consoleLogs).toHaveLength(2);
      expect(result.consoleLogs[0]).toMatchObject({
        level: "log",
        args: ["debug info"],
      });
      expect(result.consoleLogs[1]).toMatchObject({
        level: "warn",
        args: ["warning message"],
      });
    });
  });

  // ── execute() — error cases ─────────────────────────────────────────────

  describe("execute() — errors", () => {
    it("should handle runtime errors from worker", async () => {
      MockWorker.onPostMessage = (worker) => {
        worker.simulateMessage({
          type: "error",
          error: {
            message: "x is not defined",
            name: "ReferenceError",
            stack: "ReferenceError: x is not defined\n    at ...",
          },
        });
      };

      const func = createMockFunction({ implementation: "return x;" });
      const result = await executor.execute(func, {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.name).toBe("ReferenceError");
      expect(result.error!.message).toBe("x is not defined");
    });

    it("should handle worker-level errors", async () => {
      MockWorker.onPostMessage = (worker) => {
        worker.simulateError("Script error");
      };

      const func = createMockFunction();
      const result = await executor.execute(func, {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.name).toBe("WorkerError");
      expect(result.error!.message).toBe("Script error");
    });

    it("should include console logs captured before an error", async () => {
      MockWorker.onPostMessage = (worker) => {
        worker.simulateMessage({
          type: "console",
          level: "error",
          args: ["something went wrong"],
        });
        worker.simulateMessage({
          type: "error",
          error: { message: "boom", name: "Error" },
        });
      };

      const func = createMockFunction();
      const result = await executor.execute(func, {});

      expect(result.success).toBe(false);
      expect(result.consoleLogs).toHaveLength(1);
      expect(result.consoleLogs[0].level).toBe("error");
    });
  });

  // ── execute() — timeout ─────────────────────────────────────────────────

  describe("execute() — timeout", () => {
    it("should time out when worker takes too long", async () => {
      vi.useFakeTimers();

      // Worker never responds
      MockWorker.onPostMessage = () => {};

      const func = createMockFunction({ timeout: 1000 });
      const resultPromise = executor.execute(func, {});

      // Advance past the timeout
      vi.advanceTimersByTime(1100);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.name).toBe("TimeoutError");
      expect(result.error!.message).toContain("timed out");
      expect(result.error!.message).toContain("1000ms");

      vi.useRealTimers();
    });

    it("should use options.timeout over func.timeout", async () => {
      vi.useFakeTimers();

      MockWorker.onPostMessage = () => {};

      const func = createMockFunction({ timeout: 5000 });
      const resultPromise = executor.execute(func, {}, { timeout: 500 });

      vi.advanceTimersByTime(600);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain("500ms");

      vi.useRealTimers();
    });

    it("should use default 5s timeout when neither option is set", async () => {
      vi.useFakeTimers();

      MockWorker.onPostMessage = () => {};

      const func = createMockFunction();
      // No timeout on func, no options.timeout
      const funcNoTimeout = { ...func, timeout: undefined };
      const resultPromise = executor.execute(funcNoTimeout, {});

      vi.advanceTimersByTime(5100);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain("5000ms");

      vi.useRealTimers();
    });

    it("should not resolve twice if worker responds after timeout", async () => {
      vi.useFakeTimers();

      const workers: MockWorker[] = [];
      MockWorker.onPostMessage = (worker) => {
        workers.push(worker);
        // Don't respond immediately
      };

      const func = createMockFunction({ timeout: 100 });
      const resultPromise = executor.execute(func, {});

      // Trigger timeout
      vi.advanceTimersByTime(200);
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error!.name).toBe("TimeoutError");

      // Late response from worker should be ignored (worker is terminated)
      if (workers.length > 0) {
        workers[0].simulateMessage({ type: "result", data: "late" });
      }

      vi.useRealTimers();
    });
  });

  // ── terminate() ─────────────────────────────────────────────────────────

  describe("terminate()", () => {
    it("should terminate the active worker", async () => {
      const workers: MockWorker[] = [];
      MockWorker.onPostMessage = (worker) => {
        workers.push(worker);
        // Never respond — keep the worker alive
      };

      const func = createMockFunction({ timeout: 60000 });
      void executor.execute(func, {});

      // Wait for postMessage to fire
      await vi.waitFor(() => {
        expect(workers.length).toBeGreaterThan(0);
      });

      executor.terminate();
      expect(workers[0].terminated).toBe(true);

      // The promise should still be pending (we manually terminated),
      // so respond now — it should be ignored since worker is terminated
      workers[0].simulateMessage({ type: "result", data: "ignored" });
    });

    it("should be safe to call multiple times", () => {
      expect(() => {
        executor.terminate();
        executor.terminate();
        executor.terminate();
      }).not.toThrow();
    });

    it("should reject concurrent execution while another execution is in progress", async () => {
      const workers: MockWorker[] = [];

      MockWorker.onPostMessage = (worker) => {
        workers.push(worker);
        // Keep first execution pending
      };

      const func = createMockFunction();

      const firstExecution = executor.execute(func, {});
      await vi.waitFor(() => {
        expect(workers).toHaveLength(1);
      });

      const concurrentResult = await executor.execute(func, {});

      expect(concurrentResult.success).toBe(false);
      expect(concurrentResult.error?.name).toBe("ConcurrentExecutionError");

      workers[0].simulateMessage({ type: "result", data: "ok" });
      const firstResult = await firstExecution;
      expect(firstResult.success).toBe(true);
    });
  });

  // ── execute() — message forwarding ──────────────────────────────────────

  describe("execute() — message forwarding", () => {
    it("should send correct message to worker", async () => {
      let receivedMessage: unknown = null;

      MockWorker.onPostMessage = (worker, data) => {
        receivedMessage = data;
        worker.simulateMessage({ type: "result", data: null });
      };

      const func = createMockFunction({
        implementation: "return args.x + args.y;",
        allowedAPIs: ["fetch"],
      });

      await executor.execute(func, { x: 1, y: 2 });

      expect(receivedMessage).toEqual({
        type: "execute",
        code: "return args.x + args.y;",
        args: { x: 1, y: 2 },
        allowedAPIs: ["fetch"],
      });
    });

    it("should send undefined allowedAPIs when not set", async () => {
      let receivedMessage: Record<string, unknown> = {};

      MockWorker.onPostMessage = (worker, data) => {
        receivedMessage = data as Record<string, unknown>;
        worker.simulateMessage({ type: "result", data: null });
      };

      const func = createMockFunction();
      const funcNoAPIs = { ...func, allowedAPIs: undefined };

      await executor.execute(funcNoAPIs, {});

      expect(receivedMessage.allowedAPIs).toBeUndefined();
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle worker error with empty message", async () => {
      MockWorker.onPostMessage = (worker) => {
        worker.simulateError("");
      };

      const func = createMockFunction();
      const result = await executor.execute(func, {});

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe("Worker error");
    });

    it("should handle multiple console entries of different levels", async () => {
      MockWorker.onPostMessage = (worker) => {
        worker.simulateMessage({ type: "console", level: "log", args: [1] });
        worker.simulateMessage({ type: "console", level: "warn", args: [2] });
        worker.simulateMessage({ type: "console", level: "error", args: [3] });
        worker.simulateMessage({ type: "console", level: "log", args: [4, 5] });
        worker.simulateMessage({ type: "result", data: "done" });
      };

      const func = createMockFunction();
      const result = await executor.execute(func, {});

      expect(result.consoleLogs).toHaveLength(4);
      const levels = result.consoleLogs.map((l: ConsoleEntry) => l.level);
      expect(levels).toEqual(["log", "warn", "error", "log"]);
    });

    it("should handle worker message transport failures", async () => {
      MockWorker.onPostMessage = (worker) => {
        worker.simulateMessageError({ bad: "payload" });
      };

      const func = createMockFunction();
      const result = await executor.execute(func, {});

      expect(result.success).toBe(false);
      expect(result.error?.name).toBe("WorkerCommunicationError");
      expect(result.error?.message).toBe("Worker communication failed");
    });
  });
});
