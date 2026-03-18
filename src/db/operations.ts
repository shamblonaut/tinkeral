import { toast } from "sonner";

import { db } from "./db";
import type { AppSettings, Conversation, FunctionDefinition } from "./schema";

async function withErrorHandling<T>(
  operation: () => Promise<T>,
  fallbackMessage: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    const err = error as { name?: string; inner?: { name?: string } };
    if (
      err?.name === "QuotaExceededError" ||
      err?.inner?.name === "QuotaExceededError"
    ) {
      toast.error(
        "Storage limit reached. Please delete old conversations or free up space.",
      );
    } else {
      toast.error(fallbackMessage);
    }
    throw error;
  }
}

// Conversations
export const conversations = {
  async create(conversation: Omit<Conversation, "id">) {
    return withErrorHandling(async () => {
      const id = crypto.randomUUID();
      await db.conversations.add({ ...conversation, id } as Conversation);
      return id;
    }, "Failed to create conversation");
  },
  async get(id: string) {
    return await db.conversations.get(id);
  },
  async getAll() {
    return await db.conversations.toArray();
  },
  async update(id: string, changes: Partial<Conversation>) {
    return withErrorHandling(async () => {
      return await db.conversations.update(id, {
        ...changes,
        updatedAt: Date.now(),
      });
    }, "Failed to update conversation");
  },
  async delete(id: string) {
    return withErrorHandling(async () => {
      return await db.conversations.delete(id);
    }, "Failed to delete conversation");
  },
  async save(conversation: Conversation) {
    return withErrorHandling(async () => {
      return await db.conversations.put(conversation);
    }, "Failed to save conversation");
  },
};

// Settings
export const settings = {
  async save(appSettings: AppSettings) {
    return withErrorHandling(async () => {
      return await db.settings.put(appSettings);
    }, "Failed to save settings");
  },
  async get(): Promise<AppSettings | undefined> {
    return await db.settings.get("app-settings");
  },
};

// Functions
export const functions = {
  async create(fn: Omit<FunctionDefinition, "id">) {
    return withErrorHandling(async () => {
      const id = crypto.randomUUID();
      await db.functions.add({ ...fn, id } as FunctionDefinition);
      return id;
    }, "Failed to create function");
  },
  async get(id: string) {
    return await db.functions.get(id);
  },
  async getAll() {
    return await db.functions.toArray();
  },
  async update(id: string, changes: Partial<FunctionDefinition>) {
    return withErrorHandling(async () => {
      return await db.functions.update(id, {
        ...changes,
        updatedAt: Date.now(),
      });
    }, "Failed to update function");
  },
  async delete(id: string) {
    return withErrorHandling(async () => {
      return await db.functions.delete(id);
    }, "Failed to delete function");
  },
};
