# Types & Contracts (Conventions)

This document describes **where types live**, **how contracts are shaped**, and **how to change them safely**.

It is intentionally not a full catalog of every interface in the repo — the TypeScript source is the source of truth.

## Source of truth

- Persisted entities: `src/db/schema.ts`
- Shared cross-feature contracts: `src/shared/types/*`
- Feature-owned re-exports:
  - `src/features/chat/types.ts`
  - `src/features/settings/types.ts`
  - `src/features/functions/types.ts`

If a doc and the code disagree, assume the code is correct and update the doc.

## Type ownership rules

Use these boundaries to prevent circular dependencies and “where should this type live?” churn:

1. **Persisted domain entities** (stored in IndexedDB) live in `src/db/schema.ts`.
   - Examples: `Conversation`, `AppSettings`, `FunctionDefinition`
2. **Cross-feature contracts** live in `src/shared/types/*`.
   - Examples: `Message`, `ModelParameters`, provider request/streaming shapes, error shapes
3. **Feature-internal types** live in the owning feature under `src/features/<feature>/`.

Rule of thumb: persisted → DB schema; protocol/contract → shared types; internal implementation detail → feature.

## Contract conventions

### IDs and timestamps

- IDs are opaque strings (commonly `crypto.randomUUID()`).
- Timestamps are milliseconds since epoch (`Date.now()`).

### Messages

Canonical message contracts:

- `MessageRole`, `Message`, `FinishReason`, `FunctionCall`, `FunctionResult`, `TokenUsage` live in `src/shared/types/conversation.ts`.

Conventions:

- `Message.role` uses `"user" | "model" | "system"`.
- Provider metadata stays under `Message.metadata` (model id, finish reason, usage).
- Tool calls/results attach via `Message.functionCall` / `Message.functionResult`.

### Function calling mode

Tool behavior is represented consistently as:

- `FunctionCallingMode = "AUTO" | "ANY" | "NONE"`

This exists both as a persisted field (`Conversation.functionCallingMode` in `src/db/schema.ts`) and as part of provider request contracts (`src/shared/types/provider.ts`).

### Provider request/streaming shapes

Provider-agnostic contracts live in `src/shared/types/provider.ts`:

- `ChatRequest` (messages, model, parameters, optional system prompt, optional functions + calling mode)
- `StreamChunk` (delta + optional finish reason/usage + optional function call)
- `ProviderErrorLike` lives under `src/shared/types/error.ts` and is used by provider normalization

Implementation note: provider clients live under `src/shared/services/api/*`.

## Changing persisted types (safe evolution)

When you change a type in `src/db/schema.ts`:

1. Update any read/write sites that depend on the old field shape.
2. If the change affects how data is stored or indexed, update the Dexie schema/version in `src/db/db.ts`.
3. Add/update tests covering persistence and migration-like behavior (where applicable).

Prefer backwards-compatible changes (add optional fields) over breaking changes when possible.

## Imports and dependency direction

- Features may import shared types and DB schema types.
- Shared types should not import feature code.
- Provider clients/services should depend on shared types (and DB schema types if needed), not feature UI.
