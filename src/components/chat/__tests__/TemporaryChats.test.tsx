import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatInterface } from "@/components/chat";
import { TooltipProvider } from "@/components/ui";
import { conversations as conversationsDb } from "@/db";
import { useConversationStore, useUIStore } from "@/stores";

import { createMockConv, mockModels, setupChatTests } from "./setup";

vi.setConfig({ testTimeout: 15000 });

vi.mock("@/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks")>();
  return { ...actual, useMediaQuery: vi.fn().mockReturnValue(true) };
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
  Toaster: () => null,
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("remark-gfm", () => ({ default: () => {} }));

const mockDb = vi.hoisted(() => ({
  conversations: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue("test-conversation-id"),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
    save: vi.fn().mockResolvedValue("test-conversation-id"),
  },
  settings: {
    get: vi.fn().mockResolvedValue({ apiKeys: { google: "test-api-key" } }),
    save: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/db/operations", () => mockDb);
vi.mock("@/db", () => mockDb);

vi.mock("@/services/api/google", () => ({
  GoogleAPIClient: {
    createClient: vi.fn().mockImplementation(() =>
      Promise.resolve({
        chat: vi.fn(),
        streamChat: vi.fn().mockImplementation(async function* () {
          yield { delta: "Hello" };
          yield { delta: "", finishReason: "stop", usage: { totalTokens: 2 } };
        }),
        getModels: vi.fn().mockResolvedValue(mockModels),
      }),
    ),
  },
}));

setupChatTests();

describe("Temporary Chats", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "Date",
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should create a temporary conversation and NOT persist it", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    const btnPromise = screen.findByRole("button", { name: "More options" });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    const btn = await btnPromise;

    const click1 = user.click(btn);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click1;

    const optPromise = screen.findByText("Temporary Chat");
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    const opt = await optPromise;

    const click2 = user.click(opt);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click2;

    const state = useConversationStore.getState();
    const activeConv = state.conversations.find(
      (c) => c.id === state.activeConversationId,
    );
    expect(activeConv?.isTemporary).toBe(true);

    const sendPromise = useConversationStore
      .getState()
      .sendMessage("Hello Temp");
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await sendPromise;

    expect(conversationsDb.save).not.toHaveBeenCalled();
  });

  it("should preserve temporary status when switching models", async () => {
    const user = userEvent.setup({ delay: null });
    useUIStore.setState({ isChatSettingsOpen: true });
    useConversationStore.setState({
      conversations: [
        createMockConv("t1", "Temp", { isTemporary: true, persisted: false }),
      ],
      activeConversationId: "t1",
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    expect(useConversationStore.getState().availableModels).toHaveLength(
      mockModels.length,
    );

    const combo = screen.getAllByRole("combobox")[0];
    const click1 = user.click(combo);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click1;

    const modelOptPromise = screen.findByText("Model 2", {}, { timeout: 2000 });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    const modelOpt = await modelOptPromise;

    const click2 = user.click(modelOpt);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click2;

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const active = useConversationStore
      .getState()
      .conversations.find(
        (c) => c.id === useConversationStore.getState().activeConversationId,
      );
    expect(active?.modelId).toBe("m2");
    expect(active?.isTemporary).toBe(true);
  });

  it("should display a visual indicator for temporary chats", async () => {
    useConversationStore.setState({
      conversations: [
        createMockConv("t1", "Temp", { isTemporary: true, persisted: false }),
      ],
      activeConversationId: "t1",
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );
    expect(screen.getByText("Temporary Chat")).toBeInTheDocument();

    await act(async () => {
      useConversationStore.setState({
        conversations: [createMockConv("n1", "Normal")],
        activeConversationId: "n1",
      });
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.queryByText("Temporary Chat")).not.toBeInTheDocument();
  });

  it("should allow switching models (UI Features)", async () => {
    const user = userEvent.setup({ delay: null });
    useUIStore.setState({ isChatSettingsOpen: true });
    useConversationStore.setState({
      conversations: [createMockConv("c1", "Chat")],
      activeConversationId: "c1",
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    expect(useConversationStore.getState().availableModels).toHaveLength(
      mockModels.length,
    );

    const combo = screen.getAllByRole("combobox")[0];
    const click1 = user.click(combo);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click1;

    const modelOptPromise = screen.findByText("Model 2", {}, { timeout: 2000 });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    const modelOpt = await modelOptPromise;

    const click2 = user.click(modelOpt);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click2;

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const active = useConversationStore
      .getState()
      .conversations.find(
        (c) => c.id === useConversationStore.getState().activeConversationId,
      );
    expect(active?.modelId).toBe("m2");
  });
});
