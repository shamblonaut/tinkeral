import { type Conversation } from "@/db/schema";

export interface CalculatedTokens {
  total: number;
  isExact: boolean;
}

/**
 * Calculates the total tokens for a conversation history.
 * Prefers the cumulative totalTokens from metadata if available.
 * Falls back to summing message-level tokens or estimating based on content length.
 */
export function calculateConversationTokens(
  conversation: Pick<Conversation, "messages" | "metadata">,
): CalculatedTokens {
  const metaTotal = conversation.metadata?.totalTokens;
  if (metaTotal) {
    return { total: metaTotal, isExact: true };
  }

  const messages = conversation.messages;
  if (messages.length === 0) {
    return { total: 0, isExact: true };
  }

  let calculatedTotal = 0;
  let isExact = true;

  // Try to find the most recent cumulative total first
  const reversedMessages = [...messages].reverse();
  const lastWithTotalIdx = reversedMessages.findIndex(
    (m) => m.metadata?.usage?.totalTokens !== undefined,
  );

  if (lastWithTotalIdx !== -1) {
    const lastWithTotal = reversedMessages[lastWithTotalIdx];
    calculatedTotal = lastWithTotal.metadata!.usage!.totalTokens!;

    // Messages after this one (forward order) need to be added
    const actualIdx = messages.length - 1 - lastWithTotalIdx;
    for (let i = actualIdx + 1; i < messages.length; i++) {
      const msg = messages[i];
      const usage = msg.metadata?.usage;
      if (usage?.outputTokens) {
        calculatedTotal += usage.outputTokens;
      } else if (usage?.inputTokens && i === messages.length - 1) {
        // Only include last user message input tokens if they aren't already in a total
        calculatedTotal += usage.inputTokens;
      } else if (usage?.inputTokens || usage?.outputTokens) {
        calculatedTotal += (usage.inputTokens || 0) + (usage.outputTokens || 0);
      } else {
        calculatedTotal += Math.ceil(msg.content.length / 4);
        isExact = false;
      }
    }
  } else {
    // No cumulative totals found, sum output and first input as a baseline
    isExact = false;
    messages.forEach((m, i) => {
      const usage = m.metadata?.usage;
      if (usage?.outputTokens) {
        calculatedTotal += usage.outputTokens;
      } else if (i === 0 && usage?.inputTokens) {
        calculatedTotal += usage.inputTokens;
      } else if (usage?.inputTokens && i === messages.length - 1) {
        calculatedTotal += usage.inputTokens;
      } else if (usage?.inputTokens || usage?.outputTokens) {
        calculatedTotal += (usage.inputTokens || 0) + (usage.outputTokens || 0);
      } else {
        calculatedTotal += Math.ceil(m.content.length / 4);
      }
    });
  }

  return { total: calculatedTotal, isExact };
}
