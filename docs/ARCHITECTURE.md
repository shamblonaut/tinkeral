# Architecture

Tinkeral is a **client-side** (no-backend) React app for exploring LLM chat behavior, parameter tuning, and function/tool calling. Data persists locally in the browser.

## Goals / non-goals

**Goals**

- Run entirely in the browser (static hosting)
- Keep API keys and data local-first
- Make chat/tool flows observable and easy to experiment with
- Keep provider integration behind a small service layer

**Non-goals**

- Server-side account/auth, syncing, or analytics
- A “perfect” provider abstraction for every provider feature

## High-level architecture

```
Browser (React/Vite)
  ├─ UI (src/features/*/components)
  ├─ State (Zustand stores in src/features/*/store and src/shared/store)
  ├─ Services
  │    ├─ Chat orchestration (src/features/chat/store/chatOrchestration.ts)
  │    ├─ Chat service (src/features/chat/services/chat.ts)
  │    ├─ Provider client(s) (src/shared/services/api/*)
  │    └─ Persistence helpers (src/features/chat/services/persistence.ts)
  ├─ Local DB (Dexie) (src/db/*)
  └─ Web Worker sandbox (src/features/functions/workers/*)
        └─ FunctionExecutor service (src/features/functions/services/executor.ts)
```

## Code organization (what lives where)

- **Chat**
  - UI: `src/features/chat/components/*`
  - Store slices + orchestration: `src/features/chat/store/*`
  - Chat service: `src/features/chat/services/chat.ts`
  - Persistence helper: `src/features/chat/services/persistence.ts`
- **Settings**
  - Store: `src/features/settings/store/settings.ts`
  - UI: `src/features/settings/components/*`
- **Functions (tool calling)**
  - Store: `src/features/functions/store/functions.ts`
  - Executor service: `src/features/functions/services/executor.ts`
  - Worker: `src/features/functions/workers/functionExecutor.worker.ts`
  - UI: `src/features/functions/components/*`
- **Shared**
  - UI store (modals, etc): `src/shared/store/ui.ts`
  - Provider clients: `src/shared/services/api/*` (currently Google)
  - Shared contracts: `src/shared/types/*`
- **Database**
  - Canonical persisted entities: `src/db/schema.ts`
  - Dexie database: `src/db/db.ts`
  - CRUD operations: `src/db/operations.ts`
- **Feature flags**
  - `src/config/features.ts`

## Core flows

### App initialization

Entry points:

- `src/main.tsx` mounts the app.
- `src/App.tsx` performs startup initialization:
  - loads settings (`useSettingsStore.loadSettings`)
  - ensures functions are loaded (`useFunctionsStore.ensureFunctionsLoaded`)
  - loads conversations (`useConversationStore.loadConversations`)
  - ensures an active conversation (`useConversationStore.ensureActiveConversation`)
  - loads available models in the background once a Google API key exists

First-run behavior: if no Google key exists in settings, the app shows `APIKeyModal` instead of `ChatInterface`.

### Send message → stream response

Primary flow:

1. UI triggers `sendMessage` in `src/features/chat/store/chatOrchestration.ts`
2. The store appends the user message to the active conversation in state
3. The store calls `executeChat` (same module) which:
   - reads the Google API key from `useSettingsStore`
   - loads attached functions (by `conversation.functionIds`) from IndexedDB
   - streams a response via `ChatService.executeChat`
4. `ChatService.executeChat` (in `src/features/chat/services/chat.ts`) builds a provider request and calls the provider client:
   - `GoogleAPIClient.streamChat` from `src/shared/services/api/google.ts`
5. Streaming chunks update the assistant message content in state; the UI re-renders.

### Function calling loop

When the provider stream includes a function call, `ChatService.executeChat` runs a loop:

- Tracks a function call for the current turn as chunks arrive
- If the turn finishes with a function call, it executes the function and appends:
  - a model message containing the call
  - a user message containing the serialized function result
- Then it starts another provider turn using the expanded message list

Guardrail: the loop caps at **10 function-call iterations** to avoid infinite tool loops.

### Persistence model (local-first)

Data is persisted with Dexie (IndexedDB):

- Canonical entities: `src/db/schema.ts` (`Conversation`, `AppSettings`, `FunctionDefinition`)
- Database: `src/db/db.ts`
- CRUD wrappers (with toast errors): `src/db/operations.ts`

Conversation persistence is coordinated by:

- `src/features/chat/services/persistence.ts` (`PersistenceService`)
- `src/features/chat/store/chatPersistence.ts` helpers used by orchestration

Important conversation flags (persisted fields):

- `persisted?: boolean` and `isTemporary?: boolean` affect whether conversation writes happen
- `functionIds?: string[]` controls which functions are attached to a conversation
- `functionCallingMode?: "AUTO" | "ANY" | "NONE"` controls tool behavior sent to the provider

## Function execution sandbox

User-provided function implementations run outside the UI thread:

- Worker implementation: `src/features/functions/workers/functionExecutor.worker.ts`
- Host/service: `src/features/functions/services/executor.ts` (`FunctionExecutor`)

High-level properties:

- Runs in a Web Worker (no DOM access)
- Enforces timeouts
- Supports an “allowed APIs” concept for intentionally enabling specific globals per function

## Testing approach (current)

The repo uses Vitest + Testing Library with tests co-located under features:

- Chat store integration tests: `src/features/chat/store/__tests__/*`
- Provider client tests: `src/shared/services/api/__tests__/*`
- DB tests: `src/db/__tests__/*` (uses `fake-indexeddb`)
- Function worker/executor tests: `src/features/functions/**/__tests__/*`

## Extensibility: adding a provider (checklist)

1. Implement a provider client under `src/shared/services/api/` (similar surface to `GoogleAPIClient`).
2. Use/extend the provider contracts in `src/shared/types/provider.ts` and `src/shared/types/conversation.ts`.
3. Add model definitions and selection wiring in the shared model utilities (see `src/shared/lib/models`).
4. Add a settings key path (provider → key) in `AppSettings.apiKeys` (already a map) and UI for configuring it.
5. Add tests for request mapping and error normalization under `src/shared/services/api/__tests__/`.
