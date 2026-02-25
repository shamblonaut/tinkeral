import { db } from "@/db";
import { useConversationStore, useSettingsStore } from "@/stores";

export async function exportData(): Promise<string> {
  const settings = await db.settings.get("app-settings");
  const conversations = await db.conversations.toArray();

  const payload = {
    version: 1,
    timestamp: Date.now(),
    settings,
    conversations,
  };

  return JSON.stringify(payload, null, 2);
}

export async function importData(jsonString: string): Promise<void> {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("Invalid JSON file");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid backup format");
  }

  if (!("settings" in parsed) && !("conversations" in parsed)) {
    throw new Error("No settings or conversations found in backup");
  }

  // Validate conversations array before touching the database
  if (parsed.conversations && !Array.isArray(parsed.conversations)) {
    throw new Error("Corrupted backup: conversations should be an array");
  }

  if (Array.isArray(parsed.conversations)) {
    for (const conv of parsed.conversations) {
      if (!conv || !conv.id) {
        throw new Error("Corrupted backup: conversation missing ID");
      }
    }
  }

  await db.transaction("rw", db.settings, db.conversations, async () => {
    if (parsed.settings && typeof parsed.settings === "object") {
      await db.settings.put(parsed.settings);
    }

    if (
      Array.isArray(parsed.conversations) &&
      parsed.conversations.length > 0
    ) {
      // Merge rather than completely overwriting
      await db.conversations.bulkPut(parsed.conversations);
    }
  });

  // Reload stores so UI updates immediately
  await useSettingsStore.getState().loadSettings();
  await useConversationStore.getState().loadConversations();
}
