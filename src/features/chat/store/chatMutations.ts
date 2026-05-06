import type { StoreApi } from "zustand";

import {
  DEFAULT_PARAMETERS,
  type FunctionCallingMode,
  type ModelParameters,
} from "@/shared/types";

import { persistConversationUpdate } from "./chatPersistence";
import type { ConversationState } from "./types";
import {
  deleteMessageAndFollowing,
  prepareMessagesForEdit,
  prepareMessagesForRetry,
} from "./utils";

type SetConversationState = StoreApi<ConversationState>["setState"];
type GetConversationState = StoreApi<ConversationState>["getState"];

export async function setDraft(
  set: SetConversationState,
  get: GetConversationState,
  conversationId: string,
  message: string,
): Promise<void> {
  const currentConversation = get().conversations.find(
    (conversation) => conversation.id === conversationId,
  );

  if (
    !currentConversation ||
    currentConversation.isTemporary ||
    currentConversation.draft === message
  ) {
    return;
  }

  set((state) => ({
    conversations: state.conversations.map((conversation) =>
      conversation.id === conversationId
        ? { ...currentConversation, draft: message }
        : conversation,
    ),
  }));

  await persistConversationUpdate(get, conversationId);
}

export function abortGeneration(
  set: SetConversationState,
  get: GetConversationState,
): void {
  const { abortController } = get();
  if (!abortController) {
    return;
  }

  abortController.abort();
  set({
    isLoading: false,
    isStreaming: false,
    abortController: null,
  });
}

export async function deleteMessage(
  set: SetConversationState,
  get: GetConversationState,
  messageId: string,
): Promise<void> {
  const { activeConversationId, conversations } = get();
  if (!activeConversationId) {
    return;
  }

  abortGeneration(set, get);

  const conversation = conversations.find(
    (item) => item.id === activeConversationId,
  );
  if (!conversation) {
    return;
  }

  const updatedMessages = deleteMessageAndFollowing(
    conversation.messages,
    messageId,
  );
  const updatedConversation = {
    ...conversation,
    messages: updatedMessages,
    updatedAt: Date.now(),
  };

  set((state) => ({
    conversations: state.conversations.map((item) =>
      item.id === activeConversationId ? updatedConversation : item,
    ),
  }));

  await persistConversationUpdate(get, activeConversationId);
}

export async function retryMessage(
  set: SetConversationState,
  get: GetConversationState,
  messageId: string,
): Promise<void> {
  const { activeConversationId, conversations } = get();
  if (!activeConversationId) {
    return;
  }

  abortGeneration(set, get);

  const conversation = conversations.find(
    (item) => item.id === activeConversationId,
  );
  if (!conversation) {
    return;
  }

  const retryInfo = prepareMessagesForRetry(conversation.messages, messageId);
  if (!retryInfo) {
    return;
  }

  const { updatedMessages, userMessage } = retryInfo;
  const updatedConversation = {
    ...conversation,
    messages: updatedMessages,
    updatedAt: Date.now(),
  };

  set((state) => ({
    conversations: state.conversations.map((item) =>
      item.id === activeConversationId ? updatedConversation : item,
    ),
  }));

  if (userMessage) {
    await get().executeChat(activeConversationId, userMessage);
    return;
  }

  await persistConversationUpdate(get, activeConversationId);
}

export async function editMessage(
  set: SetConversationState,
  get: GetConversationState,
  messageId: string,
  content: string,
): Promise<void> {
  const { activeConversationId, conversations } = get();
  if (!activeConversationId) {
    return;
  }

  abortGeneration(set, get);

  const conversation = conversations.find(
    (item) => item.id === activeConversationId,
  );
  if (!conversation) {
    return;
  }

  const editInfo = prepareMessagesForEdit(
    conversation.messages,
    messageId,
    content,
  );
  if (!editInfo) {
    return;
  }

  const { updatedMessages, editedMessage } = editInfo;
  const updatedConversation = {
    ...conversation,
    messages: updatedMessages,
    updatedAt: Date.now(),
  };

  set((state) => ({
    conversations: state.conversations.map((item) =>
      item.id === activeConversationId ? updatedConversation : item,
    ),
  }));

  if (editedMessage.role === "user") {
    await get().executeChat(activeConversationId, editedMessage);
    return;
  }

  await persistConversationUpdate(get, activeConversationId);
}

export async function updateMessage(
  set: SetConversationState,
  get: GetConversationState,
  conversationId: string,
  messageId: string,
  content: string,
): Promise<void> {
  set((state) => {
    const currentConversation = state.conversations.find(
      (conversation) => conversation.id === conversationId,
    );
    if (!currentConversation) {
      return {};
    }

    const updatedMessages = currentConversation.messages.map((message) =>
      message.id === messageId ? { ...message, content } : message,
    );

    const updatedConversation = {
      ...currentConversation,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };

    return {
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId ? updatedConversation : conversation,
      ),
    };
  });

  await persistConversationUpdate(get, conversationId);
}

export async function setParameters(
  set: SetConversationState,
  get: GetConversationState,
  params: Partial<ModelParameters>,
  mode: "merge" | "replace" = "merge",
): Promise<void> {
  const { activeConversationId } = get();
  if (!activeConversationId) {
    return;
  }

  set((state) => {
    const currentConversation = state.conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );
    if (!currentConversation) {
      return {};
    }

    const updatedParameters: ModelParameters =
      mode === "merge"
        ? { ...currentConversation.parameters, ...params }
        : { ...DEFAULT_PARAMETERS, ...params };

    const updatedConversation = {
      ...currentConversation,
      parameters: updatedParameters,
      updatedAt: Date.now(),
    };

    return {
      conversations: state.conversations.map((conversation) =>
        conversation.id === activeConversationId
          ? updatedConversation
          : conversation,
      ),
    };
  });

  await persistConversationUpdate(get, activeConversationId);
}

export async function setSystemPrompt(
  set: SetConversationState,
  get: GetConversationState,
  systemPrompt: string,
): Promise<void> {
  const { activeConversationId } = get();
  if (!activeConversationId) {
    return;
  }

  set((state) => {
    const currentConversation = state.conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );
    if (!currentConversation) {
      return {};
    }

    const updatedConversation = {
      ...currentConversation,
      systemPrompt,
      updatedAt: Date.now(),
    };

    return {
      conversations: state.conversations.map((conversation) =>
        conversation.id === activeConversationId
          ? updatedConversation
          : conversation,
      ),
    };
  });

  await persistConversationUpdate(get, activeConversationId);
}

export async function toggleFunctionAttachment(
  set: SetConversationState,
  get: GetConversationState,
  functionId: string,
): Promise<void> {
  const { activeConversationId } = get();
  if (!activeConversationId) {
    return;
  }

  set((state) => {
    const currentConversation = state.conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );
    if (!currentConversation) {
      return {};
    }

    const currentFunctionIds = currentConversation.functionIds || [];
    const nextFunctionIds = currentFunctionIds.includes(functionId)
      ? currentFunctionIds.filter((id) => id !== functionId)
      : [...currentFunctionIds, functionId];

    const updatedConversation = {
      ...currentConversation,
      functionIds: nextFunctionIds,
      updatedAt: Date.now(),
    };

    return {
      conversations: state.conversations.map((conversation) =>
        conversation.id === activeConversationId
          ? updatedConversation
          : conversation,
      ),
    };
  });

  const conversation = get().conversations.find(
    (item) => item.id === activeConversationId,
  );

  if (!conversation) {
    return;
  }

  await persistConversationUpdate(get, activeConversationId, {
    functionIds: conversation.functionIds,
  });
}

export async function setFunctionCallingMode(
  set: SetConversationState,
  get: GetConversationState,
  mode: FunctionCallingMode,
): Promise<void> {
  const { activeConversationId } = get();
  if (!activeConversationId) {
    return;
  }

  set((state) => {
    const currentConversation = state.conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );
    if (!currentConversation) {
      return {};
    }

    const updatedConversation = {
      ...currentConversation,
      functionCallingMode: mode,
      updatedAt: Date.now(),
    };

    return {
      conversations: state.conversations.map((conversation) =>
        conversation.id === activeConversationId
          ? updatedConversation
          : conversation,
      ),
    };
  });

  const conversation = get().conversations.find(
    (item) => item.id === activeConversationId,
  );

  if (!conversation) {
    return;
  }

  await persistConversationUpdate(get, activeConversationId, {
    functionCallingMode: conversation.functionCallingMode,
  });
}
