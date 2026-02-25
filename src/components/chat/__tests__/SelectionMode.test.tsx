import { act, fireEvent, render, screen } from "@testing-library/react";
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
        streamChat: vi.fn(),
        getModels: vi.fn().mockResolvedValue(mockModels),
      }),
    ),
  },
}));

setupChatTests();

describe("Selection Mode & Bulk Actions", () => {
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

  it("should toggle selection mode and select items", async () => {
    useConversationStore.setState({
      conversations: [
        createMockConv("c1", "Conv 1"),
        createMockConv("c2", "Conv 2"),
      ],
      activeConversationId: "c1",
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByTitle("Select conversations"));
    expect(screen.getByText("0 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Conv 1").closest("div[class*='group']")!);
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Select All"));
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Deselect All"));
    expect(screen.getByText("0 selected")).toBeInTheDocument();
  });

  it("should select only visible (persisted) conversations when 'Select All' is clicked", async () => {
    useConversationStore.setState({
      conversations: [
        createMockConv("p1", "Persisted", { persisted: true }),
        createMockConv("e1", "Ephemeral", { persisted: false }),
      ],
      activeConversationId: "p1",
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByTitle("Select conversations"));
    fireEvent.click(screen.getByTitle("Select All"));

    const state = useConversationStore.getState();
    expect(state.selectedIds).toContain("p1");
    expect(state.selectedIds).not.toContain("e1");
  });

  it("should bulk delete conversations", async () => {
    useConversationStore.setState({
      conversations: [
        createMockConv("c1", "Conv 1"),
        createMockConv("c2", "Conv 2"),
      ],
      activeConversationId: null,
    });

    render(
      <TooltipProvider>
        <ChatInterface />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByTitle("Select conversations"));
    fireEvent.click(screen.getByTitle("Select All"));
    fireEvent.click(screen.getByTitle("Delete selected"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(conversationsDb.delete).toHaveBeenCalledTimes(2);
  });
});
