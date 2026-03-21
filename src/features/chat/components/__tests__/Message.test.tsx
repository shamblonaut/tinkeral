import type { Message as MessageType } from "@/shared/types";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(function (
  this: ResizeObserver,
) {
  this.observe = vi.fn();
  this.unobserve = vi.fn();
  this.disconnect = vi.fn();
});

// Variables starting with "mock" are allowed in vi.mock factories
const mockDeleteMessage = vi.fn();
const mockRetryMessage = vi.fn();
const mockEditMessage = vi.fn();
const mockAbortGeneration = vi.fn();

const mockStateResult = {
  deleteMessage: mockDeleteMessage,
  retryMessage: mockRetryMessage,
  editMessage: mockEditMessage,
  abortGeneration: mockAbortGeneration,
};

// Mock sub-components directly to isolate Message
vi.mock("../message/FunctionCallDisplay", () => ({
  FunctionCallDisplay: () => <div data-testid="function-call-display" />,
}));
vi.mock("../message/MessageActions", () => ({
  MessageActions: (props: {
    onCopy: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onRetry: () => void;
  }) => (
    <div data-testid="message-actions">
      <button onClick={props.onCopy}>Copy</button>
      <button onClick={props.onEdit}>Edit</button>
      <button onClick={props.onDelete}>Delete</button>
      <button onClick={props.onRetry}>Retry</button>
    </div>
  ),
}));
vi.mock("../message/MessageContent", () => ({
  MessageContent: (props: {
    content: string;
    isEditing: boolean;
    editContent: string;
    onEditContentChange: (v: string) => void;
    onSave: () => void;
    onCancel: () => void;
  }) => (
    <div data-testid="message-content">
      {props.content}
      {props.isEditing && (
        <div>
          <input
            data-testid="edit-input"
            defaultValue={props.editContent}
            onChange={(e) => props.onEditContentChange(e.target.value)}
          />
          <button onClick={props.onSave}>Save</button>
          <button onClick={props.onCancel}>Cancel</button>
        </div>
      )}
    </div>
  ),
}));
vi.mock("../message/TokenUsageDisplay", () => ({
  TokenUsageDisplay: () => <div data-testid="token-usage-display" />,
}));

vi.mock("@/features/functions", () => ({
  FunctionErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the store hook to ALWAYS return the same stable mockStateResult object
vi.mock("@/features/chat/store", () => ({
  useConversationStore: () => mockStateResult,
}));

// Mock zustand shallow to just return the selector (no-op)
vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: unknown) => fn,
}));

// Mock UI primitives from Shadcn
vi.mock("@/shared/components/ui", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="avatar">{children}</div>
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AvatarImage: () => null,
  Button: ({
    children,
    onClick,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
  }) => (
    <button onClick={onClick} data-variant={variant}>
      {children}
    </button>
  ),
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Now import the component
import { Message } from "../message/Message";

describe("Message", () => {
  const now = Date.now();

  const userMessage = [
    {
      id: "m1",
      role: "user",
      content: "hello",
      timestamp: now,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Proper way to mock navigator.clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  it("renders user message", () => {
    render(<Message messageGroup={userMessage as unknown as MessageType[]} />);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("handles copy", async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true,
    });

    render(<Message messageGroup={userMessage as unknown as MessageType[]} />);
    await user.click(screen.getByText("Copy"));
    expect(writeTextSpy).toHaveBeenCalledWith("hello");
  });

  it("handles edit and save", async () => {
    const user = userEvent.setup();
    render(<Message messageGroup={userMessage as unknown as MessageType[]} />);

    await user.click(screen.getByText("Edit"));
    const input = screen.getByTestId("edit-input");
    fireEvent.change(input, { target: { value: "new content" } });
    await user.click(screen.getByText("Save"));

    expect(mockEditMessage).toHaveBeenCalledWith("m1", "new content");
  });

  it("handles delete", async () => {
    const user = userEvent.setup();
    render(<Message messageGroup={userMessage as unknown as MessageType[]} />);

    await user.click(screen.getByText("Delete"));
    // Our mock Dialog renders children immediately when open
    const dialog = screen.getByTestId("dialog");
    const confirmBtn = within(dialog).getByRole("button", { name: "Delete" });
    await user.click(confirmBtn);

    expect(mockDeleteMessage).toHaveBeenCalledWith("m1");
  });

  it("handles retry", async () => {
    const user = userEvent.setup();
    render(<Message messageGroup={userMessage as unknown as MessageType[]} />);

    await user.click(screen.getByText("Retry"));
    expect(mockRetryMessage).toHaveBeenCalledWith("m1");
  });
});
