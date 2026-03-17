import { db } from "@/db";
import {
  useConversationStore,
  useFunctionsStore,
  useSettingsStore,
} from "@/stores";

export async function exportData(): Promise<string> {
  const settings = await db.settings.get("app-settings");
  const conversations = await db.conversations.toArray();
  const functions = await db.functions.toArray();

  const payload = {
    version: 1,
    timestamp: Date.now(),
    settings,
    conversations,
    functions,
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

  if (
    !("settings" in parsed) &&
    !("conversations" in parsed) &&
    !("functions" in parsed)
  ) {
    throw new Error("No settings, conversations, or functions found in backup");
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

  // Validate functions array
  if (parsed.functions && !Array.isArray(parsed.functions)) {
    throw new Error("Corrupted backup: functions should be an array");
  }

  if (Array.isArray(parsed.functions)) {
    for (const fn of parsed.functions) {
      if (
        !fn ||
        !fn.id ||
        typeof fn.name !== "string" ||
        typeof fn.implementation !== "string"
      ) {
        throw new Error(
          "Corrupted backup: function missing required fields or invalid format",
        );
      }
    }
  }

  await db.transaction(
    "rw",
    db.settings,
    db.conversations,
    db.functions,
    async () => {
      if (parsed.settings && typeof parsed.settings === "object") {
        await db.settings.put(parsed.settings);
      }

      if (
        Array.isArray(parsed.conversations) &&
        parsed.conversations.length > 0
      ) {
        // Handle deleted or missing functions referenced by conversations
        const allFunctionsMap = new Set<string>();
        if (parsed.functions && Array.isArray(parsed.functions)) {
          parsed.functions.forEach((f: { id: string }) =>
            allFunctionsMap.add(f.id),
          );
        }
        const existingFunctions = await db.functions.toArray();
        existingFunctions.forEach((f) => allFunctionsMap.add(f.id));

        const processedConversations = parsed.conversations.map(
          (conv: { functionIds?: string[]; [key: string]: unknown }) => {
            if (conv.functionIds && Array.isArray(conv.functionIds)) {
              conv.functionIds = conv.functionIds.filter((id: string) =>
                allFunctionsMap.has(id),
              );
            }
            return conv;
          },
        );

        // Merge rather than completely overwriting
        await db.conversations.bulkPut(processedConversations);
      }

      if (Array.isArray(parsed.functions) && parsed.functions.length > 0) {
        // Merge rather than completely overwriting
        await db.functions.bulkPut(parsed.functions);
      }
    },
  );

  // Reload stores so UI updates immediately
  await useSettingsStore.getState().loadSettings();
  await useConversationStore.getState().loadConversations();
  await useFunctionsStore.getState().ensureFunctionsLoaded(true);
}
