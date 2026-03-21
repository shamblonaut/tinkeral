import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecuteMessage } from "../functionExecutor.worker";

type WorkerSelfMock = {
  postMessage: ReturnType<typeof vi.fn>;
  onmessage: ((event: MessageEvent<ExecuteMessage>) => void) | null;
};

const toMessageEvent = (data: ExecuteMessage): MessageEvent<ExecuteMessage> =>
  ({ data }) as unknown as MessageEvent<ExecuteMessage>;

async function loadWorkerWithSelf(selfMock: WorkerSelfMock) {
  vi.resetModules();
  Object.assign(globalThis, { self: selfMock });
  await import("../functionExecutor.worker");
}

describe("functionExecutor.worker", () => {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  it("executes code and posts result", async () => {
    const selfMock: WorkerSelfMock = {
      postMessage: vi.fn(),
      onmessage: null,
    };

    await loadWorkerWithSelf(selfMock);

    expect(selfMock.onmessage).not.toBeNull();
    selfMock.onmessage?.(
      toMessageEvent({
        type: "execute",
        code: "return args.value + 2;",
        args: { value: 3 },
      }),
    );

    await Promise.resolve();

    expect(selfMock.postMessage).toHaveBeenCalledWith({
      type: "result",
      data: 5,
    });
  });

  it("posts structured error when user code throws", async () => {
    const selfMock: WorkerSelfMock = {
      postMessage: vi.fn(),
      onmessage: null,
    };

    await loadWorkerWithSelf(selfMock);

    expect(selfMock.onmessage).not.toBeNull();
    selfMock.onmessage?.(
      toMessageEvent({
        type: "execute",
        code: "throw new Error('boom');",
        args: {},
      }),
    );

    await Promise.resolve();

    expect(selfMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        error: expect.objectContaining({
          name: "Error",
          message: "boom",
        }),
      }),
    );
  });

  it("falls back when first result postMessage throws", async () => {
    const selfMock: WorkerSelfMock = {
      postMessage: vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error("clone-failed");
        })
        .mockImplementation(() => undefined),
      onmessage: null,
    };

    await loadWorkerWithSelf(selfMock);

    expect(selfMock.onmessage).not.toBeNull();
    selfMock.onmessage?.(
      toMessageEvent({
        type: "execute",
        code: "return { ok: true };",
        args: {},
      }),
    );

    await Promise.resolve();

    expect(selfMock.postMessage).toHaveBeenCalledTimes(2);
    expect(selfMock.postMessage).toHaveBeenNthCalledWith(2, {
      type: "result",
      data: { ok: true },
    });
  });

  it("continues execution when console forwarding postMessage fails", async () => {
    const selfMock: WorkerSelfMock = {
      postMessage: vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error("console-forward-failed");
        })
        .mockImplementation(() => undefined),
      onmessage: null,
    };

    await loadWorkerWithSelf(selfMock);

    expect(selfMock.onmessage).not.toBeNull();
    selfMock.onmessage?.(
      toMessageEvent({
        type: "execute",
        code: "console.log('hello'); return 1;",
        args: {},
      }),
    );

    await Promise.resolve();

    expect(selfMock.postMessage).toHaveBeenCalledWith({
      type: "result",
      data: 1,
    });
  });

  it("stringifies non-serializable console args and tolerates defineProperty errors", async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const selfMock: WorkerSelfMock = {
      postMessage: vi.fn(),
      onmessage: null,
    };
    Object.defineProperty(selfMock, "importScripts", {
      value: undefined,
      configurable: false,
      writable: false,
    });

    await loadWorkerWithSelf(selfMock);

    expect(selfMock.onmessage).not.toBeNull();
    selfMock.onmessage?.(
      toMessageEvent({
        type: "execute",
        code: "console.warn(args.value); return 'ok';",
        args: { value: circular },
      }),
    );

    await Promise.resolve();

    const consoleMessage = selfMock.postMessage.mock.calls.find(
      (call) => call[0]?.type === "console",
    )?.[0];
    expect(consoleMessage).toBeDefined();
    expect(consoleMessage.args[0]).toBe("[object Object]");
    expect(selfMock.postMessage).toHaveBeenCalledWith({
      type: "result",
      data: "ok",
    });
  });
});
