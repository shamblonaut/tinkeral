import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TokenUsageDisplay } from "@/components/chat";

describe("TokenUsageDisplay", () => {
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

  it("should render nothing for user message when usage is missing", () => {
    const { container } = render(
      <TokenUsageDisplay role="user" contentLength={100} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("should render input tokens for user message when present", () => {
    render(
      <TokenUsageDisplay
        role="user"
        contentLength={100}
        usage={{ inputTokens: 25 }}
      />,
    );
    expect(screen.getByText("25")).toBeInTheDocument();
    // Should have ArrowUp icon (checking title/aria if applicable, but text check is baseline)
    expect(
      screen.getByTitle("Input tokens sent to the model"),
    ).toBeInTheDocument();
  });

  it("should render approximate input tokens for user message when output is present but input isn't", () => {
    render(
      <TokenUsageDisplay
        role="user"
        contentLength={100}
        usage={{ outputTokens: 50 }}
      />,
    );
    // 100 chars -> ~25 tokens
    expect(screen.getByText("~25")).toBeInTheDocument();
  });

  it("should render total tokens with ArrowDownUp for model when split tokens are missing", () => {
    render(
      <TokenUsageDisplay
        role="model"
        contentLength={100}
        usage={{ totalTokens: 75 }}
      />,
    );
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByTitle("Total tokens in this turn")).toBeInTheDocument();
  });

  it("should render split tokens for model when outputTokens are present", () => {
    render(
      <TokenUsageDisplay
        role="model"
        contentLength={100}
        usage={{ outputTokens: 50, thinkingTokens: 10 }}
      />,
    );
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(
      screen.getByTitle("10 thinking tokens consumed by the model"),
    ).toBeInTheDocument();
  });

  it("should show approximation for model when usage is completely missing", () => {
    render(<TokenUsageDisplay role="model" contentLength={100} />);
    // No split tokens, so it shows approximated total (content length / 4)
    expect(screen.getByText("~25")).toBeInTheDocument();
    expect(
      screen.getByTitle("Approximate total tokens in this turn"),
    ).toBeInTheDocument();
  });

  it("should render cached tokens for user message when present", () => {
    render(
      <TokenUsageDisplay
        role="user"
        contentLength={100}
        usage={{ inputTokens: 50, cachedTokens: 20 }}
      />,
    );
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByTitle("20 tokens from cache")).toBeInTheDocument();
  });
});
