import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatInterface } from "@/components/chat";
import { conversations as conversationsDb } from "@/db";
import { useMediaQuery } from "@/hooks";
import { GoogleAPIClient } from "@/services/api";
import { useConversationStore, useSettingsStore } from "@/stores";

// Mock useMediaQuery
vi.mock("@/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks")>();
  return {
    ...actual,
    useMediaQuery: vi.fn(),
  };
});

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
  Toaster: () => null,
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
      createClient: vi.fn().mockResolvedValue({
        chat: vi.fn().mockResolvedValue({
          message: {
            content: "Hello world",
            metadata: {
              finishReason: "stop",
              tokens: 2,
            },
          },
        }),
        streamChat: vi.fn().mockReturnValue(mockStream()),
        getModels: vi.fn().mockResolvedValue([
          {
            id: "gemini-pro",
            name: "Gemini Pro",
            description: "Test model",
            contextWindow: 32000,
            maxOutputTokens: 2048,
            capabilities: {
              vision: false,
              functionCalling: true,
              streaming: true,
            },
          },
        ]),
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

  it("should initialize a new conversation if none exists", async () => {
    render(<ChatInterface />);

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

    render(<ChatInterface />);

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

    render(<ChatInterface />);

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
          contextWindow: 32000,
          maxOutputTokens: 2048,
          capabilities: {
            vision: false,
            functionCalling: true,
            streaming: true,
          },
        },
        {
          id: "gemini-2.5-flash",
          name: "Gemini 2.5 Flash",
          description: "Fast model",
          contextWindow: 128000,
          maxOutputTokens: 4096,
          capabilities: {
            vision: true,
            functionCalling: true,
            streaming: true,
          },
        },
      ]),
      chat: vi.fn(),
      streamChat: vi.fn(),
    } as unknown as GoogleAPIClient);

    // Mock useMediaQuery to force desktop view
    vi.mocked(useMediaQuery).mockReturnValue(true);

    render(<ChatInterface />);

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
});
