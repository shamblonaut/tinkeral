import { conversations as conversationsDb } from "@/db/operations";
import { useConversationStore } from "@/stores/conversation";
import { useSettingsStore } from "@/stores/settings";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatInterface } from "./ChatInterface";

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

// Mock the Google API client dynamic import
vi.mock("@/services/api/google", () => {
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
});
