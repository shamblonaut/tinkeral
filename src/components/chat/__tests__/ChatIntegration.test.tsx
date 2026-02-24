import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
    yield { delta: " world" };
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

describe("ChatInterface — Initialization & Loading", () => {
  it("should initialize a new conversation on app load if none exists", async () => {
    render(<App />);

    await waitFor(() => {
      expect(
        useConversationStore.getState().activeConversationId,
      ).not.toBeNull();
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
    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    const input = screen.getByPlaceholderText("Type a message...");
    const sendButton = screen.getByRole("button", { name: /send/i });

    await act(async () => {
      fireEvent.change(input, { target: { value: "Hello New Conversation" } });
      fireEvent.click(sendButton);
    });

    await waitFor(() => {
      expect(conversationsDb.save).toHaveBeenCalled();
    });
  });

  it("should send a message and display the response", async () => {
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
    fireEvent.change(input, { target: { value: "Hello AI" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByText("Hello AI")).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByText("Hello world")).toBeInTheDocument(),
    );
  });

  it("should display error toast when streaming fails", async () => {
    useConversationStore.setState({
      conversations: [
        createMockConv("test-conv-id", "Test", { modelId: "gemini-2.5-flash" }),
      ],
      activeConversationId: "test-conv-id",
    });

    vi.mocked(GoogleAPIClient.createClient).mockResolvedValueOnce({
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

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
        target: { value: "Hello Error" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send/i }));
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Stream failed"),
    );
  });
});

describe("ChatInterface — Message Interactions", () => {
  it("should show confirmation dialog when deleting a message", async () => {
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
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByText("Delete Message")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });
    await waitFor(() =>
      expect(screen.queryByText("Delete Message")).not.toBeInTheDocument(),
    );

    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      const conv = useConversationStore
        .getState()
        .conversations.find((c) => c.id === "test-conv");
      expect(conv?.messages).toHaveLength(0);
    });
  });

  it("should edit a message and trigger regeneration", async () => {
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

    fireEvent.click(screen.getAllByTitle("Edit message")[0]);
    fireEvent.change(screen.getByDisplayValue("Original Content"), {
      target: { value: "New Content" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save & submit/i }));

    await waitFor(() => {
      const conv = useConversationStore
        .getState()
        .conversations.find((c) => c.id === "test-edit-conv");
      expect(conv?.messages[0].content).toBe("New Content");
      expect(conv?.messages).toHaveLength(1);
    });
  });

  it("should retry a message regeneration", async () => {
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

    fireEvent.click(screen.getAllByTitle("Regenerate response")[0]);

    await waitFor(() => {
      const conv = useConversationStore
        .getState()
        .conversations.find((c) => c.id === "test-retry-conv");
      expect(conv?.messages).toHaveLength(1);
      expect(conv?.messages[0].content).toBe("Retry Request");
    });
  });
});
