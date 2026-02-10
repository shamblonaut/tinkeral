# Database

## Purpose

This document defines the IndexedDB schema, migration strategy, and data access patterns for the application. It uses Dexie.js as the wrapper for better TypeScript support and simpler API.

## Why IndexedDB

- **Asynchronous**: Doesn't block UI thread (critical for smooth streaming)
- **Large Capacity**: ~100s of MB vs ~5-10 MB for localStorage
- **Structured Data**: Supports indexes, queries, and transactions
- **Reliable**: Standard browser API with good support

## Database Overview

**Database Name**: `tinkeral`

**Current Version**: 1

**Tables**:

- `conversations` - Conversation data and messages
- `settings` - Application settings and API keys
- `functions` - User-defined function definitions

## Schema Definition

### Database Setup

```typescript
// src/db/schema.ts
import Dexie, { Table } from "dexie";

export interface ConversationRecord {
  id: string;
  title: string;
  messages: Message[];
  modelId: string;
  parameters: ModelParameters;
  systemPrompt?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: {
    totalTokens?: number;
    estimatedCost?: number;
  };
}

export interface SettingsRecord {
  id: "app-settings"; // Always this value
  apiKeys: Record<string, string>;
  defaultModel: string;
  defaultParameters: ModelParameters;
  uiPreferences: UIPreferences;
  version: string;
}

export interface FunctionRecord {
  id: string;
  name: string;
  description: string;
  parameters: JSONSchema;
  implementation: string;
  createdAt: number;
  updatedAt: number;
  timeout?: number;
  allowedAPIs?: string[];
}

export class AppDatabase extends Dexie {
  conversations!: Table<ConversationRecord, string>;
  settings!: Table<SettingsRecord, string>;
  functions!: Table<FunctionRecord, string>;

  constructor() {
    super("tinkeral");
    this.version(1).stores({
      conversations: "id, updatedAt, createdAt, modelId",
      settings: "id",
      functions: "id, name",
    });
  }
}

export const db = new AppDatabase();
```

### Table Details

#### Conversations Table

**Primary Key**: `id` (string, UUID)

**Indexes**:

- `updatedAt` - For sorting by most recent
- `createdAt` - For sorting by creation date
- `modelId` - For filtering by model

**Size Estimate**: ~10-100 KB per conversation (depends on message count)

**Query Patterns**:

```typescript
// Get all conversations, newest first
await db.conversations.orderBy("updatedAt").reverse().toArray();

// Get specific conversation
await db.conversations.get(conversationId);

// Get conversations by model
await db.conversations.where("modelId").equals("gemini-pro").toArray();

// Delete old conversations (if needed)
const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
await db.conversations.where("updatedAt").below(oneMonthAgo).delete();
```

#### Settings Table

**Primary Key**: `id` (always `'app-settings'`)

**Indexes**: None (single record)

**Size Estimate**: ~1-5 KB

**Query Patterns**:

```typescript
// Get settings
await db.settings.get("app-settings");

// Update settings
await db.settings.put({
  id: "app-settings",
  ...updatedSettings,
});
```

#### Functions Table

**Primary Key**: `id` (string, UUID)

**Indexes**:

- `name` - For searching by function name

**Size Estimate**: ~1-10 KB per function

**Query Patterns**:

```typescript
// Get all functions
await db.functions.toArray();

// Get function by name
await db.functions.where("name").equals("calculate").first();

// Search functions by name
await db.functions.where("name").startsWithIgnoreCase("calc").toArray();
```

## Schema Versioning & Migrations

### Version 1 (Initial Schema)

```typescript
this.version(1).stores({
  conversations: "id, updatedAt, createdAt, modelId",
  settings: "id",
  functions: "id, name",
});
```

### Future Migrations (Examples)

#### Version 2: Add Provider Field

```typescript
this.version(2)
  .stores({
    conversations: "id, updatedAt, createdAt, modelId, provider",
    settings: "id",
    functions: "id, name",
  })
  .upgrade(async (tx) => {
    // Add provider field to existing conversations
    const conversations = await tx.table("conversations").toArray();

    for (const conv of conversations) {
      // Infer provider from modelId
      const provider = conv.modelId.startsWith("gemini") ? "google" : "unknown";
      await tx.table("conversations").update(conv.id, { provider });
    }
  });
```

#### Version 3: Separate Messages Table (if needed for large datasets)

```typescript
this.version(3)
  .stores({
    conversations: "id, updatedAt, createdAt, modelId, provider",
    messages: "id, conversationId, timestamp",
    settings: "id",
    functions: "id, name",
  })
  .upgrade(async (tx) => {
    // Migrate messages from conversations to separate table
    const conversations = await tx.table("conversations").toArray();

    for (const conv of conversations) {
      const messages = conv.messages || [];

      // Insert messages into new table
      for (const msg of messages) {
        await tx.table("messages").add({
          ...msg,
          conversationId: conv.id,
        });
      }

      // Remove messages from conversation record
      await tx.table("conversations").update(conv.id, { messages: undefined });
    }
  });
```

### Migration Best Practices

1. **Always test migrations** with real data before deploying
2. **Never delete old data** in upgrade function - only transform
3. **Use transactions** (provided automatically by Dexie)
4. **Keep migrations fast** - avoid complex operations
5. **Version upgrade functions are idempotent** - safe to run multiple times

## Data Access Patterns

### StorageService Implementation

```typescript
// src/services/storage.ts
import { db } from "@/db/schema";

export class StorageService {
  // Conversations
  async saveConversation(conversation: Conversation): Promise<void> {
    await db.conversations.put({
      ...conversation,
      updatedAt: Date.now(),
    });
  }

  async getConversation(id: string): Promise<Conversation | null> {
    return (await db.conversations.get(id)) ?? null;
  }

  async getAllConversations(): Promise<ConversationSummary[]> {
    const conversations = await db.conversations
      .orderBy("updatedAt")
      .reverse()
      .toArray();

    return conversations.map((conv) => ({
      id: conv.id,
      title: conv.title,
      modelId: conv.modelId,
      lastMessage: conv.messages[conv.messages.length - 1]?.content,
      updatedAt: conv.updatedAt,
      messageCount: conv.messages.length,
    }));
  }

  async deleteConversation(id: string): Promise<void> {
    await db.conversations.delete(id);
  }

  // Settings
  async getSettings(): Promise<AppSettings | null> {
    return (await db.settings.get("app-settings")) ?? null;
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await db.settings.put({
      id: "app-settings",
      ...settings,
    });
  }

  // Cleanup
  async clearAllData(): Promise<void> {
    await db.delete();
    await db.open(); // Recreate empty database
  }
}
```

### Optimistic Updates Pattern

```typescript
// Update state immediately, persist in background
function useOptimisticUpdate() {
  const updateMessage = async (messageId: string, content: string) => {
    // 1. Update UI immediately
    updateStateSync(messageId, content);

    // 2. Persist to IndexedDB (fire and forget)
    persistToDatabase(messageId, content).catch((error) => {
      // 3. Rollback UI if persist fails
      rollbackState(messageId);
      showError("Failed to save changes");
    });
  };
}
```

### Debounced Persistence

```typescript
// Batch rapid changes to reduce I/O
import { debounce } from "lodash-es";

const debouncedSave = debounce(
  async (conversation: Conversation) => {
    await db.conversations.put(conversation);
  },
  500, // Wait 500ms after last change
  { leading: false, trailing: true },
);

// Usage in store
set((state) => {
  state.activeConversation.title = newTitle;
});
debouncedSave(get().activeConversation);
```

## Multi-Tab Synchronization

### BroadcastChannel Communication

```typescript
// src/services/sync.ts
const syncChannel = new BroadcastChannel("tinkeral-sync");

// Send updates to other tabs
export function notifyOtherTabs(type: string, payload: unknown) {
  syncChannel.postMessage({ type, payload, timestamp: Date.now() });
}

// Listen for updates from other tabs
syncChannel.onmessage = (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case "conversation-updated":
      // Reload conversation from IndexedDB
      reloadConversation(payload.id);
      break;

    case "conversation-deleted":
      // Remove from local state
      removeConversationFromState(payload.id);
      break;

    case "settings-changed":
      // Reload settings
      reloadSettings();
      break;
  }
};
```

### Dexie Observable (Alternative)

```typescript
// Listen for changes in IndexedDB
import { liveQuery } from "dexie";

// Auto-refresh conversation list when data changes
const conversations$ = liveQuery(() =>
  db.conversations.orderBy("updatedAt").reverse().toArray(),
);

// Use in React
function ConversationList() {
  const conversations = useLiveQuery(conversations$, []);
  // Component automatically re-renders when data changes
}
```

## Performance Optimization

### Pagination for Large Datasets

```typescript
// Load conversations in pages
async function loadConversationsPage(page: number, pageSize: number = 20) {
  return await db.conversations
    .orderBy("updatedAt")
    .reverse()
    .offset(page * pageSize)
    .limit(pageSize)
    .toArray();
}
```

### Selective Loading

```typescript
// Load conversation without messages first (faster)
async function loadConversationMetadata(id: string) {
  const conv = await db.conversations.get(id);
  if (!conv) return null;

  return {
    id: conv.id,
    title: conv.title,
    modelId: conv.modelId,
    messageCount: conv.messages.length,
    // Don't load messages yet
  };
}

// Load messages separately when needed
async function loadConversationMessages(id: string) {
  const conv = await db.conversations.get(id);
  return conv?.messages ?? [];
}
```

### Bulk Operations

```typescript
// Batch multiple operations
async function bulkImport(conversations: Conversation[]) {
  await db.conversations.bulkPut(conversations);
}

// Better than:
// for (const conv of conversations) {
//   await db.conversations.put(conv); // Too many transactions
// }
```

## Error Handling

### Storage Quota Exceeded

```typescript
async function handleStorageQuotaExceeded() {
  try {
    await db.conversations.put(conversation);
  } catch (error) {
    if (error.name === "QuotaExceededError") {
      // Options:
      // 1. Delete oldest conversations
      const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      await db.conversations.where("updatedAt").below(oneMonthAgo).delete();

      // 2. Notify user
      showNotification({
        type: "warning",
        message: "Storage almost full. Old conversations were archived.",
      });

      // 3. Retry operation
      await db.conversations.put(conversation);
    }
  }
}
```

### IndexedDB Unavailable

```typescript
// Fallback to in-memory storage
class InMemoryStorage implements StorageService {
  private conversations = new Map<string, Conversation>();
  private settings: AppSettings | null = null;

  async saveConversation(conv: Conversation): Promise<void> {
    this.conversations.set(conv.id, conv);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) ?? null;
  }

  // ... implement other methods
}

// Detect and choose storage
export async function initializeStorage(): Promise<StorageService> {
  try {
    await db.open();
    return new DexieStorageService(db);
  } catch (error) {
    console.warn("IndexedDB unavailable, using in-memory storage");
    return new InMemoryStorage();
  }
}
```

## Import/Export

### Export Format

```typescript
interface ExportData {
  version: string; // Schema version
  exportedAt: number;
  type: "full" | "conversations" | "settings";
  conversations?: Conversation[];
  settings?: AppSettings;
  functions?: FunctionDefinition[];
}

async function exportData(): Promise<ExportData> {
  const [conversations, settings, functions] = await Promise.all([
    db.conversations.toArray(),
    db.settings.get("app-settings"),
    db.functions.toArray(),
  ]);

  return {
    version: "1.0.0",
    exportedAt: Date.now(),
    type: "full",
    conversations,
    settings: settings ?? undefined,
    functions,
  };
}
```

### Import with Validation

```typescript
import { z } from "zod";

const ExportDataSchema = z.object({
  version: z.string(),
  exportedAt: z.number(),
  type: z.enum(["full", "conversations", "settings"]),
  conversations: z.array(ConversationSchema).optional(),
  settings: SettingsSchema.optional(),
  functions: z.array(FunctionSchema).optional(),
});

async function importData(data: unknown): Promise<ImportResult> {
  // Validate
  const result = ExportDataSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map((e) => e.message),
    };
  }

  const validData = result.data;

  // Check version compatibility
  if (needsMigration(validData.version)) {
    validData = migrateData(validData);
  }

  // Import
  let conversationsImported = 0;
  let settingsImported = false;
  let functionsImported = 0;

  try {
    if (validData.conversations) {
      await db.conversations.bulkPut(validData.conversations);
      conversationsImported = validData.conversations.length;
    }

    if (validData.settings) {
      await db.settings.put({ id: "app-settings", ...validData.settings });
      settingsImported = true;
    }

    if (validData.functions) {
      await db.functions.bulkPut(validData.functions);
      functionsImported = validData.functions.length;
    }

    return {
      success: true,
      conversationsImported,
      settingsImported,
      functionsImported,
      errors: [],
    };
  } catch (error) {
    return {
      success: false,
      conversationsImported: 0,
      settingsImported: false,
      functionsImported: 0,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}
```

## Testing

### Unit Tests for Database Operations

```typescript
// src/db/schema.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AppDatabase } from "./schema";

describe("AppDatabase", () => {
  let db: AppDatabase;

  beforeEach(async () => {
    db = new AppDatabase();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
    await db.close();
  });

  it("should create conversation", async () => {
    const conversation = {
      id: "123",
      title: "Test",
      messages: [],
      modelId: "gemini-pro",
      parameters: DEFAULT_PARAMETERS,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.conversations.add(conversation);
    const retrieved = await db.conversations.get("123");

    expect(retrieved).toEqual(conversation);
  });

  it("should query by updatedAt", async () => {
    // Add test conversations with different timestamps
    // Query and verify order
  });

  // More tests...
});
```

### Mock Database for Component Tests

```typescript
// src/db/__mocks__/schema.ts
export const mockDb = {
  conversations: {
    toArray: vi.fn(() => Promise.resolve([])),
    get: vi.fn(() => Promise.resolve(null)),
    put: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  },
  settings: {
    get: vi.fn(() => Promise.resolve(null)),
    put: vi.fn(() => Promise.resolve()),
  },
};

export const db = mockDb;
```

## Monitoring & Debugging

### Database Inspector (Dev Tools)

1. Open Chrome DevTools
2. Go to **Application** tab
3. Expand **IndexedDB** → `tinkeral`
4. Inspect tables and data

### Debug Helpers

```typescript
// Development-only helpers
if (import.meta.env.DEV) {
  (window as any).debugDb = {
    // Print all conversations
    listConversations: async () => {
      const convs = await db.conversations.toArray();
      console.table(
        convs.map((c) => ({
          id: c.id,
          title: c.title,
          messages: c.messages.length,
          updated: new Date(c.updatedAt).toLocaleString(),
        })),
      );
    },

    // Clear all data
    clear: async () => {
      await db.delete();
      await db.open();
      console.log("Database cleared");
    },

    // Export to console
    export: async () => {
      const data = await exportData();
      console.log(JSON.stringify(data, null, 2));
    },
  };
}
```

## Related Documentation

- **API_DESIGN.md** - TypeScript interfaces for records
- **ARCHITECTURE.md** - Data persistence strategy
- **IMPLEMENTATION_GUIDE.md** - When to implement database features
- **ERROR_HANDLING.md** - Handling storage errors

---

**Note**: Always use the StorageService abstraction rather than accessing `db` directly. This makes testing easier and allows for future storage mechanism changes.
