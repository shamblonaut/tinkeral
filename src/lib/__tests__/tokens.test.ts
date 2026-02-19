import { type Message } from "@/types/conversation";
import { describe, expect, it } from "vitest";
import { calculateConversationTokens } from "../tokens";

describe("calculateConversationTokens", () => {
  it("should return the cumulative total from metadata if present", () => {
    const conversation = {
      messages: [],
      metadata: { totalTokens: 150 },
    };
    const result = calculateConversationTokens(conversation);
    expect(result.total).toBe(150);
    expect(result.isExact).toBe(true);
  });

  it("should return 0 for an empty conversation with no metadata", () => {
    const conversation = {
      messages: [],
    };
    const result = calculateConversationTokens(conversation);
    expect(result.total).toBe(0);
    expect(result.isExact).toBe(true);
  });

  it("should sum tokens from messages when cumulative metadata is missing", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "user",
        content: "Hello",
        timestamp: 1,
        metadata: { usage: { inputTokens: 5 } },
      },
      {
        id: "2",
        role: "model",
        content: "Hi there!",
        timestamp: 2,
        metadata: { usage: { outputTokens: 8, totalTokens: 13 } },
      },
    ];
    const conversation = { messages };
    const result = calculateConversationTokens(conversation);
    // Should use the totalTokens from the last model message
    expect(result.total).toBe(13);
    expect(result.isExact).toBe(true);
  });

  it("should sum subsequent messages after the last known totalTokens", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "user",
        content: "Initial",
        timestamp: 1,
        metadata: { usage: { totalTokens: 5 } },
      },
      {
        id: "2",
        role: "model",
        content: "Response",
        timestamp: 2,
        metadata: { usage: { outputTokens: 10 } },
      },
      {
        id: "3",
        role: "user",
        content: "Next",
        timestamp: 3,
        metadata: { usage: { inputTokens: 4 } },
      },
    ];
    const conversation = { messages };
    const result = calculateConversationTokens(conversation);
    // Starts from 5 (msg 1), adds 10 (msg 2), adds 4 (msg 3) = 19
    expect(result.total).toBe(19);
    expect(result.isExact).toBe(true);
  });

  it("should handle mixed exact and approximate counts", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "user",
        content: "Approximate content", // ~5 tokens
        timestamp: 1,
      },
      {
        id: "2",
        role: "model",
        content: "Exact response",
        timestamp: 2,
        metadata: { usage: { outputTokens: 10, totalTokens: 15 } },
      },
      {
        id: "3",
        role: "user",
        content: "Another approx", // ~4 tokens
        timestamp: 3,
      },
    ];
    const conversation = { messages };
    const result = calculateConversationTokens(conversation);
    // Starts from 15 (msg 2), adds ~4 (msg 3) = 19
    expect(result.total).toBe(19);
    expect(result.isExact).toBe(false);
  });

  it("should fallback to character count when no usage data exists", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "user",
        content: "Hello", // 5 chars -> 2 tokens
        timestamp: 1,
      },
      {
        id: "2",
        role: "model",
        content: "World!", // 6 chars -> 2 tokens
        timestamp: 2,
      },
    ];
    const conversation = { messages };
    const result = calculateConversationTokens(conversation);
    expect(result.total).toBe(2 + 2);
    expect(result.isExact).toBe(false);
  });

  it("should handle case with only inputTokens available (e.g. initial message)", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "user",
        content: "Hello",
        timestamp: 1,
        metadata: { usage: { inputTokens: 5 } },
      },
    ];
    const conversation = { messages };
    const result = calculateConversationTokens(conversation);
    expect(result.total).toBe(5);
    expect(result.isExact).toBe(false); // inputTokens only on last message is treated as part of baseline but not "total-based exact"
  });

  it("should correctly handle Gemini 2.x structure with thinking and cached tokens", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "model",
        content: "Thinking response",
        timestamp: 1,
        metadata: {
          usage: {
            inputTokens: 10,
            outputTokens: 20,
            thinkingTokens: 5,
            cachedTokens: 15,
            totalTokens: 50, // 10 + 20 + 5 + 15 = 50
          },
        },
      },
    ];
    const conversation = { messages };
    const result = calculateConversationTokens(conversation);
    expect(result.total).toBe(50);
    expect(result.isExact).toBe(true);
  });
});
