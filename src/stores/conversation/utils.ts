import type { Conversation, Message } from "@/types";

/**
 * Helper to remove empty ephemeral conversations
 */
export function cleanupEmptyDrafts(
  conversations: Conversation[],
  activeId: string | null,
): Conversation[] {
  return conversations.filter((c) => {
    // Keep if it's the active one
    if (c.id === activeId) return true;
    // Keep if it's persisted
    if (c.persisted !== false) return true;
    // Keep if it has messages
    if (c.messages.length > 0) return true;
    // Otherwise, it's an empty draft that can be removed
    return false;
  });
}

/**
 * Logic to delete a message and everything after it
 */
export function deleteMessageAndFollowing(
  messages: Message[],
  messageId: string,
): Message[] {
  const index = messages.findIndex((m) => m.id === messageId);
  if (index === -1) return messages;
  return messages.slice(0, index);
}

/**
 * Prepares messages for retry, finding the appropriate slice point
 */
export function prepareMessagesForRetry(
  messages: Message[],
  messageId: string,
): { updatedMessages: Message[]; userMessage?: Message } | null {
  const index = messages.findIndex((m) => m.id === messageId);
  if (index === -1) return null;

  const currentMessage = messages[index];
  let userMessage: Message | undefined;
  let sliceIndex = index;

  if (currentMessage.role === "model") {
    // Find the user message before this one
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userMessage = messages[i];
        break;
      }
    }
    sliceIndex = index;
  } else if (currentMessage.role === "user") {
    userMessage = currentMessage;
    sliceIndex = index + 1;
  }

  if (!userMessage) return null;

  return {
    updatedMessages: messages.slice(0, sliceIndex),
    userMessage,
  };
}

/**
 * Prepares messages for edit, updating the specific message and truncating after
 */
export function prepareMessagesForEdit(
  messages: Message[],
  messageId: string,
  newContent: string,
): { updatedMessages: Message[]; editedMessage: Message } | null {
  const index = messages.findIndex((m) => m.id === messageId);
  if (index === -1) return null;

  const originalMessage = messages[index];
  const editedMessage = {
    ...originalMessage,
    content: newContent,
    timestamp: Date.now(),
  };

  const updatedMessages = [...messages.slice(0, index), editedMessage];

  return { updatedMessages, editedMessage };
}
