import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatInterface, ConversationList } from "@/components/chat";
import { TooltipProvider } from "@/components/ui";
import { useConversationStore, useUIStore } from "@/stores";

import { createMockConv, mockModels, setupChatTests } from "./setup";

vi.setConfig({ testTimeout: 15000 });

// --- Mocks ---

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

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  ScrollBar: () => null,
}));

vi.mock("@/services/api/google", () => ({
  GoogleAPIClient: {
    createClient: vi.fn().mockImplementation(() =>
      Promise.resolve({
        chat: vi.fn(),
        streamChat: vi.fn().mockImplementation(async function* () {
          yield { delta: "Hello" };
          yield {
            delta: "",
            finishReason: "stop",
            usage: { totalTokens: 10, inputTokens: 5, outputTokens: 5 },
          };
        }),
        getModels: vi.fn().mockResolvedValue(mockModels),
      }),
    ),
  },
}));

setupChatTests();

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
  // Ensure sidebar is open for tests
  useUIStore.setState({ isSidebarOpen: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Conversation Management", () => {
  it("should rename a conversation via UI", async () => {
    const convId = "test-rename-id";
    await act(async () => {
      useConversationStore.setState({
        conversations: [createMockConv(convId, "Old Name")],
        activeConversationId: convId,
      });
    });

    const user = userEvent.setup({ delay: null });

    render(
      <TooltipProvider>
        <ConversationList />
      </TooltipProvider>,
    );

    // 1. Expand details
    const click1 = user.click(
      screen.getByRole("button", { name: /toggle details/i }),
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click1;

    // 2. Click Rename button
    const click2 = user.click(screen.getByRole("button", { name: /rename/i }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click2;

    // 3. Type new name
    const input = screen.getByDisplayValue("Old Name");
    const clear1 = user.clear(input);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await clear1;

    const type1 = user.type(input, "New Name{enter}");
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await type1;

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const state = useConversationStore.getState();
    const conv = state.conversations.find((c) => c.id === convId);
    expect(conv?.title).toBe("New Name");
  });

  it("should delete a conversation", async () => {
    const convId = "test-delete-id";
    await act(async () => {
      useConversationStore.setState({
        conversations: [createMockConv(convId, "Delete Me")],
        activeConversationId: convId,
      });
    });

    const user = userEvent.setup({ delay: null });

    render(
      <TooltipProvider>
        <ConversationList />
      </TooltipProvider>,
    );

    // 1. Expand
    const click1 = user.click(
      screen.getByRole("button", { name: /toggle details/i }),
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click1;

    // 2. Click Delete button
    const click2 = user.click(screen.getByRole("button", { name: /delete/i }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click2;

    // 3. Confirm dialog - pick the last 'Delete' button (the one in the dialog)
    const deleteBtns = screen.getAllByRole("button", {
      name: "Delete",
      hidden: true,
    });
    const click3 = user.click(deleteBtns[deleteBtns.length - 1]);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click3;

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(useConversationStore.getState().conversations).toHaveLength(0);
  });

  it("should cancel deletion", async () => {
    const convId = "test-cancel-id";
    await act(async () => {
      useConversationStore.setState({
        conversations: [createMockConv(convId, "Keep Me")],
        activeConversationId: convId,
      });
    });

    const user = userEvent.setup({ delay: null });

    render(
      <TooltipProvider>
        <ConversationList />
      </TooltipProvider>,
    );

    // 1. Expand
    const click1 = user.click(
      screen.getByRole("button", { name: /toggle details/i }),
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click1;

    // 2. Click Delete button
    const click2 = user.click(screen.getByRole("button", { name: /delete/i }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click2;

    // 3. Cancel dialog
    const click3 = user.click(
      screen.getByRole("button", { name: /cancel/i, hidden: true }),
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click3;

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(useConversationStore.getState().conversations).toHaveLength(1);
  });

  it("should allow creating a new conversation even when an ephemeral one exists", async () => {
    const ephemeralId = "ephemeral-1";
    await act(async () => {
      useConversationStore.setState({
        conversations: [
          createMockConv(ephemeralId, "New Conversation", {
            persisted: false,
            messages: [
              { id: "m1", role: "user", content: "Hi", timestamp: Date.now() },
            ],
          }),
        ],
        activeConversationId: ephemeralId,
      });
    });

    const user = userEvent.setup({ delay: null });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    const click1 = user.click(
      screen.getByRole("button", { name: /new conversation/i }),
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click1;

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const state = useConversationStore.getState();
    expect(state.conversations).toHaveLength(2);
    expect(state.activeConversationId).not.toBe(ephemeralId);
  });

  it("should REUSE an ephemeral conversation if it is empty", async () => {
    const ephemeralId = "ephemeral-1";
    await act(async () => {
      useConversationStore.setState({
        conversations: [
          createMockConv(ephemeralId, "New Conversation", {
            persisted: false,
            messages: [],
          }),
        ],
        activeConversationId: ephemeralId,
      });
    });

    const user = userEvent.setup({ delay: null });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    const click1 = user.click(
      screen.getByRole("button", { name: /new conversation/i }),
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click1;

    const state = useConversationStore.getState();
    expect(state.conversations).toHaveLength(1);
    expect(state.activeConversationId).toBe(ephemeralId);
  });
});
