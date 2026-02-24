import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatInterface } from "@/components/chat";
import { TooltipProvider } from "@/components/ui";
import { conversations as conversationsDb } from "@/db";
import { useConversationStore } from "@/stores";

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

describe("Conversation Management", () => {
  it("should rename a conversation via UI", async () => {
    const conversationId = "test-rename-id";
    useConversationStore.setState({
      conversations: [createMockConv(conversationId, "Old Title")],
      activeConversationId: conversationId,
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /toggle details/i }));
    fireEvent.click(await screen.findByRole("button", { name: /rename/i }));

    const input = await screen.findByDisplayValue("Old Title");
    fireEvent.change(input, { target: { value: "New Title" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(conversationsDb.update).toHaveBeenCalledWith(
        conversationId,
        expect.objectContaining({ title: "New Title" }),
      );
    });
    expect(screen.getByText("New Title")).toBeInTheDocument();
  });

  it("should delete a conversation", async () => {
    const conversationId = "test-delete-id";
    useConversationStore.setState({
      conversations: [createMockConv(conversationId, "Delete Me")],
      activeConversationId: conversationId,
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /toggle details/i }));
    fireEvent.click(await screen.findByRole("button", { name: /delete/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(conversationsDb.delete).toHaveBeenCalledWith(conversationId);
    });
    expect(screen.queryByText("Delete Me")).not.toBeInTheDocument();
  });

  it("should cancel deletion", async () => {
    const conversationId = "test-cancel-delete-id";
    useConversationStore.setState({
      conversations: [createMockConv(conversationId, "Keep Me")],
      activeConversationId: conversationId,
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /toggle details/i }));
    fireEvent.click(await screen.findByRole("button", { name: /delete/i }));
    fireEvent.click(await screen.findByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(conversationsDb.delete).not.toHaveBeenCalled();
    });
    expect(screen.getByText("Keep Me")).toBeInTheDocument();
  });

  it("should allow creating a new conversation even when an ephemeral one exists", async () => {
    useConversationStore.setState({
      conversations: [createMockConv("e1", "New", { persisted: false })],
      activeConversationId: "e1",
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    const newBtn = screen.getByRole("button", { name: /new conversation/i });
    expect(newBtn).not.toBeDisabled();
  });
});
