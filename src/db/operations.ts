import type { AppSettings, Conversation, FunctionDefinition } from "@/db";
import { db } from "@/db";

// Conversations
export const conversations = {
  async create(conversation: Omit<Conversation, "id">) {
    const id = crypto.randomUUID();
    await db.conversations.add({ ...conversation, id } as Conversation);
    return id;
  },
  async get(id: string) {
    return await db.conversations.get(id);
  },
  async getAll() {
    return await db.conversations.toArray();
  },
  async update(id: string, changes: Partial<Conversation>) {
    return await db.conversations.update(id, {
      ...changes,
      updatedAt: Date.now(),
    });
  },
  async delete(id: string) {
    return await db.conversations.delete(id);
  },
};

// Settings
export const settings = {
  async save(appSettings: AppSettings) {
    return await db.settings.put(appSettings);
  },
  async get(): Promise<AppSettings | undefined> {
    return await db.settings.get("app-settings");
  },
};

// Functions
export const functions = {
  async create(fn: Omit<FunctionDefinition, "id">) {
    const id = crypto.randomUUID();
    await db.functions.add({ ...fn, id } as FunctionDefinition);
    return id;
  },
  async get(id: string) {
    return await db.functions.get(id);
  },
  async getAll() {
    return await db.functions.toArray();
  },
  async update(id: string, changes: Partial<FunctionDefinition>) {
    return await db.functions.update(id, {
      ...changes,
      updatedAt: Date.now(),
    });
  },
  async delete(id: string) {
    return await db.functions.delete(id);
  },
};
