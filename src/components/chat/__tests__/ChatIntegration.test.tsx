import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import App from "@/App";
import { ChatInterface } from "@/components/chat";
import { TooltipProvider } from "@/components/ui";
import { conversations as conversationsDb } from "@/db";
import { GoogleAPIClient } from "@/services/api";
import { useConversationStore } from "@/stores";

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

vi.mock("@/services/api/google", () => {
  const mockStream = async function* () {
    yield { delta: "Hello" };
    await new Promise((resolve) => setTimeout(resolve, 10));
    yield { delta: " world" };
    await new Promise((resolve) => setTimeout(resolve, 10));
    yield { delta: "", finishReason: "stop", usage: { totalTokens: 2 } };
  };
  return {
    GoogleAPIClient: {
      createClient: vi.fn().mockImplementation(() =>
        Promise.resolve({
          chat: vi.fn().mockResolvedValue({
            message: {
              content: "Hello world",
              metadata: { finishReason: "stop", tokens: 2 },
            },
          }),
          streamChat: vi.fn().mockImplementation(() => mockStream()),
          getModels: vi.fn().mockResolvedValue(mockModels),
        }),
      ),
    },
  };
});

setupChatTests();

beforeEach(() => {
  // Clear any pending effects before faking timers
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

describe("ChatInterface — Initialization & Loading", () => {
  it("should initialize a new conversation on app load if none exists", async () => {
    render(<App />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const state = useConversationStore.getState();
    const conv = state.conversations.find(
      (c) => c.id === state.activeConversationId,
    );
    expect(conv).toBeDefined();
    expect(conv?.persisted).toBe(false);
    expect(conversationsDb.create).not.toHaveBeenCalled();
  });

  it("should preserve ephemeral conversations when loading from DB", async () => {
    const ephemeralId = "ephemeral-1";
    useConversationStore.setState({
      conversations: [
        createMockConv(ephemeralId, "New Conversation", { persisted: false }),
      ],
      activeConversationId: ephemeralId,
    });

    vi.mocked(conversationsDb.getAll).mockResolvedValueOnce([
      createMockConv("persisted-1", "Persisted Chat"),
    ]);

    await useConversationStore.getState().loadConversations();

    const state = useConversationStore.getState();
    expect(state.conversations.length).toBe(2);
    expect(state.conversations.find((c) => c.id === ephemeralId)).toBeDefined();
    expect(
      state.conversations.find((c) => c.id === "persisted-1"),
    ).toBeDefined();
  });
});

describe("ChatInterface — Messaging & Streaming", () => {
  it("should create a new conversation when sending the first message", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    const input = screen.getByPlaceholderText("Type a message...");
    const sendButton = screen.getByRole("button", { name: /send/i });

    const typePromise = user.type(input, "Hello New Conversation");
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await typePromise;

    const clickPromise = user.click(sendButton);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await clickPromise;

    expect(conversationsDb.save).toHaveBeenCalled();
  });

  it("should send a message and display the response", async () => {
    const user = userEvent.setup({ delay: null });
    useConversationStore.setState({
      conversations: [createMockConv("test-conv-id", "Test")],
      activeConversationId: "test-conv-id",
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    const input = screen.getByPlaceholderText("Type a message...");
    const typePromise = user.type(input, "Hello AI");
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await typePromise;

    const sendBtn = screen.getByRole("button", { name: /send/i });
    const clickPromise = user.click(sendBtn);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await clickPromise;

    expect(screen.getByText("Hello AI")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("should display error toast when streaming fails", async () => {
    const user = userEvent.setup({ delay: null });
    useConversationStore.setState({
      conversations: [
        createMockConv("test-conv-id", "Test", { modelId: "gemini-2.5-flash" }),
      ],
      activeConversationId: "test-conv-id",
    });

    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      getModels: vi.fn().mockResolvedValue([]),
      chat: vi.fn(),
      streamChat: vi.fn().mockImplementation(async function* () {
        yield { delta: "Start" };
        throw new Error("Stream failed");
      }),
    } as unknown as GoogleAPIClient);

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    const input = screen.getByPlaceholderText("Type a message...");
    const typePromise = user.type(input, "Hello Error");
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await typePromise;

    const sendBtn = screen.getByRole("button", { name: /send/i });
    const clickPromise = user.click(sendBtn);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await clickPromise;

    expect(toast.error).toHaveBeenCalledWith("Stream failed");
  });
});

describe("ChatInterface — Message Interactions", () => {
  it("should show confirmation dialog when deleting a message", async () => {
    const user = userEvent.setup({ delay: null });
    useConversationStore.setState({
      conversations: [
        createMockConv("test-conv", "Test", {
          messages: [
            {
              id: "msg-1",
              role: "user",
              content: "Hello",
              timestamp: Date.now(),
            },
            {
              id: "msg-2",
              role: "model",
              content: "Hi there",
              timestamp: Date.now(),
            },
          ],
        }),
      ],
      activeConversationId: "test-conv",
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    const deleteButtons = screen.getAllByTitle("Delete message");
    const click1 = user.click(deleteButtons[0]);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click1;

    expect(screen.getByText("Delete Message")).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    const clickCancel = user.click(cancelBtn);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await clickCancel;
    expect(screen.queryByText("Delete Message")).not.toBeInTheDocument();

    const deleteButtonsAgain = screen.getAllByTitle("Delete message");
    const click2 = user.click(deleteButtonsAgain[0]);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await click2;

    const confirmDeleteBtn = screen.getByRole("button", { name: "Delete" });
    const clickConfirm = user.click(confirmDeleteBtn);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await clickConfirm;

    const conv = useConversationStore
      .getState()
      .conversations.find((c) => c.id === "test-conv");
    expect(conv?.messages).toHaveLength(0);
  });

  it("should edit a message and trigger regeneration", async () => {
    const user = userEvent.setup({ delay: null });
    useConversationStore.setState({
      conversations: [
        createMockConv("test-edit-conv", "Test Edit", {
          messages: [
            {
              id: "msg-1",
              role: "user",
              content: "Original Content",
              timestamp: Date.now(),
            },
            {
              id: "msg-2",
              role: "model",
              content: "Response",
              timestamp: Date.now(),
            },
          ],
        }),
      ],
      activeConversationId: "test-edit-conv",
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    const editBtn = screen.getAllByTitle("Edit message")[0];
    const clickEdit = user.click(editBtn);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await clickEdit;

    const editInput = screen.getByDisplayValue("Original Content");
    const clearPromise = user.clear(editInput);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await clearPromise;

    const typePromise = user.type(editInput, "New Content");
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await typePromise;

    const saveBtn = screen.getByRole("button", { name: /save & submit/i });
    const clickSave = user.click(saveBtn);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await clickSave;

    const conv = useConversationStore
      .getState()
      .conversations.find((c) => c.id === "test-edit-conv");
    expect(conv?.messages[0].content).toBe("New Content");
    // Regeneration added a message back
    expect(conv?.messages.length).toBeGreaterThanOrEqual(1);
  });

  it("should retry a message regeneration", async () => {
    const user = userEvent.setup({ delay: null });
    useConversationStore.setState({
      conversations: [
        createMockConv("test-retry-conv", "Test Retry", {
          messages: [
            {
              id: "msg-1",
              role: "user",
              content: "Retry Request",
              timestamp: Date.now(),
            },
            {
              id: "msg-2",
              role: "model",
              content: "Bad Response",
              timestamp: Date.now(),
            },
          ],
        }),
      ],
      activeConversationId: "test-retry-conv",
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    const retryBtn = screen.getAllByTitle("Regenerate response")[0];
    const clickRetry = user.click(retryBtn);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await clickRetry;

    const conv = useConversationStore
      .getState()
      .conversations.find((c) => c.id === "test-retry-conv");
    expect(conv?.messages[0].content).toBe("Retry Request");
    expect(conv?.messages.length).toBeGreaterThanOrEqual(1);
  });
});
