import type { StateCreator } from "zustand";

import {
  type FunctionCallingMode,
  type Message,
  type ModelParameters,
} from "@/types";
import {
  abortGeneration,
  deleteMessage,
  editMessage,
  retryMessage,
  setDraft,
  setFunctionCallingMode,
  setParameters,
  setSystemPrompt,
  toggleFunctionAttachment,
  updateMessage,
} from "./chatMutations";
import { executeChat, sendMessage } from "./chatOrchestration";
import type { ConversationChatState, ConversationState } from "./types";

export const createChatSlice: StateCreator<
  ConversationState,
  [],
  [],
  ConversationChatState
> = (set, get) => ({
  isStreaming: false,
  abortController: null,

  setDraft: async (conversationId: string, msg: string) =>
    setDraft(set, get, conversationId, msg),

  sendMessage: async (content: string) => sendMessage(set, get, content),

  executeChat: async (
    conversationId: string,
    userMessage?: Message,
    titleUpdate?: string,
  ) => executeChat(set, get, conversationId, userMessage, titleUpdate),

  deleteMessage: async (messageId: string) =>
    deleteMessage(set, get, messageId),

  retryMessage: async (messageId: string) => retryMessage(set, get, messageId),

  editMessage: async (messageId: string, content: string) =>
    editMessage(set, get, messageId, content),

  abortGeneration: () => abortGeneration(set, get),

  updateMessage: async (
    conversationId: string,
    messageId: string,
    content: string,
  ) => updateMessage(set, get, conversationId, messageId, content),

  setParameters: async (
    params: Partial<ModelParameters>,
    mode: "merge" | "replace" = "merge",
  ) => setParameters(set, get, params, mode),

  setSystemPrompt: async (systemPrompt: string) =>
    setSystemPrompt(set, get, systemPrompt),

  toggleFunctionAttachment: async (functionId: string) =>
    toggleFunctionAttachment(set, get, functionId),

  setFunctionCallingMode: async (mode: FunctionCallingMode) =>
    setFunctionCallingMode(set, get, mode),
});
