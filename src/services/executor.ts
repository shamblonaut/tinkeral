/**
 * Function executor service — manages Web Worker lifecycle for
 * sandboxed execution of user-defined functions.
 *
 * Usage:
 *   const executor = new FunctionExecutor();
 *   const result = await executor.execute(func, { location: "Tokyo" });
 *   executor.terminate(); // cleanup
 */

import type { FunctionDefinition } from "@/types";

/** A single captured console entry from function execution. */
export interface ConsoleEntry {
  level: "log" | "warn" | "error";
  args: unknown[];
  timestamp: number;
}

/** Result returned from executing a function. */
export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  error?: { message: string; name: string; stack?: string };
  executionTime: number;
  consoleLogs: ConsoleEntry[];
}

/** Options for a single execution call. */
export interface ExecutionOptions {
  /** Timeout in ms. Overrides the function's own timeout. */
  timeout?: number;
}

/** Factory function for creating a Worker. Overridable for testing. */
type WorkerFactory = () => Worker;

const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(
    new URL("../workers/functionExecutor.worker.ts", import.meta.url),
    { type: "module" },
  );

export class FunctionExecutor {
  private activeWorker: Worker | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private createWorker: WorkerFactory;

  constructor(options?: { createWorker?: WorkerFactory }) {
    this.createWorker = options?.createWorker ?? defaultWorkerFactory;
  }

  /**
   * Execute a function definition with the given arguments in a
   * sandboxed Web Worker. Returns the result or error along with
   * execution metadata.
   *
   * A new worker is created for each execution and terminated
   * afterwards to prevent memory leaks.
   */
  async execute(
    func: FunctionDefinition,
    args: Record<string, unknown>,
    options: ExecutionOptions = {},
  ): Promise<ExecutionResult> {
    // Terminate any previous active worker
    this.terminate();

    const timeout = options.timeout ?? func.timeout ?? 5000;
    const startTime = performance.now();
    const consoleLogs: ConsoleEntry[] = [];

    return new Promise<ExecutionResult>((resolve) => {
      let settled = false;

      const worker = this.createWorker();
      this.activeWorker = worker;

      const cleanup = () => {
        if (this.timeoutId !== null) {
          clearTimeout(this.timeoutId);
          this.timeoutId = null;
        }
        worker.terminate();
        if (this.activeWorker === worker) {
          this.activeWorker = null;
        }
      };

      const settle = (result: ExecutionResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      // Timeout enforcement
      this.timeoutId = setTimeout(() => {
        settle({
          success: false,
          error: {
            message: `Function execution timed out after ${timeout}ms`,
            name: "TimeoutError",
          },
          executionTime: timeout,
          consoleLogs,
        });
      }, timeout);

      // Handle messages from the worker
      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data;

        switch (msg.type) {
          case "result":
            settle({
              success: true,
              data: msg.data,
              executionTime: performance.now() - startTime,
              consoleLogs,
            });
            break;

          case "error":
            settle({
              success: false,
              error: msg.error,
              executionTime: performance.now() - startTime,
              consoleLogs,
            });
            break;

          case "console":
            consoleLogs.push({
              level: msg.level,
              args: msg.args,
              timestamp: Date.now(),
            });
            break;
        }
      };

      // Handle worker-level errors (e.g. failed to load)
      worker.onerror = (event: ErrorEvent) => {
        settle({
          success: false,
          error: {
            message: event.message || "Worker error",
            name: "WorkerError",
          },
          executionTime: performance.now() - startTime,
          consoleLogs,
        });
      };

      // Send the execution request to the worker
      worker.postMessage({
        type: "execute",
        code: func.implementation,
        args,
        allowedAPIs: func.allowedAPIs,
      });
    });
  }

  /**
   * Validate function implementation code for syntax errors
   * without executing it. Runs on the main thread.
   *
   * Uses AsyncFunction so that top-level `await` (which the worker
   * supports) is accepted rather than flagged as a syntax error.
   */
  validate(code: string): { valid: boolean; error?: string } {
    try {
      // Must match the worker which wraps code in an async function
      const AsyncFunction = Object.getPrototypeOf(async function () {})
        .constructor as typeof Function;
      new AsyncFunction("args", `"use strict";\n${code}`);
      return { valid: true };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown syntax error";
      return { valid: false, error: message };
    }
  }

  /**
   * Terminate any currently running worker and clear timeouts.
   * Safe to call multiple times.
   */
  terminate(): void {
    if (this.activeWorker) {
      this.activeWorker.terminate();
      this.activeWorker = null;
    }
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
