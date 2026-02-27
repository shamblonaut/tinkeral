/**
 * Unit tests for pure conversation utility functions in
 * src/stores/conversation/utils.ts
 * These functions contain no async logic and need no mocking.
 */
import type { Message } from "@/types/conversation";
import { describe, expect, it } from "vitest";

import {
  deleteMessageAndFollowing,
  prepareMessagesForEdit,
  prepareMessagesForRetry,
} from "../conversation/utils";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const msg = (
  id: string,
  role: "user" | "model",
  content = "text",
): Message => ({ id, role, content, timestamp: Date.now() });

// ---------------------------------------------------------------------------
// deleteMessageAndFollowing
// ---------------------------------------------------------------------------

describe("deleteMessageAndFollowing", () => {
  const messages = [msg("m1", "user"), msg("m2", "model"), msg("m3", "user")];

  it("should delete the target message and everything after it", () => {
    const result = deleteMessageAndFollowing(messages, "m2");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m1");
  });

  it("should delete from the first message, leaving nothing", () => {
    const result = deleteMessageAndFollowing(messages, "m1");
    expect(result).toHaveLength(0);
  });

  it("should delete the last message only", () => {
    const result = deleteMessageAndFollowing(messages, "m3");
    expect(result).toHaveLength(2);
  });

  it("should return the original array unchanged if messageId is not found", () => {
    const result = deleteMessageAndFollowing(messages, "nonexistent");
    expect(result).toBe(messages); // same reference
  });
});

// ---------------------------------------------------------------------------
// prepareMessagesForRetry
// ---------------------------------------------------------------------------

describe("prepareMessagesForRetry", () => {
  const messages = [
    msg("m1", "user", "Q1"),
    msg("m2", "model", "A1"),
    msg("m3", "user", "Q2"),
    msg("m4", "model", "A2"),
  ];

  it("should return null for a non-existent messageId", () => {
    expect(prepareMessagesForRetry(messages, "nope")).toBeNull();
  });

  it("should slice before a model message and return the preceding user message", () => {
    const result = prepareMessagesForRetry(messages, "m2");
    expect(result).not.toBeNull();
    expect(result!.updatedMessages).toHaveLength(1); // m1 only
    expect(result!.userMessage?.id).toBe("m1");
  });

  it("should handle retrying the second model message", () => {
    const result = prepareMessagesForRetry(messages, "m4");
    expect(result!.updatedMessages).toHaveLength(3); // m1, m2, m3
    expect(result!.userMessage?.id).toBe("m3");
  });

  it("should handle retrying a user message directly", () => {
    const result = prepareMessagesForRetry(messages, "m3");
    // user message at index 2: sliceIndex = index + 1 = 3, so keeps m1, m2, m3
    expect(result!.updatedMessages).toHaveLength(3); // m1, m2, m3
    expect(result!.userMessage?.id).toBe("m3");
  });

  it("should return null if there is no preceding user message", () => {
    // Model message is first in the array — no user before it
    const result = prepareMessagesForRetry([msg("m1", "model")], "m1");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// prepareMessagesForEdit
// ---------------------------------------------------------------------------

describe("prepareMessagesForEdit", () => {
  const messages = [
    msg("m1", "user", "Original"),
    msg("m2", "model", "Response"),
    msg("m3", "user", "Follow-up"),
  ];

  it("should return null for a non-existent messageId", () => {
    expect(prepareMessagesForEdit(messages, "nope", "new")).toBeNull();
  });

  it("should update the message content and truncate everything after it", () => {
    const result = prepareMessagesForEdit(messages, "m1", "Updated");
    expect(result).not.toBeNull();
    expect(result!.updatedMessages).toHaveLength(1);
    expect(result!.updatedMessages[0].content).toBe("Updated");
    expect(result!.editedMessage.content).toBe("Updated");
  });

  it("should edit a middle message and discard only later messages", () => {
    const result = prepareMessagesForEdit(messages, "m2", "Better response");
    expect(result!.updatedMessages).toHaveLength(2); // m1 + updated m2
    expect(result!.updatedMessages[1].content).toBe("Better response");
  });

  it("should edit the last message with nothing to truncate", () => {
    const result = prepareMessagesForEdit(messages, "m3", "Edited follow-up");
    expect(result!.updatedMessages).toHaveLength(3);
    expect(result!.updatedMessages[2].content).toBe("Edited follow-up");
  });

  it("should preserve the original role on the edited message", () => {
    const result = prepareMessagesForEdit(messages, "m2", "New content");
    expect(result!.editedMessage.role).toBe("model");
  });
});
