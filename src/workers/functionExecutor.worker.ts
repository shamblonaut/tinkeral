/**
 * Web Worker for sandboxed execution of user-defined functions.
 *
 * Runs user code in an isolated context with:
 * - Restricted global scope (no DOM, no importScripts, etc.)
 * - Configurable API whitelist (e.g. fetch only if explicitly allowed)
 * - Console output captured and forwarded to main thread
 * - Async function support (user code can use `await`)
 */

/** Message types sent from the main thread to this worker. */
export interface ExecuteMessage {
  type: "execute";
  code: string;
  args: Record<string, unknown>;
  allowedAPIs?: string[];
}

/** Message types sent from this worker to the main thread. */
export type WorkerResponse =
  | { type: "result"; data: unknown }
  | { type: "error"; error: { message: string; name: string; stack?: string } }
  | { type: "console"; level: "log" | "warn" | "error"; args: unknown[] };

/** Typed subset of the DedicatedWorkerGlobalScope APIs used in this file. */
interface WorkerGlobal {
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: MessageEvent<ExecuteMessage>) => void) | null;
}
const workerSelf = self as unknown as WorkerGlobal;

/**
 * Block dangerous globals that could be used to escape the sandbox.
 * `fetch` is blocked by default unless explicitly allowed.
 */
function restrictGlobals(allowedAPIs: string[]): void {
  const BLOCKED_GLOBALS = [
    "importScripts",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "BroadcastChannel",
    "SharedWorker",
    "navigator",
    "indexedDB",
    "caches",
    "crypto",
  ];

  if (!allowedAPIs.includes("fetch")) {
    BLOCKED_GLOBALS.push("fetch");
  }

  for (const name of BLOCKED_GLOBALS) {
    try {
      Object.defineProperty(workerSelf, name, {
        value: undefined,
        writable: false,
        configurable: false,
      });
    } catch {
      // Some properties may not be configurable — ignore
    }
  }
}

/**
 * Intercept console.log/warn/error and forward output to the main thread
 * so the UI can display it.
 */
function setupConsoleCapture(): void {
  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  const captureMethod = (level: "log" | "warn" | "error") => {
    return (...args: unknown[]) => {
      try {
        workerSelf.postMessage({
          type: "console",
          level,
          args: args.map((arg) => {
            try {
              // Attempt structured clone compatible serialization
              return JSON.parse(JSON.stringify(arg));
            } catch {
              return String(arg);
            }
          }),
        } satisfies WorkerResponse);
      } catch {
        // Ignore serialization failures
      }
      originalConsole[level](...args);
    };
  };

  console.log = captureMethod("log");
  console.warn = captureMethod("warn");
  console.error = captureMethod("error");
}

/**
 * Execute user code in a sandboxed async function.
 *
 * The user's implementation receives an `args` parameter containing
 * the function call arguments as key-value pairs.
 */
async function handleExecute(msg: ExecuteMessage): Promise<void> {
  try {
    restrictGlobals(msg.allowedAPIs || []);
    setupConsoleCapture();

    // Create an async function from user code so `await` is supported
    const AsyncFunction = Object.getPrototypeOf(async function () {})
      .constructor as new (
      ...args: string[]
    ) => (...args: unknown[]) => unknown;

    const fn = new AsyncFunction("args", `"use strict";\n${msg.code}`);
    const result = await fn(msg.args);

    // Ensure the result is serializable
    try {
      workerSelf.postMessage({
        type: "result",
        data: result,
      } satisfies WorkerResponse);
    } catch {
      // Result is not structured-cloneable — stringify it
      workerSelf.postMessage({
        type: "result",
        data: JSON.parse(JSON.stringify(result)),
      } satisfies WorkerResponse);
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    workerSelf.postMessage({
      type: "error",
      error: {
        message: err.message,
        name: err.name,
        stack: err.stack,
      },
    } satisfies WorkerResponse);
  }
}

workerSelf.onmessage = (event: MessageEvent<ExecuteMessage>) => {
  const { data } = event;
  if (data.type === "execute") {
    handleExecute(data);
  }
};
