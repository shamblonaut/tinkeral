import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MessageContent } from "../message/MessageContent";

// Mock next-themes for PreBlock
vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({ resolvedTheme: "dark" })),
}));

// Mock syntax highlighter and lucide-react icons if necessary
vi.mock("@/shared/lib/syntaxHighlighter", () => {
  return {
    SyntaxHighlighter: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="syntax-highlighter">{children}</div>
    ),
    oneDark: {},
    oneLight: {},
  };
});

describe("MessageContent", () => {
  const baseProps = {
    content: "Hello world",
    isUser: false,
    isEditing: false,
    editContent: "Hello world",
    onEditContentChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders message content", () => {
    render(<MessageContent {...baseProps} isUser={true} />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders markdown elements correctly", () => {
    render(
      <MessageContent
        {...baseProps}
        content="# Heading 1\n\n**Bold text** and [Link](https://example.com)\n\n`inline code`"
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Heading 1",
    );
    expect(screen.getByRole("link")).toHaveTextContent("Link");
    expect(screen.getByText("inline code")).toBeInTheDocument();
  });

  it("renders code blocks", () => {
    render(
      <MessageContent
        {...baseProps}
        content={"```javascript\nconst x = 1;\n```"}
      />,
    );

    // The language label should be visible
    expect(screen.getByText("javascript")).toBeInTheDocument();

    // Syntax highlighter mock should have the code
    expect(screen.getByTestId("syntax-highlighter")).toHaveTextContent(
      "const x = 1;",
    );
  });

  it("renders edit view when isEditing is true", () => {
    render(
      <MessageContent
        {...baseProps}
        isUser={true}
        isEditing={true}
        editContent="Updated content"
      />,
    );

    expect(screen.getByDisplayValue("Updated content")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Save & Submit/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
  });

  it("calls onEditContentChange when typing in edit view", async () => {
    const user = userEvent.setup();
    const onEditContentChange = vi.fn();
    render(
      <MessageContent
        {...baseProps}
        isEditing={true}
        editContent=""
        onEditContentChange={onEditContentChange}
      />,
    );

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "A");

    expect(onEditContentChange).toHaveBeenCalledWith("A");
  });

  it("calls onSave when Save button is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<MessageContent {...baseProps} isEditing={true} onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: /Save & Submit/i }));

    expect(onSave).toHaveBeenCalled();
  });

  it("calls onCancel when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <MessageContent {...baseProps} isEditing={true} onCancel={onCancel} />,
    );

    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(onCancel).toHaveBeenCalled();
  });

  it("copies code to clipboard when copy button is clicked", async () => {
    const user = userEvent.setup();
    // Mock clipboard API correctly
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
      configurable: true,
    });

    render(
      <MessageContent
        {...baseProps}
        content={"```javascript\nconst x = 1;\n```"}
      />,
    );

    const copyBtn = screen.getByRole("button", { name: /Copy code/i });
    await user.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("const x = 1;");
    expect(screen.getByText("Copied!")).toBeInTheDocument();
  });

  it("renders various markdown elements (table, blockquote, headers, hr, br)", () => {
    const complexMarkdown = `
# H1
## H2
### H3
> Blockquote
---
Line 1  
Line 2 (br)
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
`;
    render(<MessageContent {...baseProps} content={complexMarkdown} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("H1");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("H2");
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("H3");
    expect(screen.getByRole("blockquote")).toHaveTextContent("Blockquote");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Cell 1")).toBeInTheDocument();
    expect(document.querySelector("hr")).toBeInTheDocument();
    // Br is hard to find by role, but we can check if it exists
    expect(document.querySelector("br")).toBeInTheDocument();
  });
});
