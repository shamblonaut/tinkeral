import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/shared/components/ui";
import { useUIStore } from "@/shared/store/ui";

import { ChatInterface, ConversationList } from "..";
import { useConversationStore } from "../../store";
import { createMockConv, mockModels, setupChatTests } from "./setup";

vi.setConfig({ testTimeout: 15000 });

// --- Mocks ---

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

const triggerClick = (element: Element) => {
  fireEvent.pointerDown(element);
  fireEvent.mouseDown(element);
  fireEvent.pointerUp(element);
  fireEvent.mouseUp(element);
  fireEvent.click(element);
};

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

    render(
      <TooltipProvider>
        <ConversationList />
      </TooltipProvider>,
    );

    // 1. Expand details
    triggerClick(screen.getByRole("button", { name: /toggle details/i }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // 2. Click Rename button
    triggerClick(screen.getByRole("button", { name: /rename/i }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // 3. Type new name
    const input = screen.getByDisplayValue("Old Name");
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const state = useConversationStore.getState();
    const conv = state.conversations.find((c) => c.id === convId);
    expect(conv?.title).toBe("New Name");
  });

  it("should cancel deletion before confirming delete", async () => {
    const convId = "test-delete-flow-id";
    await act(async () => {
      useConversationStore.setState({
        conversations: [createMockConv(convId, "Delete Flow")],
        activeConversationId: convId,
      });
    });

    render(
      <TooltipProvider>
        <ConversationList />
      </TooltipProvider>,
    );

    // 1. Expand
    triggerClick(screen.getByRole("button", { name: /toggle details/i }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // 2. Click Delete button
    triggerClick(screen.getByRole("button", { name: /delete/i }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // 3. Cancel dialog first
    triggerClick(screen.getByRole("button", { name: /cancel/i, hidden: true }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(useConversationStore.getState().conversations).toHaveLength(1);

    // 4. Re-open and confirm delete
    triggerClick(screen.getByRole("button", { name: /delete/i }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const deleteBtns = screen.getAllByRole("button", {
      name: "Delete",
      hidden: true,
    });
    triggerClick(deleteBtns[deleteBtns.length - 1]);
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(useConversationStore.getState().conversations).toHaveLength(0);
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

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    triggerClick(screen.getByRole("button", { name: /new conversation/i }));
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

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    triggerClick(screen.getByRole("button", { name: /new conversation/i }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const state = useConversationStore.getState();
    expect(state.conversations).toHaveLength(1);
    expect(state.activeConversationId).toBe(ephemeralId);
  });
});
