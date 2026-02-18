import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatInterface } from "@/components/chat";
import { TooltipProvider } from "@/components/ui";
import { conversations as conversationsDb } from "@/db";
import { GoogleAPIClient } from "@/services/api";
import { useConversationStore, useSettingsStore } from "@/stores";

// Mock useMediaQuery
vi.mock("@/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks")>();
  return {
    ...actual,
    useMediaQuery: vi.fn().mockReturnValue(true),
  };
});

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
  Toaster: () => null,
}));

// Mock ReactMarkdown to avoid expensive parsing during tests
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("remark-gfm", () => ({
  default: () => {},
}));

// Mock dependencies
vi.mock("@/db/operations", () => ({
  conversations: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue("test-conversation-id"),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
  },
  settings: {
    get: vi.fn().mockResolvedValue({
      apiKeys: { google: "test-api-key" },
    }),
  },
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock the Google API client dynamic import
vi.mock("@/services/api/google", () => {
  const mockStream = async function* () {
    yield { delta: "Hello" };
    yield { delta: " world" };
    yield {
      delta: "",
      finishReason: "stop",
      usage: { totalTokens: 2 },
    };
  };

  return {
    GoogleAPIClient: {
      createClient: vi.fn().mockImplementation(() => {
        return Promise.resolve({
          chat: vi.fn().mockResolvedValue({
            message: {
              content: "Hello world",
              metadata: {
                finishReason: "stop",
                tokens: 2,
              },
            },
          }),
          streamChat: vi.fn().mockImplementation(() => mockStream()),
          getModels: vi.fn().mockResolvedValue([
            {
              id: "gemini-pro",
              name: "Gemini Pro",
              description: "Test model",
              contextWindow: { input: 32000, output: 2048 },
              capabilities: {
                imageInput: false,
                videoInput: false,
                audioInput: false,
                textGeneration: true,
                imageGeneration: false,
                videoGeneration: false,
                speechGeneration: false,
                functionCalling: true,
                codeExecution: true,
                systemInstruction: true,
                thinking: false,
              },
            },
          ]),
        });
      }),
    },
  };
});

describe("ChatInterface Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useConversationStore.setState({
      conversations: [],
      activeConversationId: null,
      isLoading: false,
      error: null,
    });

    // Initialize mock settings
    useSettingsStore.setState({
      settings: {
        id: "app-settings",
        apiKeys: { google: "test-api-key" },
        defaultModel: "gemini-pro",
        defaultParameters: {
          temperature: 0.7,
          maxTokens: 1024,
          topP: 0.9,
        },
        uiPreferences: {
          theme: "system",
          fontSize: "medium",
          codeTheme: "github-dark",
          showTokenCount: true,
          showCostEstimate: true,
        },
      },
      isLoading: false,
      error: null,
    });
  });

  it("should create a new conversation when sending the first message", async () => {
    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    const input = screen.getByPlaceholderText("Type a message...");
    const sendButton = screen.getByRole("button", { name: /send/i });

    fireEvent.change(input, { target: { value: "Hello New Conversation" } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(conversationsDb.create).toHaveBeenCalled();
    });
  });

  it("should send a message and display the response", async () => {
    // Setup initial state with a conversation
    useConversationStore.setState({
      conversations: [
        {
          id: "test-conversation-id",
          title: "Test",
          modelId: "gemini-pro",
          parameters: { temperature: 0.7, maxTokens: 1024, topP: 0.9 },
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      activeConversationId: "test-conversation-id",
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    const input = screen.getByPlaceholderText("Type a message...");
    const sendButton = screen.getByRole("button", { name: /send/i });

    fireEvent.change(input, { target: { value: "Hello AI" } });
    fireEvent.click(sendButton);

    // Check user message appears
    await waitFor(() => {
      expect(screen.getByText("Hello AI")).toBeInTheDocument();
    });

    // Check loading/stream response
    // The mock stream returns "Hello" then " world", so we expect "Hello world" eventually
    await waitFor(() => {
      expect(screen.getByText("Hello world")).toBeInTheDocument();
    });
  });

  it("should display error toast when streaming fails", async () => {
    // Setup initial state
    useConversationStore.setState({
      conversations: [
        {
          id: "test-conversation-id",
          title: "Test",
          modelId: "gemini-2.5-flash",
          parameters: { temperature: 0.7, maxTokens: 1024, topP: 0.9 },
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      activeConversationId: "test-conversation-id",
    });

    // Override mock to throw error on the second call (sendMessage)
    // First call is from ModelSelector (needs getModels)
    vi.mocked(GoogleAPIClient.createClient)
      .mockResolvedValueOnce({
        getModels: vi.fn().mockResolvedValue([]),
        chat: vi.fn(),
        streamChat: vi.fn(),
      } as unknown as GoogleAPIClient)
      .mockResolvedValueOnce({
        getModels: vi.fn(),
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
    const sendButton = screen.getByRole("button", { name: /send/i });

    fireEvent.change(input, { target: { value: "Hello Error" } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Stream failed");
    });

    // Partial content should still be there
    expect(screen.getByText("Start")).toBeInTheDocument();
  });

  it("should allow switching models", async () => {
    // Setup initial state
    useConversationStore.setState({
      conversations: [
        {
          id: "test-conversation-id",
          title: "Test",
          modelId: "gemini-pro",
          parameters: { temperature: 0.7, maxTokens: 1024, topP: 0.9 },
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      activeConversationId: "test-conversation-id",
    });

    // Explicitly mock for this test to ensure clean state
    vi.mocked(GoogleAPIClient.createClient).mockResolvedValue({
      getModels: vi.fn().mockResolvedValue([
        {
          id: "gemini-pro",
          name: "Gemini Pro",
          description: "Test model",
          contextWindow: { input: 32000, output: 2048 },
          capabilities: {
            imageInput: false,
            videoInput: false,
            audioInput: false,
            textGeneration: true,
            imageGeneration: false,
            videoGeneration: false,
            speechGeneration: false,
            functionCalling: true,
            codeExecution: true,
            systemInstruction: true,
            thinking: false,
          },
        },
        {
          id: "gemini-2.5-flash",
          name: "Gemini 2.5 Flash",
          description: "Fast model",
          contextWindow: { input: 128000, output: 4096 },
          capabilities: {
            imageInput: true,
            videoInput: true,
            audioInput: true,
            textGeneration: true,
            imageGeneration: false,
            videoGeneration: false,
            speechGeneration: false,
            functionCalling: true,
            codeExecution: true,
            systemInstruction: true,
            thinking: false,
          },
        },
      ]),
      chat: vi.fn(),
      streamChat: vi.fn(),
    } as unknown as GoogleAPIClient);

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    // Open model selector
    // The select trigger displays the current model name
    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    // Select new model
    const newModelOption = await screen.findByText("Gemini 2.5 Flash");
    fireEvent.click(newModelOption);

    // Verify creating new conversation with new model
    await waitFor(() => {
      expect(conversationsDb.create).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: "gemini-2.5-flash",
        }),
      );
    });
  });

  it("should delete a conversation", async () => {
    // Setup initial state
    const conversationId = "test-delete-id";
    useConversationStore.setState({
      conversations: [
        {
          id: conversationId,
          title: "Delete Me",
          modelId: "gemini-pro",
          parameters: { temperature: 0.7, maxTokens: 1024, topP: 0.9 },
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      activeConversationId: conversationId,
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    // 1. Expand the conversation item to see the Delete button
    // The "More" button has the MoreVertical icon and sr-only "Toggle details"
    const moreButton = screen.getByRole("button", { name: /toggle details/i });
    fireEvent.click(moreButton);

    // 2. Click the Delete button in the expanded section
    const deleteButton = await screen.findByRole("button", { name: /delete/i });
    fireEvent.click(deleteButton);

    // 3. Confirm deletion in the Dialog
    // Radix Dialog might render in a portal, but screen.findByRole should find it if it's in the DOM
    const confirmDeleteButton = await screen.findByRole("button", {
      name: /^delete$/i, // Match the "Delete" button in the dialog specifically
    });
    fireEvent.click(confirmDeleteButton);

    // 4. Verify deletion
    await waitFor(() => {
      expect(conversationsDb.delete).toHaveBeenCalledWith(conversationId);
    });

    // Verify UI updates (no longer in list)
    expect(screen.queryByText("Delete Me")).not.toBeInTheDocument();
  });

  it("should cancel deletion", async () => {
    // Setup initial state
    const conversationId = "test-cancel-delete-id";
    useConversationStore.setState({
      conversations: [
        {
          id: conversationId,
          title: "Keep Me",
          modelId: "gemini-pro",
          parameters: { temperature: 0.7, maxTokens: 1024, topP: 0.9 },
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      activeConversationId: conversationId,
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    // 1. Expand item
    const moreButton = screen.getByRole("button", { name: /toggle details/i });
    fireEvent.click(moreButton);

    // 2. Click Delete
    const deleteButton = await screen.findByRole("button", { name: /delete/i });
    fireEvent.click(deleteButton);

    // 3. Click Cancel in Dialog
    const cancelButton = await screen.findByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    // 4. Verify NOT deleted
    await waitFor(() => {
      expect(conversationsDb.delete).not.toHaveBeenCalled();
    });

    // Verify still in document
    expect(screen.getByText("Keep Me")).toBeInTheDocument();
  });

  it("should rename a conversation via UI", async () => {
    // Setup initial state
    const conversationId = "test-rename-id";
    useConversationStore.setState({
      conversations: [
        {
          id: conversationId,
          title: "Old Title",
          modelId: "gemini-pro",
          parameters: { temperature: 0.7, maxTokens: 1024, topP: 0.9 },
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      activeConversationId: conversationId,
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    // 1. Expand item
    const moreButton = screen.getByRole("button", { name: /toggle details/i });
    fireEvent.click(moreButton);

    // 2. Click Rename button
    const renameButton = await screen.findByRole("button", { name: /rename/i });
    fireEvent.click(renameButton);

    // 3. Find input, change value, hit Enter
    const input = await screen.findByDisplayValue("Old Title");
    fireEvent.change(input, { target: { value: "New Title" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    // 4. Verify store update (and persistence implied by store logic)
    await waitFor(() => {
      expect(conversationsDb.update).toHaveBeenCalledWith(
        conversationId,
        expect.objectContaining({ title: "New Title" }),
      );
    });

    // Verify UI update
    expect(screen.getByText("New Title")).toBeInTheDocument();
  });
});
