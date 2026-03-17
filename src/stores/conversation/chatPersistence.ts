import type { StoreApi } from "zustand";

import { PersistenceService } from "@/services/persistence";
import type { Conversation } from "@/types";

import type { ConversationState } from "./types";

type SetConversationState = StoreApi<ConversationState>["setState"];
type GetConversationState = StoreApi<ConversationState>["getState"];

export async function persistConversationUpdate(
  get: GetConversationState,
  conversationId: string,
  updates?: Partial<Conversation>,
): Promise<void> {
  const conversation = get().conversations.find((c) => c.id === conversationId);
  if (!conversation) {
    return;
  }

  await PersistenceService.updateConversation(conversation, updates);
}

export async function persistFinalChatConversation(
  set: SetConversationState,
  get: GetConversationState,
  conversationId: string,
  titleUpdate?: string,
): Promise<void> {
  const finalConversation = get().conversations.find(
    (c) => c.id === conversationId,
  );
  if (!finalConversation) {
    return;
  }

  if (finalConversation.persisted === false && !finalConversation.isTemporary) {
    const wasPersisted = await PersistenceService.saveNewConversation(
      finalConversation,
      titleUpdate,
    );

    if (wasPersisted) {
      set((state) => ({
        conversations: state.conversations.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, persisted: true }
            : conversation,
        ),
      }));
    }

    return;
  }

  await PersistenceService.updateConversation(finalConversation);
}
