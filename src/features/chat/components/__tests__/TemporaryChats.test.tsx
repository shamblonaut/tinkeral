import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { conversations as conversationsDb } from "@/db";
import { TooltipProvider } from "@/shared/components/ui";
import { useUIStore } from "@/shared/store/ui";

import { ChatInterface } from "..";
import { useConversationStore } from "../../store";
import { createMockConv, mockModels, setupChatTests } from "./setup";

vi.setConfig({ testTimeout: 15000 });

vi.mock("@/shared/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/hooks")>();
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

const triggerClick = (element: Element) => {
  fireEvent.pointerDown(element);
  fireEvent.mouseDown(element);
  fireEvent.pointerUp(element);
  fireEvent.mouseUp(element);
  fireEvent.click(element);
};

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
    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    const btn = screen.getByRole("button", { name: "More options" });

    triggerClick(btn);
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    const opt = screen.getByText("Temporary Chat");

    triggerClick(opt);
    await act(async () => {
      await vi.runAllTimersAsync();
    });

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
    triggerClick(combo);
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    const modelOpt = screen.getByText("Model 2");

    triggerClick(modelOpt);
    await act(async () => {
      await vi.runAllTimersAsync();
    });

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
    triggerClick(combo);
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    const modelOpt = screen.getByText("Model 2");

    triggerClick(modelOpt);
    await act(async () => {
      await vi.runAllTimersAsync();
    });

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
